import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import multer from 'multer';

// App Modules
import {
  initDb,
  createUser,
  getUserByEmail,
  getUserById,
  updateUserLastLogin,
  getSettings,
  saveSettings,
  addLead,
  getLeads,
  getLeadStats,
  getUnsentLeads,
  updateLeadStatus,
  deleteLead,
  deleteBatchLeads,
  deleteAllLeads,
  saveDraft,
  rejectAllDrafts,
  getQueueLeads,
  getDailyLeadsCount,
  getSystemSettings,
  saveSystemSettings,
  logAuditEvent,
  getAuditLogs,
  clearAuditLogs,
  getAbuseIncidents,
  getAiUsageStats,
  getAllUsersWithDetailedStats,
  getGlobalAggregateStats,
  getCharityInstitutions,
  getCharityInstitutionById,
  createCharityInstitution,
  updateCharityInstitution,
  deleteCharityInstitution,
  updateUserRole,
  updateUserStatus,
  updateUserDailyLimitOverride,
  adminResetUserPassword,
  deleteUserCascade,
  getUserLeadsForAdmin,
  getUserCvForAdmin,
  saveUserCvForAdmin,
  getDatabaseHealth,
  optimizeDatabase
} from './db.js';

import {
  hashPassword,
  comparePassword,
  generateToken,
  requireAuth,
  requireAdmin
} from './auth.js';

import {
  getScraperStatus,
  startScraperServer,
  stopScraperServer,
  downloadScraper,
  installDependencies
} from './scraper-controller.js';

import { scrapeWebsiteForEmail } from './scraper.js';
import { generateColdEmail, parseCVToJSON } from './ai.js';
import { sendColdEmail } from './mailer.js';
import { PDFParse } from 'pdf-parse';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const SCRAPER_URL = process.env.SCRAPER_URL || 'http://127.0.0.1:8000';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Middlewares
app.use(cors());
app.use(express.json({ limit: '25mb' }));
// Uploaded documents are not exposed as a public static directory.

app.use((req, res, next) => {
  if (process.env.DEMO_MODE === 'true' && (req.path.startsWith('/api/scraper/') || req.path === '/api/cv/pdf' || req.path === '/api/auth/register')) {
    return res.status(403).json({error: 'Disabled in the isolated fictional demo'});
  }
  next();
});

// Helper: Extract real client IP
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

function normalizeCharityPayload(body = {}, existing = {}) {
  const name = String(body.name ?? existing.name ?? '').trim();
  const description = String(body.description ?? existing.description ?? '').trim();
  const category = String(body.category ?? existing.category ?? 'Instituição apoiada').trim();
  const websiteUrl = String(
    body.websiteUrl ?? body.website_url ?? existing.website_url ?? ''
  ).trim();
  const rawOrder = body.displayOrder ?? body.display_order ?? existing.display_order ?? 0;
  const parsedOrder = Number.parseInt(String(rawOrder), 10);
  const displayOrder = Number.isFinite(parsedOrder)
    ? Math.max(0, Math.min(parsedOrder, 9999))
    : 0;
  const rawActive = body.isActive ?? body.is_active ?? existing.is_active ?? true;
  const isActive = !(
    rawActive === false ||
    rawActive === 'false' ||
    rawActive === 0 ||
    rawActive === '0'
  );

  if (!name || name.length > 160) {
    return { error: 'Informe um nome de instituição com até 160 caracteres.' };
  }
  if (description.length > 1000) {
    return { error: 'A descrição deve ter no máximo 1000 caracteres.' };
  }
  if (!category || category.length > 80) {
    return { error: 'Informe uma categoria com até 80 caracteres.' };
  }
  if (websiteUrl.length > 2048) {
    return { error: 'O link informado é muito longo.' };
  }

  try {
    const parsedUrl = new URL(websiteUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { error: 'O link precisa começar com http:// ou https://.' };
    }
  } catch {
    return { error: 'Informe um link válido para a instituição.' };
  }

  return {
    data: {
      name,
      description,
      category,
      websiteUrl,
      isActive,
      displayOrder
    }
  };
}

// Helper: Format uptime
function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

// Helper: Get user's effective daily limit
async function getEffectiveDailyLimit(userId) {
  try {
    const user = await getUserById(userId);
    if (user && user.daily_limit_override !== null && user.daily_limit_override !== undefined && user.daily_limit_override > 0) {
      return parseInt(user.daily_limit_override, 10);
    }
    const sysSettings = await getSystemSettings();
    const globalLimit = parseInt(sysSettings.global_daily_leads_limit || '50', 10);
    return isNaN(globalLimit) ? 50 : globalLimit;
  } catch (e) {
    return 50;
  }
}

