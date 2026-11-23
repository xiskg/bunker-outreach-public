import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

// Public demonstration never connects to an existing PostgreSQL service.
const demo = process.env.DEMO_MODE === 'true';
if (!demo && !process.env.DATABASE_URL) throw new Error('DATABASE_URL is required outside demo mode');
let pool;
if (demo) {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  const query = async (sql, params = []) => {
    if (!params.length && sql.trim().split(';').filter(x => x.trim()).length > 1) {
      const results = await db.exec(sql); return results.at(-1) || {rows: [], rowCount: 0};
    }
    return db.query(sql, params);
  };
  pool = {query, connect: async () => ({query, release() {}}), end: () => db.close()};
} else {
  pool = new Pool({connectionString: process.env.DATABASE_URL, max: 10});
  pool.on('error', () => console.error('PostgreSQL connection error'));
}
export { pool };

// Default CV Template
export const DEFAULT_CV_TEMPLATE = {
  personal_info: {
    name: "Seu Nome Completo",
    title: "Seu Cargo / Especialidade",
    location: "Cidade, País",
    phone: "+55 (00) 00000-0000",
    email: "demo@example.com",
    links: {
      linkedin: "",
      behance: "",
      github: "",
      portfolio: ""
    }
  },
  professional_summary: "Uma breve descrição do seu perfil profissional, conquistas e objetivos.",
  core_competencies: {
    brand_strategy_identity: [],
    visual_design: [],
    tools_software: [],
    leadership_collaboration: []
  },
  professional_experience: [],
  education: [],
  languages: []
};

// Initialize PostgreSQL database tables & indexes
export async function initDb() {
  const client = await pool.connect();
  try {
    console.log('\x1b[34m[POSTGRES]\x1b[0m Inicializando esquema de banco de dados multi-tenant...');

    // 0. Supported charity institutions
    await client.query(`
      CREATE TABLE IF NOT EXISTS charity_institutions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(160) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category VARCHAR(80) NOT NULL DEFAULT 'Instituição apoiada',
        website_url TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_charity_institutions_active_order
        ON charity_institutions(is_active, display_order, name);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_charity_institutions_name_lower
        ON charity_institutions(LOWER(name));
    `);

    // 1. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(20) DEFAULT 'pending',
        proof_path TEXT,
        proof_type VARCHAR(20) DEFAULT 'blood',
        institution_id INTEGER REFERENCES charity_institutions(id) ON DELETE RESTRICT,
        daily_limit_override INTEGER DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE
      );
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS proof_path TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS proof_type VARCHAR(20) DEFAULT 'blood';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_id INTEGER REFERENCES charity_institutions(id) ON DELETE RESTRICT;
    `);

    await client.query(`
      UPDATE users SET proof_type = 'blood' WHERE proof_type IS NULL;
    `);

    // Ensure status & daily_limit_override columns exist in users (migration safety)
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_limit_override INTEGER DEFAULT NULL;
    `);

    // Index for fast email lookup
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
    `);

    // 2. Settings Table (scoped by user_id)
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key VARCHAR(100) NOT NULL,
        value TEXT,
        CONSTRAINT unique_user_setting UNIQUE (user_id, key)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_settings_user_key ON settings(user_id, key);
    `);

    // 3. System Global Settings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default global system settings
    const defaultGlobalSettings = [
      { key: 'global_daily_leads_limit', value: '50' },
      { key: 'system_maintenance_mode', value: 'false' },
      { key: 'maintenance_message', value: 'O Bunker.Outrch está passando por uma breve manutenção preventiva. Voltamos em instantes!' },
      { key: 'announcement_banner_active', value: 'false' },
      { key: 'announcement_banner_text', value: '🚀 Nova versão do Bunker.Outrch ativa com painel de métricas avançado!' },
      { key: 'announcement_banner_type', value: 'info' },
      { key: 'default_cooldown_minutes', value: '30' },
      { key: 'allow_registrations', value: 'true' },
      { key: 'ai_default_provider', value: 'groq' },
      { key: 'max_scraper_concurrency', value: '2' }
    ];

    for (const item of defaultGlobalSettings) {
      await client.query(`
        INSERT INTO system_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO NOTHING
      `, [item.key, item.value]);
    }

    // 4. Audit & Abuse Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        user_email VARCHAR(255),
        ip_address VARCHAR(100),
        action VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        severity VARCHAR(20) DEFAULT 'info',
        details TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_cat ON audit_logs(category);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);

      CREATE TABLE IF NOT EXISTS ai_usage_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        model VARCHAR(100),
        tokens_used INTEGER DEFAULT 0,
        rate_limit_hits INTEGER DEFAULT 0,
        date DATE DEFAULT CURRENT_DATE,
        CONSTRAINT unique_user_model_date UNIQUE (user_id, model, date)
      );
      CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_date ON ai_usage_stats(date DESC);

      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure columns exist if table was created previously without them
    await client.query(`
      ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
    `);

    // 6. Provision isolated leads table for each existing user
    const usersRes = await client.query('SELECT id FROM users');
    for (const u of usersRes.rows) {
      const tableName = `leads_user_${u.id}`;
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          website TEXT,
          email VARCHAR(255) UNIQUE NOT NULL,
          country VARCHAR(10) DEFAULT 'BR',
          email_sent INTEGER DEFAULT 0,
          replied INTEGER DEFAULT 0,
          draft_subject TEXT,
          draft_body TEXT,
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${tableName}(email_sent);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_update ON ${tableName}(last_update DESC);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_created ON ${tableName}(created_at);
      `);

    }

    console.log('\x1b[32m[POSTGRES]\x1b[0m Tabelas individuais, logs de auditoria e configurações globais verificados com sucesso!');
  } catch (err) {
    console.error('\x1b[31m[POSTGRES INIT ERROR]\x1b[0m Falha ao inicializar o banco:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// Helper to get sanitized table name for user's isolated leads table
export function getUserLeadsTableName(userId) {
  const cleanId = Number(userId);
  if (!Number.isSafeInteger(cleanId) || cleanId <= 0) throw new Error('ID de usuário inválido para tabela de leads');
  return `leads_user_${cleanId}`;
}

// Ensure dedicated table exists for this user
export async function ensureUserLeadsTable(userId) {
  const tableName = getUserLeadsTableName(userId);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      website TEXT,
      email VARCHAR(255) UNIQUE NOT NULL,
      country VARCHAR(10) DEFAULT 'BR',
      email_sent INTEGER DEFAULT 0,
      replied INTEGER DEFAULT 0,
      draft_subject TEXT,
      draft_body TEXT,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${tableName}(email_sent);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_update ON ${tableName}(last_update DESC);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_created ON ${tableName}(created_at);
  `);
  return tableName;
}

// ----------------- User Management -----------------

export async function createUser(
  name,
  email,
  passwordHash,
  role = 'user',
  proofPath = null,
  proofType = 'blood',
  institutionId = null
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertUserRes = await client.query(`
      INSERT INTO users (name, email, password_hash, role, status, proof_path, proof_type, institution_id)
      VALUES ($1, LOWER($2), $3, $4, $5, $6, $7, $8)
      RETURNING id, name, email, role, status, created_at
    `, [name, email, passwordHash, role, 'pending', proofPath, proofType, institutionId]);

    const user = insertUserRes.rows[0];

    // Seed default settings for the new user
    const defaultSettings = [
      { key: 'user_cv', value: JSON.stringify(DEFAULT_CV_TEMPLATE, null, 2) },
      { key: 'gemini_key', value: '' },
      { key: 'groq_key', value: '' },
      { key: 'openrouter_key', value: '' },
      { key: 'smtp_host', value: 'smtp.gmail.com' },
      { key: 'smtp_port', value: '465' },
      { key: 'smtp_user', value: '' },
      { key: 'smtp_pass', value: '' },
      { key: 'smtp_secure', value: 'true' },
      { key: 'cv_pdf_uploaded', value: 'false' },
      { key: 'auto_pilot', value: 'false' },
      { key: 'target_language', value: 'Portuguese' }
    ];

    for (const setting of defaultSettings) {
      await client.query(`
        INSERT INTO settings (user_id, key, value)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, key) DO NOTHING
      `, [user.id, setting.key, setting.value]);
    }

    // Create isolated leads table for this new user
    const tableName = `leads_user_${user.id}`;
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        website TEXT,
        email VARCHAR(255) UNIQUE NOT NULL,
        country VARCHAR(10) DEFAULT 'BR',
        email_sent INTEGER DEFAULT 0,
        replied INTEGER DEFAULT 0,
        draft_subject TEXT,
        draft_body TEXT,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${tableName}(email_sent);
      CREATE INDEX IF NOT EXISTS idx_${tableName}_update ON ${tableName}(last_update DESC);
      CREATE INDEX IF NOT EXISTS idx_${tableName}_created ON ${tableName}(created_at);
    `);

    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') { // Unique constraint in Postgres
      return { error: 'EMAIL_EXISTS', message: 'Este e-mail já está cadastrado.' };
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function getUserByEmail(email) {
  const res = await pool.query(`
    SELECT id, name, email, password_hash, role, status, proof_path, proof_type, institution_id, daily_limit_override, created_at, last_login
    FROM users
    WHERE LOWER(email) = LOWER($1)
  `, [email]);
  return res.rows[0] || null;
}

export async function getUserById(id) {
  const res = await pool.query(`
    SELECT id, name, email, role, status, proof_path, proof_type, institution_id, daily_limit_override, created_at, last_login
    FROM users
    WHERE id = $1
  `, [id]);
  return res.rows[0] || null;
}

export async function updateUserLastLogin(id) {
  await pool.query(`
    UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1
  `, [id]);
}

// ----------------- Settings Helpers -----------------

export async function getSettings(userId) {
  const res = await pool.query(`
    SELECT key, value FROM settings WHERE user_id = $1
  `, [userId]);

  const settingsObj = {};
  for (const row of res.rows) {
    settingsObj[row.key] = row.value;
  }
  return settingsObj;
}

export async function saveSettings(userId, settingsObj) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(settingsObj)) {
      await client.query(`
        INSERT INTO settings (user_id, key, value)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, key)
        DO UPDATE SET value = EXCLUDED.value
      `, [userId, key, String(value)]);
    }
    await client.query('COMMIT');
    return getSettings(userId);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\x1b[31m[BANCO ERROR]\x1b[0m Falha ao salvar configurações do usuário ${userId}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ----------------- Leads Helpers (Per-User Dedicated Tables) -----------------

export async function addLead(userId, name, email, website, country = 'BR') {
  const tableName = await ensureUserLeadsTable(userId);
  try {
    const res = await pool.query(`
      INSERT INTO ${tableName} (name, email, website, country)
      VALUES ($1, LOWER($2), $3, $4)
      RETURNING id
    `, [name, email, website, country]);

    return { success: true, id: res.rows[0].id };
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation (email)
      return { success: false, error: 'Email already exists', duplicated: true };
    }
    console.error(`\x1b[31m[BANCO ERROR]\x1b[0m Falha ao salvar lead na tabela ${tableName}: ${error.message}`);
    throw error;
  }
}

export async function getLeads(userId, limit = 100, offset = 0) {
  const tableName = await ensureUserLeadsTable(userId);
  const res = await pool.query(`
    SELECT * FROM ${tableName}
    ORDER BY last_update DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);
  return res.rows;
}