// Rate limiters for security with abuse audit logging
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 auth requests per windowMs
  handler: async (req, res) => {
    const ip = getClientIp(req);
    await logAuditEvent({
      ipAddress: ip,
      action: 'RATE_LIMIT_HIT',
      category: 'security',
      severity: 'warning',
      details: `IP ${ip} excedeu o limite máximo de tentativas de autenticação.`
    });
    res.status(429).json({ error: 'Muitas tentativas de login/cadastro. Tente novamente em alguns minutos.' });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize Database
await initDb();
if (process.env.DEMO_MODE === 'true') {
  const {seedDemo} = await import('./seed-demo.js');
  await seedDemo();
}

// ----------------- Multi-Tenant State Storage -----------------
// Maps userId -> State object for isolated searches & worker tasks
const userSearchJobs = new Map();
const userEmailWorkers = new Map();

function getOrCreateSearchJob(userId) {
  if (!userSearchJobs.has(userId)) {
    userSearchJobs.set(userId, {
      status: 'idle', // 'idle', 'running', 'completed', 'failed'
      progress: 0,
      currentCity: '',
      cities: [],
      query: '',
      country: 'BR',
      maxResults: 30,
      targetGoal: 0,
      leadsFound: 0,
      logs: []
    });
  }
  return userSearchJobs.get(userId);
}

function getOrCreateEmailWorker(userId) {
  if (!userEmailWorkers.has(userId)) {
    userEmailWorkers.set(userId, {
      status: 'idle', // 'idle', 'drafting', 'sending'
      lastSentTime: null,
      logs: [],
      timeoutId: null
    });
  }
  return userEmailWorkers.get(userId);
}

function addSearchLog(userId, msg) {
  const job = getOrCreateSearchJob(userId);
  const time = new Date().toLocaleTimeString();
  const entry = `[${time}] ${msg}`;
  job.logs.push(entry);
  if (job.logs.length > 200) job.logs.shift();
  console.log(`\x1b[35m[BUSCA U:${userId}]\x1b[0m ${msg}`);
}

function completeSearchJob(userId, message) {
  const job = getOrCreateSearchJob(userId);
  if (job.status !== 'running') return;

  job.progress = 100;
  job.status = 'completed';
  addSearchLog(userId, message);
}

function addWorkerLog(userId, msg) {
  const worker = getOrCreateEmailWorker(userId);
  const time = new Date().toLocaleTimeString();
  const entry = `[${time}] ${msg}`;
  worker.logs.push(entry);
  if (worker.logs.length > 200) worker.logs.shift();
  console.log(`\x1b[36m[WORKER U:${userId}]\x1b[0m ${msg}`);
}

// Helper: Fetch all cities for a country via CountriesNow API
async function fetchCountryCities(countryCode) {
  const mapping = {
    'BR': 'Brazil',
    'CA': 'Canada',
    'US': 'United States',
    'UK': 'United Kingdom',
    'PT': 'Portugal'
  };
  const countryName = mapping[countryCode] || countryCode;

  try {
    console.log(`[Search] Solicitando lista de cidades para ${countryName}...`);
    const response = await axios.post('https://countriesnow.space/api/v0.1/countries/cities', {
      country: countryName
    }, { timeout: 10000 });

    if (response.data && !response.data.error) {
      return response.data.data;
    }
    return [];
  } catch (err) {
    console.error(`[Search] Erro ao buscar cidades para ${countryName}:`, err.message);
    return [];
  }
}

// ----------------- Background Worker: Email Outreach Queue (Per User) -----------------
async function runEmailWorkerTick(userId) {
  const worker = getOrCreateEmailWorker(userId);
  if (worker.status === 'idle') return;

  try {
    const settings = await getSettings(userId);
    const delayMinutes = 30; // 30 minutes between sends
    const cooldownMs = delayMinutes * 60 * 1000;

    // PHASE 1: DRAFTING (AI Generation)
    if (worker.status === 'drafting') {
      const unsentLeads = await getUnsentLeads(userId, 1);
      if (unsentLeads.length === 0) {
        addWorkerLog(userId, '🎉 Todos os leads disponíveis foram redigidos pela IA. Worker de rascunhos finalizado.');
        worker.status = 'idle';
        return;
      }

      const lead = unsentLeads[0];
      addWorkerLog(userId, `[AI] Gerando rascunho inteligente para: ${lead.name}...`);

      try {
        const emailDraft = await generateColdEmail(lead.name, lead.website, settings.user_cv, settings, userId);
        // Status 3 = Approved / Queued
        await saveDraft(userId, lead.email, emailDraft.subject, emailDraft.body, null, 3);
        addWorkerLog(userId, `✅ Rascunho pronto e aprovado para: ${lead.name}`);

        worker.timeoutId = setTimeout(() => runEmailWorkerTick(userId), 2000);
      } catch (aiErr) {
        addWorkerLog(userId, `❌ Erro de IA para ${lead.name}: ${aiErr.message}`);
        // Status 4 = Failed
        await saveDraft(userId, lead.email, null, null, aiErr.message, 4);
        worker.timeoutId = setTimeout(() => runEmailWorkerTick(userId), 5000);
      }
      return;
    }

    // PHASE 2: SENDING (SMTP Delivery)
    if (worker.status === 'sending') {
      const queueLeads = await getQueueLeads(userId);
      const approvedLead = queueLeads.find(l => l.email_sent === 3);

      if (!approvedLead) {
        addWorkerLog(userId, 'Não há mais e-mails na fila aprovada. Worker de envio pausado.');
        worker.status = 'idle';
        return;
      }

      // Check SMTP configuration
      if (!settings.smtp_user || !settings.smtp_pass) {
        addWorkerLog(userId, 'Erro: Configurações de SMTP não preenchidas. Envio cancelado.');
        worker.status = 'idle';
        return;
      }

      // Check cooldown
      if (worker.lastSentTime) {
        const timeSinceLastSend = Date.now() - worker.lastSentTime;
        if (timeSinceLastSend < cooldownMs) {
          const waitMinutes = Math.ceil((cooldownMs - timeSinceLastSend) / 60000);
          addWorkerLog(userId, `Intervalo de segurança ativo. Próximo disparo em ~${waitMinutes}m.`);
          worker.timeoutId = setTimeout(() => runEmailWorkerTick(userId), 60000);
          return;
        }
      }

      addWorkerLog(userId, `[SMTP] Enviando e-mail para: ${approvedLead.name} (${approvedLead.email})...`);
      let candidateName = 'Candidato';
      try {
        const cvJson = JSON.parse(settings.user_cv || '{}');
        candidateName = cvJson.personal_info?.name || 'Candidato';
      } catch (e) {}

      const mailResult = await sendColdEmail(
        approvedLead.email,
        approvedLead.draft_subject,
        approvedLead.draft_body,
        settings,
        candidateName,
        userId
      );

      if (mailResult.success) {
        await saveDraft(userId, approvedLead.email, approvedLead.draft_subject, approvedLead.draft_body, null, 1); // Status 1 = Sent
        worker.lastSentTime = Date.now();
        addWorkerLog(userId, `🚀 E-mail disparado com sucesso para ${approvedLead.name}!`);
        await logAuditEvent({
          userId,
          action: 'EMAIL_SENT',
          category: 'email',
          severity: 'info',
          details: `E-mail de outreach disparado para ${approvedLead.email} (${approvedLead.name}).`
        });
      } else {
        await saveDraft(userId, approvedLead.email, approvedLead.draft_subject, approvedLead.draft_body, mailResult.error, 4); // Status 4 = Failed
        addWorkerLog(userId, `❌ Falha ao disparar para ${approvedLead.name}: ${mailResult.error}`);
        await logAuditEvent({
          userId,
          action: 'EMAIL_SEND_FAILED',
          category: 'email',
          severity: 'danger',
          details: `Falha no envio de e-mail para ${approvedLead.email}: ${mailResult.error}`
        });
      }

      worker.timeoutId = setTimeout(() => runEmailWorkerTick(userId), 5000);
      return;
    }

  } catch (error) {
    addWorkerLog(userId, `Erro crítico no worker: ${error.message}`);
    worker.status = 'idle';
  }
}

// ----------------- Background Worker: Google Maps Search (Per User) -----------------
async function runSearchJob(userId) {
  const searchJob = getOrCreateSearchJob(userId);
  if (searchJob.status !== 'running') return;

  const { query, cities, country, maxResults, targetGoal } = searchJob;

  try {
    const goalText = targetGoal > 0 ? ` Meta: ${targetGoal} leads.` : '';
    addSearchLog(userId, `Iniciando Caça de Leads B2B. Alvo: "${query}" em ${cities.length} cidades (País: ${country || 'BR'}).${goalText}`);

    // Check if scraper server is reachable
    const scraperCheck = await getScraperStatus();
    if (scraperCheck.status !== 'running') {
      searchJob.status = 'failed';
      addSearchLog(userId, `Erro: O Motor de Busca (${SCRAPER_URL}) não está respondendo. Verifique se o container está ativo no CasaOS.`);
      return;
    }

    const total = cities.length;
    for (let i = 0; i < total; i++) {
      if (searchJob.status !== 'running') {
        addSearchLog(userId, 'Busca cancelada pelo usuário.');
        return;
      }

      // Check dynamic daily quota during execution
      const effectiveDailyLimit = await getEffectiveDailyLimit(userId);
      const currentDaily = await getDailyLeadsCount(userId);
      if (currentDaily >= effectiveDailyLimit) {
        completeSearchJob(userId, `🛡️ COTA DIÁRIA ATINGIDA: Você atingiu o limite de ${effectiveDailyLimit} leads hoje. Finalizando busca com sucesso.`);
        return;
      }

      if (targetGoal > 0 && searchJob.leadsFound >= targetGoal) {
        completeSearchJob(userId, `🎯 META ATINGIDA: Encontramos ${searchJob.leadsFound} leads. Finalizando busca.`);
        return;
      }

      const city = cities[i];
      searchJob.currentCity = city;
      searchJob.progress = total > 0 ? Math.round((i / total) * 100) : 0;

      addSearchLog(userId, `[${i+1}/${total}] Buscando no Maps em: "${city}"...`);

      try {
        const response = await axios.post(`${SCRAPER_URL}/tasks/create-task-sync`, {
          scraper_name: "google_maps_scraper",
          data: {
            queries: [`${query} in ${city}`],
            search_method: "city",
            countries: [country || "BR"],
            business_types: [query],
            cities: [city],
            max_results: maxResults || 30,
            api_key: "",
            lang: "en",
            zoom_level: 14
          }
        }, { timeout: 900000 });

        let resultsList = [];
        if (Array.isArray(response.data)) {
          const taskWithResults = response.data.find(t => Array.isArray(t.result) && t.result.length > 0);
          if (taskWithResults) {
            resultsList = taskWithResults.result;
          } else if (response.data.length > 0) {
            resultsList = response.data[0].result || [];
          }
        } else if (response.data && response.data.result) {
          resultsList = response.data.result;
        }

        if (resultsList.length > 0) {
          addSearchLog(userId, `Encontradas ${resultsList.length} empresas em ${city}. Extraindo e-mails dos websites...`);

          for (const business of resultsList) {
            if (searchJob.status !== 'running') return;
            if (targetGoal > 0 && searchJob.leadsFound >= targetGoal) return;

            const website = business.website;
            const name = business.name;

            if (!website) continue;

            addSearchLog(userId, `Verificando site: ${website} (${name})...`);

            try {
              const email = await scrapeWebsiteForEmail(website);
              if (email) {
                const saveResult = await addLead(userId, name, email, website, country);
                if (saveResult.success) {
                  searchJob.leadsFound++;
                  addSearchLog(userId, `🎉 SUCESSO [${searchJob.leadsFound}${targetGoal > 0 ? '/' + targetGoal : ''}]: E-mail [${email}] de ${name} salvo.`);

                  if (targetGoal > 0 && searchJob.leadsFound >= targetGoal) {
                    completeSearchJob(userId, `🎯 META ATINGIDA: Encontramos ${searchJob.leadsFound} leads. Finalizando busca.`);
                    return;
                  }
                } else if (saveResult.duplicated) {
                  addSearchLog(userId, `Lead ${name} (${email}) já existe na sua base. Ignorado.`);
                }
              }
            } catch (scrapeErr) {
              console.error('Erro ao escanear site', scrapeErr.message);
            }
          }
        } else {
          addSearchLog(userId, `Nenhum resultado para ${city}. Pulando...`);
        }

      } catch (err) {
        addSearchLog(userId, `Erro ao buscar na cidade "${city}": ${err.message}`);
      }
    }

    completeSearchJob(userId, `🎉 Busca finalizada! Total de novos leads encontrados: ${searchJob.leadsFound}`);
  } catch (error) {
    searchJob.status = 'failed';
    addSearchLog(userId, `Erro crítico no job do scraper: ${error.message}`);
  }
}

// ----------------- Authentication Endpoints -----------------

// ----------------- Public / Announcement Endpoints -----------------

app.get('/api/announcement', async (req, res) => {
  try {
    const sys = await getSystemSettings();
    if (sys.announcement_banner_active === 'true' && sys.announcement_banner_text) {
      return res.json({
        active: true,
        text: sys.announcement_banner_text,
        type: sys.announcement_banner_type || 'info'
      });
    }
    res.json({ active: false });
  } catch (err) {
    res.json({ active: false });
  }
});

app.get('/api/charities', async (req, res) => {
  try {
    const institutions = await getCharityInstitutions();
    res.json(institutions);
  } catch (err) {
    console.error('[Charities Public GET Error]', err);
    res.status(500).json({ error: 'Não foi possível carregar as instituições agora.' });
  }
});

// ----------------- Authentication Endpoints -----------------

app.post('/api/auth/register', upload.single('proof'), authLimiter, async (req, res) => {
  const clientIp = getClientIp(req);
  try {
    const { name, email, password } = req.body;
    const proofType = req.body.proofType || req.body.proof_type || 'blood';

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Você precisa anexar o comprovante da sua forma de apoio.' });
    }

    if (!['blood', 'charity'].includes(proofType)) {
      return res.status(400).json({ error: 'Escolha uma forma de apoio válida.' });
    }

    let institutionId = null;
    let selectedInstitution = null;
    if (proofType === 'charity') {
      institutionId = Number.parseInt(req.body.institutionId || req.body.institution_id, 10);
      if (!Number.isInteger(institutionId) || institutionId <= 0) {
        return res.status(400).json({ error: 'Escolha uma instituição apoiada antes de enviar o comprovante.' });
      }

      selectedInstitution = await getCharityInstitutionById(institutionId);
      if (!selectedInstitution || !selectedInstitution.is_active) {
        return res.status(400).json({ error: 'Essa instituição não está disponível no momento. Escolha outra.' });
      }
    }

    const proofPath = `/uploads/${req.file.filename}`;

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está em uso por outro bunker.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(
      name.trim(),
      email.trim(),
      passwordHash,
      'user',
      proofPath,
      proofType,
      institutionId
    );

    if (user.error) {
      return res.status(400).json({ error: user.message });
    }

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      ipAddress: clientIp,
      action: 'USER_REGISTERED_PENDING_APPROVAL',
      category: 'auth',
      severity: 'info',
      details: proofType === 'charity'
        ? `Novo bunker registrado com comprovante de apoio à instituição ${selectedInstitution.name}. Aguardando aprovação do anexo.`
        : 'Novo bunker registrado com comprovante de doação de sangue. Aguardando aprovação do anexo.'
    });

    res.json({ success: true, message: 'Cadastro enviado! Sua conta está em análise.', pendingApproval: true });
  } catch (err) {
    console.error('[Auth Register Error]', err);
    res.status(500).json({ error: 'Erro interno ao registrar usuário: ' + err.message });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const clientIp = getClientIp(req);
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      await logAuditEvent({
        userEmail: email,
        ipAddress: clientIp,
        action: 'LOGIN_FAILED',
        category: 'auth',
        severity: 'warning',
        details: `Tentativa de login falhou: e-mail não encontrado (${email}).`
      });
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        ipAddress: clientIp,
        action: 'LOGIN_FAILED',
        category: 'auth',
        severity: 'warning',
        details: `Senha incorreta informada para ${email}.`
      });
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // Check if account is suspended or pending
    if (user.status === 'suspended') {
      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        ipAddress: clientIp,
        action: 'SUSPENDED_LOGIN_ATTEMPT',
        category: 'auth',
        severity: 'danger',
        details: `Usuário suspenso tentou autenticar no sistema.`
      });
      return res.status(403).json({ error: 'Sua conta de usuário foi suspensa pelo administrador do sistema.' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Sua conta ainda está em análise (comprovante de apoio). Aguarde a aprovação.' });
    }

    const token = generateToken(user);
    await updateUserLastLogin(user.id);

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      ipAddress: clientIp,
      action: 'LOGIN_SUCCESS',
      category: 'auth',
      severity: 'info',
      details: `Login efetuado com sucesso.`
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status || 'active'
      }
    });
  } catch (err) {
    console.error('[Auth Login Error]', err);
    res.status(500).json({ error: 'Erro interno no login: ' + err.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Sua conta de usuário foi suspensa pelo administrador.' });
    }
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status || 'active',
        dailyLimitOverride: user.daily_limit_override,
        createdAt: user.created_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- User Settings Endpoints -----------------

app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const settings = await getSettings(req.user.id);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', requireAuth, async (req, res) => {
  try {
    const updated = await saveSettings(req.user.id, req.body);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PDF Resume Upload Endpoint (Per User)
app.post('/api/cv/pdf', requireAuth, async (req, res) => {
  const { pdfBase64 } = req.body;
  if (!pdfBase64) {
    return res.status(400).json({ success: false, error: 'Arquivo PDF não fornecido.' });
  }

  try {
    const buffer = Buffer.from(pdfBase64, 'base64');
    const userPdfPath = path.join(uploadsDir, `cv_${req.user.id}.pdf`);
    fs.writeFileSync(userPdfPath, buffer);
    console.log(`[Server] CV PDF do usuário ${req.user.id} gravado com sucesso em: ${userPdfPath}`);

    // 1. Extrair texto do PDF
    let rawText = '';
    try {
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      rawText = typeof textResult === 'string' ? textResult : (textResult?.text || '');
    } catch (parseErr) {
      console.warn('[Server] Aviso na leitura do texto do PDF:', parseErr.message);
    }

    // 2. Carregar configurações do usuário
    const settings = await getSettings(req.user.id);

    // 3. Tentar estruturar com IA
    let parsedCv = null;
    let aiWarning = null;

    if (rawText && rawText.trim().length > 10) {
      try {
        parsedCv = await parseCVToJSON(rawText, settings);
      } catch (aiErr) {
        console.warn('[Server] Falha na estruturação por IA:', aiErr.message);
        aiWarning = aiErr.message;
      }
    }

    // Se a IA não puder estruturar agora, usamos uma estrutura segura preservando o existente ou construindo do texto
    if (!parsedCv) {
      try {
        const existing = JSON.parse(settings.user_cv || '{}');
        if (existing.personal_info && (existing.personal_info.name || existing.personal_info.title)) {
          parsedCv = existing;
        }
      } catch (e) {}

      if (!parsedCv) {
        parsedCv = {
          personal_info: {
            name: req.user.name || 'Candidato',
            title: 'Especialista B2B',
            email: req.user.email || '',
            location: ''
          },
          professional_summary: rawText ? rawText.slice(0, 300).trim() : 'Perfil profissional sincronizado via PDF.',
          core_competencies: ['Vendas Consultivas', 'Outreach B2B', 'Comunicação'],
          professional_experience: [],
          education: []
        };
      }
    }

    // 4. Salvar no banco de dados vinculando ao usuário
    const updatedSettings = await saveSettings(req.user.id, {
      user_cv: JSON.stringify(parsedCv, null, 2),
      cv_pdf_uploaded: 'true'
    });

    res.json({
      success: true,
      user_cv: parsedCv,
      settings: updatedSettings,
      message: aiWarning ? 'PDF salvo com sucesso! Adicione suas chaves de IA em Ajustes para enriquecer a extração automática.' : 'PDF salvo e analisado com sucesso!'
    });
  } catch (err) {
    console.error('[CV Parsing Error]', err);
    res.status(500).json({ success: false, error: 'Erro ao processar PDF: ' + err.message });
  }
});

// ----------------- Leads Endpoints (Per User) -----------------

app.get('/api/leads', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const leads = await getLeads(req.user.id, limit, offset);
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leads', requireAuth, async (req, res) => {
  try {
    const { name, email, website, country } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Nome e e-mail são obrigatórios.' });
    }
    const result = await addLead(req.user.id, name, email, website, country || 'BR');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    const success = await deleteLead(req.user.id, req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leads/batch-delete', requireAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum lead selecionado.' });
    }
    const deletedCount = await deleteBatchLeads(req.user.id, ids);
    res.json({ success: true, count: deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/leads', requireAuth, async (req, res) => {
  try {
    const count = await deleteAllLeads(req.user.id);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const stats = await getLeadStats(req.user.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- Queue Management Endpoints -----------------

app.get('/api/queue', requireAuth, async (req, res) => {
  try {
    const queue = await getQueueLeads(req.user.id);
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/queue/approve', requireAuth, async (req, res) => {
  try {
    const { email, subject, body } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'E-mail é obrigatório.' });

    const success = await saveDraft(req.user.id, email, subject, body, null, 3);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/queue/send-now', requireAuth, async (req, res) => {
  try {
    const { email, subject, body } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'E-mail é obrigatório.' });

    await saveDraft(req.user.id, email, subject, body, null, 3);

    const settings = await getSettings(req.user.id);
    let candidateName = 'Candidato';
    try {
      const cvJson = JSON.parse(settings.user_cv || '{}');
      candidateName = cvJson.personal_info?.name || 'Candidato';
    } catch (e) {}

    addWorkerLog(req.user.id, `[SMTP] Disparo manual imediato solicitado para: ${email}`);

    sendColdEmail(email, subject, body, settings, candidateName, req.user.id)
      .then(async (result) => {
        if (result.success) {
          await saveDraft(req.user.id, email, subject, body, null, 1);
          addWorkerLog(req.user.id, `🚀 Disparo imediato para ${email} concluído com sucesso!`);
        } else {
          await saveDraft(req.user.id, email, subject, body, result.error, 4);
          addWorkerLog(req.user.id, `❌ Falha no disparo para ${email}: ${result.error}`);
        }
      });

    res.json({ success: true, message: 'Disparo iniciado com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/queue/reject', requireAuth, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'E-mail é obrigatório.' });

    const success = await saveDraft(req.user.id, email, null, null, null, 0);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/queue/reject-all', requireAuth, async (req, res) => {
  try {
    const success = await rejectAllDrafts(req.user.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- Scraper & Search Endpoints -----------------

app.get('/api/scraper/status', async (req, res) => {
  try {
    const status = await getScraperStatus();
    res.json({
      ...status,
      scraperUrl: SCRAPER_URL
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/scraper/start', requireAuth, (req, res) => {
  const started = startScraperServer();
  res.json({ success: started });
});

app.post('/api/scraper/stop', requireAuth, (req, res) => {
  const stopped = stopScraperServer();
  res.json({ success: stopped });
});

app.post('/api/scraper/setup', requireAuth, async (req, res) => {
  try {
    await downloadScraper();
    installDependencies();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint de Cota Diária do Usuário
app.get('/api/scraper/quota', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const effectiveLimit = await getEffectiveDailyLimit(userId);
    const usedToday = await getDailyLeadsCount(userId);
    const remainingToday = Math.max(0, effectiveLimit - usedToday);
    res.json({
      dailyLimit: effectiveLimit,
      usedToday,
      remainingToday,
      resetAt: '00:00'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/scraper/search', requireAuth, async (req, res) => {
  const { query, cities, country, maxResults, mode, goal } = req.body;
  const userId = req.user.id;
  const clientIp = getClientIp(req);
  const searchJob = getOrCreateSearchJob(userId);

  if (!query) {
    return res.status(400).json({ success: false, error: 'O termo de busca (nicho) é obrigatório.' });
  }

  if (searchJob.status === 'running') {
    return res.status(400).json({ success: false, error: 'Já existe uma busca em execução para a sua conta.' });
  }

  // 1. Dynamic Daily Quota Check
  const effectiveLimit = await getEffectiveDailyLimit(userId);
  const usedToday = await getDailyLeadsCount(userId);
  if (usedToday >= effectiveLimit) {
    await logAuditEvent({
      userId,
      userEmail: req.user.email,
      ipAddress: clientIp,
      action: 'SEARCH_QUOTA_EXCEEDED',
      category: 'scraper',
      severity: 'warning',
      details: `Tentativa de busca bloqueada: Cota diária atingida (${usedToday}/${effectiveLimit} leads).`
    });

    return res.status(400).json({
      success: false,
      error: `Você já atingiu sua cota diária de ${effectiveLimit} novos leads hoje. Sua cota renova automaticamente à 00h para preservar o servidor para toda a comunidade!`
    });
  }

  const remainingQuota = effectiveLimit - usedToday;

  let finalCities = [];
  let targetGoal = 0;
  let limitWarning = null;

  if (mode === 'country') {
    finalCities = await fetchCountryCities(country || 'BR');
    const rawGoal = parseInt(goal) || 30;

    if (rawGoal > remainingQuota) {
      limitWarning = `Sua cota restante para hoje é de ${remainingQuota} leads. A meta foi ajustada para esse saldo.`;
    } else if (rawGoal > 50) {
      console.warn(`[Segurança/Alerta] Usuário ${req.user.email} (ID: ${req.user.id}) tentou meta de ${rawGoal}. Limitando a 50.`);
      limitWarning = `A meta solicitada (${rawGoal}) excedeu o teto permitido e foi limitada a 50 leads.`;
    }

    targetGoal = Math.min(Math.max(rawGoal, 5), remainingQuota); // Limite pela cota restante

    if (finalCities.length === 0) {
      return res.status(400).json({ success: false, error: `Não foi possível obter cidades para o país ${country}.` });
    }

    finalCities = finalCities.sort(() => Math.random() - 0.5);
  } else {
    if (!cities || !Array.isArray(cities) || cities.length === 0) {
      return res.status(400).json({ success: false, error: 'Selecione pelo menos uma cidade.' });
    }
    finalCities = cities.map(c => c.trim());
    targetGoal = remainingQuota;
  }

  const rawMax = parseInt(maxResults) || 20;
  if (rawMax > remainingQuota) {
    if (!limitWarning) limitWarning = `A extração foi ajustada para a sua cota restante de ${remainingQuota} leads hoje.`;
  }
  const safeMaxResults = Math.min(Math.max(rawMax, 5), remainingQuota);

  userSearchJobs.set(userId, {
    status: 'running',
    progress: 0,
    currentCity: '',
    cities: finalCities,
    query: query.trim(),
    country: (country || 'BR').trim(),
    maxResults: safeMaxResults,
    targetGoal: targetGoal,
    leadsFound: 0,
    logs: []
  });

  await logAuditEvent({
    userId,
    userEmail: req.user.email,
    ipAddress: clientIp,
    action: 'SEARCH_STARTED',
    category: 'scraper',
    severity: 'info',
    details: `Busca iniciada para nicho "${query}" em ${finalCities.length} cidades (Meta: ${targetGoal}).`
  });

  runSearchJob(userId);
  res.json({ success: true, job: userSearchJobs.get(userId), limitWarning });
});

app.post('/api/scraper/search/stop', requireAuth, (req, res) => {
  const userId = req.user.id;
  const searchJob = getOrCreateSearchJob(userId);

  if (searchJob.status === 'running') {
    searchJob.status = 'idle';
    addSearchLog(userId, 'Busca cancelada pelo usuário.');
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Nenhuma busca em execução no momento.' });
  }
});

app.get('/api/scraper/search/status', requireAuth, (req, res) => {
  const job = getOrCreateSearchJob(req.user.id);
  res.json(job);
});

// ----------------- Email Worker Endpoints -----------------

app.get('/api/worker/status', requireAuth, (req, res) => {
  const worker = getOrCreateEmailWorker(req.user.id);
  res.json({
    status: worker.status,
    lastSentTime: worker.lastSentTime,
    logs: worker.logs.slice(-50)
  });
});

app.post('/api/worker/start', requireAuth, (req, res) => {
  const userId = req.user.id;
  const worker = getOrCreateEmailWorker(userId);
  const { mode } = req.body;

  if (worker.status !== 'idle') {
    return res.json({ success: true, message: `Worker já está em modo ${worker.status}` });
  }

  const targetMode = mode === 'sending' ? 'sending' : 'drafting';
  worker.status = targetMode;
  addWorkerLog(userId, `Worker iniciado no modo [${targetMode}].`);
  runEmailWorkerTick(userId);
  res.json({ success: true, mode: targetMode });
});

app.post('/api/worker/stop', requireAuth, (req, res) => {
  const userId = req.user.id;
  const worker = getOrCreateEmailWorker(userId);

  if (worker.status !== 'idle') {
    const oldStatus = worker.status;
    worker.status = 'idle';
    clearTimeout(worker.timeoutId);
    worker.timeoutId = null;
    addWorkerLog(userId, `Worker [${oldStatus}] interrompido com sucesso.`);
    res.json({ success: true });
  } else {
    res.json({ success: true, message: 'Worker já estava parado.' });
  }
});

// ----------------- Comprehensive Admin Endpoints -----------------

// 1. Overview & Live Telemetry
app.get('/api/admin/overview', requireAdmin, async (req, res) => {
  try {
    const uptimeSec = process.uptime();
    const memUsage = process.memoryUsage();

    // Live DB Health
    const dbHealth = await getDatabaseHealth();

    // Live Scraper Status
    const scraperHealth = await getScraperStatus();

    // Abuse incidents radar
    const abuseSummary = await getAbuseIncidents();

    const aiUsage = await getAiUsageStats();

    // Global Aggregated Metrics across all tenants
    const globalStats = await getGlobalAggregateStats();

    // In-Memory Active Search Jobs
    const activeSearchJobs = [];
    for (const [uid, job] of userSearchJobs.entries()) {
      if (job.status === 'running') {
        activeSearchJobs.push({
          userId: uid,
          query: job.query,
          currentCity: job.currentCity,
          progress: job.progress,
          leadsFound: job.leadsFound,
          targetGoal: job.targetGoal
        });
      }
    }

    // In-Memory Active Email Workers
    const activeEmailWorkers = [];
    for (const [uid, worker] of userEmailWorkers.entries()) {
      if (worker.status !== 'idle') {
        activeEmailWorkers.push({
          userId: uid,
          status: worker.status,
          lastSentTime: worker.lastSentTime
        });
      }
    }

    res.json({
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(uptimeSec),
        uptimeFormatted: formatUptime(uptimeSec),
        memory: {
          rssMb: Math.round(memUsage.rss / 1024 / 1024),
          heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024)
        },
        pid: process.pid,
        env: process.env.NODE_ENV || 'production'
      },
      database: dbHealth,
      scraper: {
        ...scraperHealth,
        url: SCRAPER_URL
      },
      aiUsage,
      liveWorkers: {
        activeSearchesCount: activeSearchJobs.length,
        activeEmailsCount: activeEmailWorkers.length,
        activeSearches: activeSearchJobs,
        activeEmails: activeEmailWorkers
      },
      globalStats,
      abuseSummary
    });
  } catch (err) {
    console.error('[Admin Overview Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Users Management
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await getAllUsersWithDetailedStats();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const userId = parseInt(req.params.id, 10);
    const updated = await updateUserRole(userId, role);

    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      action: 'USER_ROLE_CHANGED',
      category: 'admin',
      severity: 'info',
      details: `Permissão do bunker #${userId} (${updated?.email}) alterada para [${role}] pelo admin ${req.user.email}`
    });

    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const userId = parseInt(req.params.id, 10);
    const updated = await updateUserStatus(userId, status);

    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      action: 'USER_STATUS_CHANGED',
      category: 'admin',
      severity: status === 'suspended' ? 'warning' : 'info',
      details: `Status do bunker #${userId} (${updated?.email}) alterado para [${status}] pelo admin ${req.user.email}`
    });

    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users/:id/limit', requireAdmin, async (req, res) => {
  try {
    const { limit } = req.body;
    const userId = parseInt(req.params.id, 10);
    const updated = await updateUserDailyLimitOverride(userId, limit);

    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      action: 'USER_LIMIT_UPDATED',
      category: 'admin',
      severity: 'info',
      details: `Cota diária do bunker #${userId} (${updated?.email}) configurada para [${limit || 'Padrão Global'} leads/dia]`
    });

    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = parseInt(req.params.id, 10);
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }
    const hash = await hashPassword(password);
    const updated = await adminResetUserPassword(userId, hash);

    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      action: 'USER_PASSWORD_RESET',
      category: 'admin',
      severity: 'warning',
      details: `Senha de acesso do bunker #${userId} (${updated?.email}) redefinida pelo admin ${req.user.email}`
    });

    res.json({ success: true, message: 'Senha redefinida com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Você não pode excluir sua própria conta de administrador!' });
    }

    const targetUser = await getUserById(targetUserId);
    await deleteUserCascade(targetUserId);

    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      action: 'USER_DELETED',
      category: 'admin',
      severity: 'danger',
      details: `Bunker #${targetUserId} (${targetUser?.email || ''}) e toda sua base de dados foram excluídos permanentemente.`
    });

    res.json({ success: true, message: 'Bunker excluído com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users/:id/leads', requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const statusFilter = req.query.status !== undefined ? req.query.status : null;
    const search = req.query.search || null;

    const data = await getUserLeadsForAdmin(targetUserId, limit, offset, statusFilter, search);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin View & Edit User CV
app.get('/api/admin/users/:id/cv', requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const data = await getUserCvForAdmin(targetUserId);
    if (!data) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users/:id/cv', requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { cvData, cvRaw } = req.body;

    let cvDataString = '';
    if (cvRaw && typeof cvRaw === 'string') {
      cvDataString = cvRaw;
    } else if (cvData) {
      cvDataString = typeof cvData === 'string' ? cvData : JSON.stringify(cvData, null, 2);
    }

    // Validate JSON structure
    try {
      if (cvDataString && cvDataString.trim().length > 0) {
        JSON.parse(cvDataString);
      }
    } catch (parseErr) {
      return res.status(400).json({ error: 'Estrutura JSON do currículo inválida.' });
    }

    const updated = await saveUserCvForAdmin(targetUserId, cvDataString);

    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      action: 'admin_update_user_cv',
      category: 'admin',
      severity: 'info',
      details: `Admin ${req.user.email} atualizou o currículo do bunker ID #${targetUserId}`
    });

    res.json({ success: true, ...updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Supported Charity Institutions (Mini-CMS)
app.get('/api/admin/charities', requireAdmin, async (req, res) => {
  try {
    const institutions = await getCharityInstitutions({ includeInactive: true });
    res.json(institutions);
  } catch (err) {
    console.error('[Admin Charities GET Error]', err);
    res.status(500).json({ error: 'Não foi possível carregar as instituições.' });
  }
});

app.post('/api/admin/charities', requireAdmin, async (req, res) => {
  try {
    const normalized = normalizeCharityPayload(req.body);
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const institution = await createCharityInstitution(normalized.data);
    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      action: 'CHARITY_INSTITUTION_CREATED',
      category: 'admin',
      severity: 'info',
      details: `Instituição apoiada ${institution.name} adicionada por ${req.user.email}.`
    });

    res.status(201).json({ success: true, institution });
  } catch (err) {
    console.error('[Admin Charities POST Error]', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe uma instituição com esse nome.' });
    }
    res.status(500).json({ error: 'Não foi possível criar a instituição.' });
  }
});

app.put('/api/admin/charities/:id', requireAdmin, async (req, res) => {
  try {
    const institutionId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(institutionId) || institutionId <= 0) {
      return res.status(400).json({ error: 'ID de instituição inválido.' });
    }

    const current = await getCharityInstitutionById(institutionId);
    if (!current) {
      return res.status(404).json({ error: 'Instituição não encontrada.' });
    }

    const normalized = normalizeCharityPayload(req.body, current);
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const institution = await updateCharityInstitution(institutionId, normalized.data);
    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      action: 'CHARITY_INSTITUTION_UPDATED',
      category: 'admin',
      severity: 'info',
      details: `Instituição apoiada ${institution.name} atualizada por ${req.user.email}.`
    });

    res.json({ success: true, institution });
  } catch (err) {
    console.error('[Admin Charities PUT Error]', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe uma instituição com esse nome.' });
    }
    res.status(500).json({ error: 'Não foi possível atualizar a instituição.' });
  }
});

app.delete('/api/admin/charities/:id', requireAdmin, async (req, res) => {
  try {
    const institutionId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(institutionId) || institutionId <= 0) {
      return res.status(400).json({ error: 'ID de instituição inválido.' });
    }

    const institution = await deleteCharityInstitution(institutionId);
    if (!institution) {
      return res.status(404).json({ error: 'Instituição não encontrada.' });
    }

    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      action: 'CHARITY_INSTITUTION_DELETED',
      category: 'admin',
      severity: 'warning',
      details: `Instituição apoiada ${institution.name} removida por ${req.user.email}.`
    });

    res.json({ success: true, institution });
  } catch (err) {
    console.error('[Admin Charities DELETE Error]', err);
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'Essa instituição já foi usada em um cadastro. Desative-a em vez de removê-la.'
      });
    }
    res.status(500).json({ error: 'Não foi possível remover a instituição.' });
  }
});