export async function getLeadStats(userId) {
  const tableName = await ensureUserLeadsTable(userId);
  const res = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE email_sent = 1)::int AS sent,
      COUNT(*) FILTER (WHERE replied = 1)::int AS replied,
      COUNT(*) FILTER (WHERE email_sent = 0)::int AS pending,
      COUNT(*) FILTER (WHERE email_sent = 2)::int AS drafts_count,
      COUNT(*) FILTER (WHERE email_sent = 3)::int AS queued_count,
      COUNT(*) FILTER (WHERE email_sent = 4)::int AS failed_count
    FROM ${tableName}
  `);

  const row = res.rows[0] || {};
  return {
    total: row.total || 0,
    sent: row.sent || 0,
    replied: row.replied || 0,
    pending: row.pending || 0,
    draftsCount: row.drafts_count || 0,
    queuedCount: row.queued_count || 0,
    failedCount: row.failed_count || 0
  };
}

export async function getUnsentLeads(userId, limit = 50) {
  const tableName = await ensureUserLeadsTable(userId);
  const res = await pool.query(`
    SELECT * FROM ${tableName}
    WHERE email_sent = 0
    ORDER BY id ASC
    LIMIT $1
  `, [limit]);
  return res.rows;
}

export async function updateLeadStatus(userId, email, emailSent = null, replied = null) {
  const tableName = await ensureUserLeadsTable(userId);
  let setClauses = ['last_update = CURRENT_TIMESTAMP'];
  const params = [];
  let paramIdx = 1;

  if (emailSent !== null) {
    setClauses.push(`email_sent = $${paramIdx}`);
    params.push(emailSent ? 1 : 0);
    paramIdx++;
  }
  if (replied !== null) {
    setClauses.push(`replied = $${paramIdx}`);
    params.push(replied ? 1 : 0);
    paramIdx++;
  }

  params.push(email.toLowerCase());
  const query = `
    UPDATE ${tableName}
    SET ${setClauses.join(', ')}
    WHERE LOWER(email) = $${paramIdx}
  `;

  const res = await pool.query(query, params);
  return res.rowCount > 0;
}

export async function deleteLead(userId, id) {
  const tableName = await ensureUserLeadsTable(userId);
  const res = await pool.query(`
    DELETE FROM ${tableName} WHERE id = $1
  `, [id]);
  return res.rowCount > 0;
}

export async function deleteBatchLeads(userId, ids) {
  if (!ids || ids.length === 0) return 0;
  const tableName = await ensureUserLeadsTable(userId);
  const res = await pool.query(`
    DELETE FROM ${tableName} WHERE id = ANY($1::int[])
  `, [ids]);
  return res.rowCount;
}

export async function deleteAllLeads(userId) {
  const tableName = await ensureUserLeadsTable(userId);
  const res = await pool.query(`DELETE FROM ${tableName}`);
  return res.rowCount;
}

export async function saveDraft(userId, email, subject, body, errorMsg = null, status = 2) {
  const tableName = await ensureUserLeadsTable(userId);
  const res = await pool.query(`
    UPDATE ${tableName}
    SET draft_subject = $1, draft_body = $2, error_message = $3, email_sent = $4, last_update = CURRENT_TIMESTAMP
    WHERE LOWER(email) = LOWER($5)
  `, [subject, body, errorMsg, status, email]);
  return res.rowCount > 0;
}

export async function rejectAllDrafts(userId) {
  const tableName = await ensureUserLeadsTable(userId);
  const res = await pool.query(`
    UPDATE ${tableName}
    SET draft_subject = NULL, draft_body = NULL, error_message = NULL, email_sent = 0, last_update = CURRENT_TIMESTAMP
    WHERE email_sent IN (2, 3, 4)
  `);
  return res.rowCount > 0;
}

export async function getQueueLeads(userId) {
  const tableName = await ensureUserLeadsTable(userId);
  const res = await pool.query(`
    SELECT * FROM ${tableName}
    WHERE email_sent IN (2, 3, 4)
    ORDER BY last_update DESC
  `);
  return res.rows;
}

// Daily quota helper (count leads added today for a specific user)
export async function getDailyLeadsCount(userId) {
  const tableName = await ensureUserLeadsTable(userId);
  const res = await pool.query(`
    SELECT COUNT(*) as count
    FROM ${tableName}
    WHERE COALESCE(created_at, last_update) >= CURRENT_DATE
  `);
  return parseInt(res.rows[0]?.count || '0', 10);
}

// ----------------- System Global Settings -----------------

export async function getSystemSettings() {
  const res = await pool.query('SELECT key, value FROM system_settings');
  const obj = {};
  for (const r of res.rows) {
    obj[r.key] = r.value;
  }
  return obj;
}

export async function saveSystemSettings(settingsObj) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(settingsObj)) {
      await client.query(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
      `, [key, String(value)]);
    }
    await client.query('COMMIT');
    return getSystemSettings();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ----------------- Supported Charity Institutions -----------------