// 4. System Global Settings
app.get('/api/admin/system-settings', requireAdmin, async (req, res) => {
  try {
    const settings = await getSystemSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/system-settings', requireAdmin, async (req, res) => {
  try {
    const updated = await saveSystemSettings(req.body);

    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      action: 'SYSTEM_SETTINGS_UPDATED',
      category: 'admin',
      severity: 'info',
      details: `Configurações globais do sistema alteradas por ${req.user.email}`
    });

    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Audit & Abuse Logs
app.get('/api/admin/logs', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;
    const category = req.query.category || null;
    const severity = req.query.severity || null;
    const search = req.query.search || null;
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : null;

    const data = await getAuditLogs({ limit, offset, category, severity, search, userId });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/logs/clear', requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.body.days, 10) || 30;
    const count = await clearAuditLogs(days);

    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      action: 'LOGS_CLEARED',
      category: 'admin',
      severity: 'warning',
      details: `${count} registros de logs anteriores a ${days} dias foram expurgados por ${req.user.email}`
    });

    res.json({ success: true, clearedCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/abuse', requireAdmin, async (req, res) => {
  try {
    const incidents = await getAbuseIncidents();
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Diagnostics & Maintenance Tools
app.post('/api/admin/system/optimize-db', requireAdmin, async (req, res) => {
  try {
    const result = await optimizeDatabase();
    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      action: 'DB_OPTIMIZED',
      category: 'system',
      severity: 'info',
      details: `Otimização do PostgreSQL (VACUUM ANALYZE) executada com sucesso.`
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/system/cleanup-uploads', requireAdmin, async (req, res) => {
  try {
    let deletedCount = 0;
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const f of files) {
        try {
          const fPath = path.join(uploadsDir, f);
          const stat = fs.statSync(fPath);
          // Delete files older than 24h
          if (Date.now() - stat.mtimeMs > 24 * 60 * 60 * 1000) {
            fs.unlinkSync(fPath);
            deletedCount++;
          }
        } catch (e) {}
      }
    }

    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      action: 'UPLOADS_CLEANED',
      category: 'system',
      severity: 'info',
      details: `${deletedCount} arquivos temporários antigos foram removidos do diretório de uploads.`
    });

    res.json({ success: true, deletedCount, message: `${deletedCount} arquivos temporários limpos com sucesso.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- Waitlist Endpoints -----------------
app.post('/api/waitlist', async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Nome e número são obrigatórios.' });
  }

  try {
    const { pool } = await import('./db.js');
    await pool.query(
      'INSERT INTO waitlist (name, phone, status) VALUES ($1, $2, $3)',
      [name.trim(), phone.trim(), 'pending']
    );
    res.json({ success: true, message: 'Sua inscrição foi recebida.' });
  } catch (err) {
    console.error('Waitlist POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/waitlist', requireAdmin, async (req, res) => {
  try {
    const { pool } = await import('./db.js');
    const result = await pool.query(
      'SELECT id, name, phone, status, created_at FROM waitlist ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Waitlist GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/waitlist/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }
  try {
    const { pool } = await import('./db.js');
    await pool.query('UPDATE waitlist SET status = $1 WHERE id = $2', [status, id]);
    res.json({ success: true, message: `Status alterado para ${status}.` });
  } catch (err) {
    console.error('Waitlist Status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------- Serve Frontend Assets in Production -----------------
const clientDist = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Start Server
app.listen(Number(PORT), process.env.HOST || '127.0.0.1', () => {
  console.log(`==================================================`);
  console.log(`🛡️ Bunker.Outrch Multi-Tenant Backend running on port ${PORT}`);
  console.log(`📦 Scraper URL: ${SCRAPER_URL}`);
  console.log(`🐘 PostgreSQL Connection Pool Active`);
  console.log(`==================================================`);
});