const charityInstitutionFields = `
  id,
  name,
  description,
  category,
  website_url,
  is_active,
  display_order,
  created_at,
  updated_at
`;

export async function getCharityInstitutions({ includeInactive = false } = {}) {
  const activeClause = includeInactive ? '' : 'WHERE is_active = TRUE';
  const res = await pool.query(`
    SELECT ${charityInstitutionFields}
    FROM charity_institutions
    ${activeClause}
    ORDER BY display_order ASC, name ASC, id ASC
  `);
  return res.rows;
}

export async function getCharityInstitutionById(id) {
  const res = await pool.query(`
    SELECT ${charityInstitutionFields}
    FROM charity_institutions
    WHERE id = $1
  `, [id]);
  return res.rows[0] || null;
}

export async function createCharityInstitution({
  name,
  description = '',
  category = 'Instituição apoiada',
  websiteUrl,
  isActive = true,
  displayOrder = 0
}) {
  const res = await pool.query(`
    INSERT INTO charity_institutions
      (name, description, category, website_url, is_active, display_order)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING ${charityInstitutionFields}
  `, [name, description, category, websiteUrl, isActive, displayOrder]);
  return res.rows[0];
}

export async function updateCharityInstitution(id, {
  name,
  description = '',
  category = 'Instituição apoiada',
  websiteUrl,
  isActive = true,
  displayOrder = 0
}) {
  const res = await pool.query(`
    UPDATE charity_institutions
    SET
      name = $1,
      description = $2,
      category = $3,
      website_url = $4,
      is_active = $5,
      display_order = $6,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
    RETURNING ${charityInstitutionFields}
  `, [name, description, category, websiteUrl, isActive, displayOrder, id]);
  return res.rows[0] || null;
}

export async function deleteCharityInstitution(id) {
  const res = await pool.query(`
    DELETE FROM charity_institutions
    WHERE id = $1
    RETURNING id, name
  `, [id]);
  return res.rows[0] || null;
}

// ----------------- Audit & Abuse Logging -----------------

export async function logAuditEvent({
  userId = null,
  userEmail = null,
  ipAddress = null,
  action,
  category = 'system',
  severity = 'info',
  details = ''
}) {
  try {
    const formattedDetails = typeof details === 'object' ? JSON.stringify(details) : String(details || '');
    await pool.query(`
      INSERT INTO audit_logs (user_id, user_email, ip_address, action, category, severity, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [userId, userEmail, ipAddress, action, category, severity, formattedDetails]);
  } catch (e) {
    console.error('Audit Log Error:', e);
  }
}

export async function logAiUsage(userId, model, tokensUsed = 0, isRateLimitHit = false) {
  try {
    const rateLimitInc = isRateLimitHit ? 1 : 0;
    await pool.query(`
      INSERT INTO ai_usage_stats (user_id, model, tokens_used, rate_limit_hits, date)
      VALUES ($1, $2, $3, $4, CURRENT_DATE)
      ON CONFLICT (user_id, model, date)
      DO UPDATE SET
        tokens_used = ai_usage_stats.tokens_used + EXCLUDED.tokens_used,
        rate_limit_hits = ai_usage_stats.rate_limit_hits + EXCLUDED.rate_limit_hits
    `, [userId, model, tokensUsed, rateLimitInc]);
  } catch (err) {
    console.error('[DB] Erro ao registrar uso de IA:', err);
  }
}

export async function getAiUsageStats() {
  const res = await pool.query(`
    SELECT u.name, u.email, a.model, a.date, a.tokens_used, a.rate_limit_hits
    FROM ai_usage_stats a
    JOIN users u ON u.id = a.user_id
    ORDER BY a.date DESC, a.tokens_used DESC
    LIMIT 100
  `);
  return res.rows;
}

export async function getAuditLogs({
  limit = 100,
  offset = 0,
  category = null,
  severity = null,
  search = null,
  userId = null
} = {}) {
  const whereClauses = [];
  const params = [];
  let pIdx = 1;

  if (category && category !== 'all') {
    whereClauses.push(`category = $${pIdx}`);
    params.push(category);
    pIdx++;
  }

  if (severity && severity !== 'all') {
    whereClauses.push(`severity = $${pIdx}`);
    params.push(severity);
    pIdx++;
  }

  if (userId) {
    whereClauses.push(`user_id = $${pIdx}`);
    params.push(userId);
    pIdx++;
  }

  if (search && search.trim().length > 0) {
    whereClauses.push(`(
      LOWER(action) LIKE $${pIdx} OR
      LOWER(COALESCE(user_email, '')) LIKE $${pIdx} OR
      LOWER(COALESCE(details, '')) LIKE $${pIdx} OR
      LOWER(COALESCE(ip_address, '')) LIKE $${pIdx}
    )`);
    params.push(`%${search.trim().toLowerCase()}%`);
    pIdx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get total matching
  const countRes = await pool.query(`SELECT COUNT(*)::int as total FROM audit_logs ${whereSql}`, params);
  const total = countRes.rows[0]?.total || 0;

  // Get paginated rows
  params.push(limit);
  const limitIdx = pIdx++;
  params.push(offset);
  const offsetIdx = pIdx++;

  const logsRes = await pool.query(`
    SELECT * FROM audit_logs
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `, params);

  return {
    logs: logsRes.rows,
    total,
    limit,
    offset
  };
}

export async function clearAuditLogs(olderThanDays = 30) {
  const res = await pool.query(`
    DELETE FROM audit_logs
    WHERE created_at < CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL
  `, [olderThanDays]);
  return res.rowCount;
}

export async function getAbuseIncidents() {
  // 1. Failed logins in last 24h
  const failedLoginsRes = await pool.query(`
    SELECT COUNT(*)::int as count
    FROM audit_logs
    WHERE action = 'LOGIN_FAILED' AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
  `);

  // 2. Quota breached attempts in last 24h
  const quotaBreachRes = await pool.query(`
    SELECT COUNT(*)::int as count
    FROM audit_logs
    WHERE action = 'SEARCH_QUOTA_EXCEEDED' AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
  `);

  // 3. Email dispatch failures in last 24h
  const emailErrorsRes = await pool.query(`
    SELECT COUNT(*)::int as count
    FROM audit_logs
    WHERE action = 'EMAIL_SEND_FAILED' AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
  `);

  // 4. Rate limit hits in last 24h
  const rateLimitsRes = await pool.query(`
    SELECT COUNT(*)::int as count
    FROM audit_logs
    WHERE action = 'RATE_LIMIT_HIT' AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
  `);

  // 5. Recent high-severity security logs
  const recentAlertsRes = await pool.query(`
    SELECT *
    FROM audit_logs
    WHERE severity IN ('danger', 'warning') AND created_at >= CURRENT_TIMESTAMP - INTERVAL '48 hours'
    ORDER BY created_at DESC
    LIMIT 20
  `);

  return {
    failedLogins24h: failedLoginsRes.rows[0]?.count || 0,
    quotaBreaches24h: quotaBreachRes.rows[0]?.count || 0,
    emailErrors24h: emailErrorsRes.rows[0]?.count || 0,
    rateLimits24h: rateLimitsRes.rows[0]?.count || 0,
    recentAlerts: recentAlertsRes.rows
  };
}

// ----------------- Multi-Tenant Detailed Admin Telemetry -----------------

export async function getAllUsersWithDetailedStats() {
  const usersRes = await pool.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.status,
      u.proof_path,
      u.proof_type,
      u.institution_id,
      ci.name AS institution_name,
      u.daily_limit_override,
      u.created_at,
      u.last_login
    FROM users u
    LEFT JOIN charity_institutions ci ON ci.id = u.institution_id
    ORDER BY u.id ASC
  `);

  const enrichedUsers = [];

  for (const u of usersRes.rows) {
    const tableName = `leads_user_${u.id}`;
    let leadStats = {
      total: 0,
      sent: 0,
      replied: 0,
      pending: 0,
      drafts: 0,
      queued: 0,
      failed: 0,
      scrapedToday: 0,
      lastUpdate: null
    };

    try {
      const statsRes = await pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE email_sent = 1)::int AS sent,
          COUNT(*) FILTER (WHERE replied = 1)::int AS replied,
          COUNT(*) FILTER (WHERE email_sent = 0)::int AS pending,
          COUNT(*) FILTER (WHERE email_sent = 2)::int AS drafts,
          COUNT(*) FILTER (WHERE email_sent = 3)::int AS queued,
          COUNT(*) FILTER (WHERE email_sent = 4)::int AS failed,
          COUNT(*) FILTER (WHERE COALESCE(created_at, last_update) >= CURRENT_DATE)::int AS scraped_today,
          MAX(last_update) as last_update
        FROM ${tableName}
      `);

      if (statsRes.rows.length > 0) {
        const row = statsRes.rows[0];
        leadStats = {
          total: row.total || 0,
          sent: row.sent || 0,
          replied: row.replied || 0,
          pending: row.pending || 0,
          drafts: row.drafts || 0,
          queued: row.queued || 0,
          failed: row.failed || 0,
          scrapedToday: row.scraped_today || 0,
          lastUpdate: row.last_update
        };
      }
    } catch (tblErr) {
      // Table may not have been queried yet
    }

    enrichedUsers.push({
      ...u,
      stats: leadStats
    });
  }

  return enrichedUsers;
}

export async function getGlobalAggregateStats() {
  const users = await getAllUsersWithDetailedStats();

  let totalUsers = users.length;
  let activeUsersCount = users.filter(u => u.status === 'active').length;
  let suspendedUsersCount = users.filter(u => u.status === 'suspended').length;
  let loggedInTodayCount = users.filter(u => {
    if (!u.last_login) return false;
    const loginDate = new Date(u.last_login);
    const today = new Date();
    return loginDate.toDateString() === today.toDateString();
  }).length;

  let totalLeads = 0;
  let totalSent = 0;
  let totalReplied = 0;
  let totalPending = 0;
  let totalDrafts = 0;
  let totalQueued = 0;
  let totalFailed = 0;
  let totalScrapedToday = 0;

  for (const u of users) {
    totalLeads += u.stats.total;
    totalSent += u.stats.sent;
    totalReplied += u.stats.replied;
    totalPending += u.stats.pending;
    totalDrafts += u.stats.drafts;
    totalQueued += u.stats.queued;
    totalFailed += u.stats.failed;
    totalScrapedToday += u.stats.scrapedToday;
  }

  const responseRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : '0.0';
  const deliverySuccessRate = (totalSent + totalFailed) > 0 ? ((totalSent / (totalSent + totalFailed)) * 100).toFixed(1) : '100.0';

  return {
    users: {
      total: totalUsers,
      active: activeUsersCount,
      suspended: suspendedUsersCount,
      loggedInToday: loggedInTodayCount
    },
    leads: {
      total: totalLeads,
      scrapedToday: totalScrapedToday,
      sent: totalSent,
      replied: totalReplied,
      pending: totalPending,
      drafts: totalDrafts,
      queued: totalQueued,
      failed: totalFailed,
      responseRate: `${responseRate}%`,
      deliverySuccessRate: `${deliverySuccessRate}%`
    }
  };
}

// ----------------- User Management Actions (Admin) -----------------

export async function updateUserRole(userId, newRole) {
  const role = newRole === 'admin' ? 'admin' : 'user';
  const res = await pool.query(`
    UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role, status
  `, [role, userId]);
  return res.rows[0] || null;
}

export async function updateUserStatus(userId, newStatus) {
  const status = newStatus === 'suspended' ? 'suspended' : 'active';
  const res = await pool.query(`
    UPDATE users SET status = $1 WHERE id = $2 RETURNING id, name, email, role, status
  `, [status, userId]);
  return res.rows[0] || null;
}

export async function updateUserDailyLimitOverride(userId, limitOverride) {
  const cleanLimit = limitOverride === null || limitOverride === undefined || limitOverride === '' || isNaN(parseInt(limitOverride, 10)) || parseInt(limitOverride, 10) <= 0
    ? null
    : parseInt(limitOverride, 10);

  const res = await pool.query(`
    UPDATE users SET daily_limit_override = $1 WHERE id = $2 RETURNING id, name, email, role, status, daily_limit_override
  `, [cleanLimit, userId]);
  return res.rows[0] || null;
}

export async function adminResetUserPassword(userId, newPasswordHash) {
  const res = await pool.query(`
    UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, name, email
  `, [newPasswordHash, userId]);
  return res.rows[0] || null;
}

export async function deleteUserCascade(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop user leads table
    const tableName = `leads_user_${userId}`;
    await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);

    // Delete settings & user record (settings has ON DELETE CASCADE from users)
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getUserLeadsForAdmin(userId, limit = 50, offset = 0, statusFilter = null, search = null) {
  const tableName = await ensureUserLeadsTable(userId);
  const whereClauses = [];
  const params = [];
  let pIdx = 1;

  if (statusFilter !== null && statusFilter !== 'all') {
    whereClauses.push(`email_sent = $${pIdx}`);
    params.push(parseInt(statusFilter, 10));
    pIdx++;
  }

  if (search && search.trim().length > 0) {
    whereClauses.push(`(
      LOWER(name) LIKE $${pIdx} OR
      LOWER(email) LIKE $${pIdx} OR
      LOWER(COALESCE(website, '')) LIKE $${pIdx}
    )`);
    params.push(`%${search.trim().toLowerCase()}%`);
    pIdx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRes = await pool.query(`SELECT COUNT(*)::int as total FROM ${tableName} ${whereSql}`, params);
  const total = countRes.rows[0]?.total || 0;

  params.push(limit);
  const limitIdx = pIdx++;
  params.push(offset);
  const offsetIdx = pIdx++;

  const leadsRes = await pool.query(`
    SELECT * FROM ${tableName}
    ${whereSql}
    ORDER BY last_update DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `, params);

  return {
    leads: leadsRes.rows,
    total,
    limit,
    offset
  };
}

export async function getUserCvForAdmin(userId) {
  const userRes = await pool.query('SELECT id, name, email, role, status FROM users WHERE id = $1', [userId]);
  if (userRes.rowCount === 0) {
    return null;
  }
  const settings = await getSettings(userId);
  let cvData = {};
  if (settings.user_cv) {
    try {
      cvData = JSON.parse(settings.user_cv);
    } catch (e) {
      cvData = { raw: settings.user_cv };
    }
  }
  return {
    user: userRes.rows[0],
    cvData,
    userCvRaw: settings.user_cv || ''
  };
}

export async function saveUserCvForAdmin(userId, cvDataString) {
  await pool.query(`
    INSERT INTO settings (user_id, key, value)
    VALUES ($1, 'user_cv', $2)
    ON CONFLICT (user_id, key)
    DO UPDATE SET value = EXCLUDED.value
  `, [userId, cvDataString]);
  return getUserCvForAdmin(userId);
}

// ----------------- Database Diagnostic & Health -----------------

export async function getDatabaseHealth() {
  const client = await pool.connect();
  const startTime = Date.now();
  try {
    const pingRes = await client.query('SELECT 1 as ping, NOW() as current_time, version() as pg_version');
    const latency = Date.now() - startTime;

    // Database size
    const dbSizeRes = await client.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size,
             pg_database_size(current_database()) as size_bytes
    `);

    // Table count
    const tableCountRes = await client.query(`
      SELECT COUNT(*)::int as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);

    return {
      status: 'connected',
      latencyMs: latency,
      pgVersion: pingRes.rows[0]?.pg_version,
      serverTime: pingRes.rows[0]?.current_time,
      dbSize: dbSizeRes.rows[0]?.size || '0 MB',
      dbSizeBytes: dbSizeRes.rows[0]?.size_bytes || 0,
      totalTables: tableCountRes.rows[0]?.count || 0,
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    };
  } catch (err) {
    return {
      status: 'error',
      latencyMs: Date.now() - startTime,
      error: err.message
    };
  } finally {
    client.release();
  }
}

export async function optimizeDatabase() {
  const client = await pool.connect();
  const start = Date.now();
  try {
    // VACUUM ANALYZE users, system_settings, audit_logs
    await client.query('VACUUM ANALYZE users;');
    await client.query('VACUUM ANALYZE system_settings;');
    await client.query('VACUUM ANALYZE audit_logs;');

    // Also optimize each user leads table
    const usersRes = await client.query('SELECT id FROM users');
    for (const u of usersRes.rows) {
      try {
        await client.query(`VACUUM ANALYZE leads_user_${u.id};`);
      } catch (e) {}
    }

    const durationMs = Date.now() - start;
    return { success: true, durationMs, message: `Banco de dados e ${usersRes.rows.length} tabelas otimizados com sucesso em ${durationMs}ms.` };
  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
