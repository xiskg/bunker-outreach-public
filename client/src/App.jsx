import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard,
  Search,
  Users,
  Mail,
  Settings,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Trash2,
  FileText,
  Upload,
  FileCheck,
  HelpCircle,
  ExternalLink,
  Loader2,
  ChevronRight,
  MapPin,
  Languages,
  Globe,
  User,
  Plus,
  PlusCircle,
  MinusCircle,
  Code,
  Briefcase,
  X,
  LogOut,
  Shield,
  Bell,
  Sun,
  Moon,
  Menu
} from 'lucide-react';
import AuthScreen from './AuthScreen';
import AdminDashboard from './AdminDashboard';
import OperationsOverview from './OperationsOverview';
import CampaignWorkspace from './CampaignWorkspace';
import ReviewWorkspace from './ReviewWorkspace';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const TAB_PATHS = {
  dashboard: '/app/hoje',
  scraper: '/app/campanhas',
  leads: '/app/leads',
  queue: '/app/revisar',
  settings: '/app/configuracoes',
  admin: '/app/admin'
};
const TAB_LABELS = {
  dashboard: { section: 'Hoje', title: 'Visão da operação' },
  scraper: { section: 'Campanhas', title: 'Nova campanha' },
  leads: { section: 'Leads', title: 'Seu banco de leads' },
  queue: { section: 'Revisar', title: 'Mensagens para revisar' },
  settings: { section: 'Configurações', title: 'Preferências e integrações' },
  admin: { section: 'Admin', title: 'Visão administrativa' }
};

const tabFromLocation = () => {
  const matchingTab = Object.entries(TAB_PATHS).find(([, path]) => window.location.pathname === path);
  return matchingTab?.[0] || localStorage.getItem('bunker_active_tab') || 'dashboard';
};

export default function App() {
  // Authentication State
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('bunker_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => {
    return localStorage.getItem('bunker_auth_token') || null;
  });

  const [activeTab, setActiveTab] = useState(tabFromLocation);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigateToTab = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    const nextPath = TAB_PATHS[tab] || TAB_PATHS.dashboard;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ tab }, '', nextPath);
    }
  };

  useEffect(() => {
    const handleHistoryChange = () => setActiveTab(tabFromLocation());
    window.addEventListener('popstate', handleHistoryChange);
    return () => window.removeEventListener('popstate', handleHistoryChange);
  }, []);

  const [announcement, setAnnouncement] = useState(null);

  // Fetch broadcast announcement banner
  useEffect(() => {
    fetch(`${API_BASE}/api/announcement`)
      .then(r => r.json())
      .then(data => {
        if (data && data.active) {
          setAnnouncement(data);
        }
      })
      .catch(() => {});
  }, []);

  // Authenticated fetch wrapper
  const authFetch = useCallback(async (endpoint, options = {}) => {
    const currentToken = localStorage.getItem('bunker_auth_token');
    const headers = {
      ...(options.headers || {})
    };
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const response = await fetch(fullUrl, { ...options, headers });

    if (response.status === 401) {
      localStorage.removeItem('bunker_auth_token');
      localStorage.removeItem('bunker_user');
      setUser(null);
      setToken(null);
    }
    return response;
  }, []);

  // Sync user profile & permissions with server on mount or token change
  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (r) => {
        if (r.status === 401) {
          localStorage.removeItem('bunker_auth_token');
          localStorage.removeItem('bunker_user');
          setUser(null);
          setToken(null);
          return;
        }
        if (r.ok) {
          const data = await r.json();
          if (data && data.user) {
            setUser(data.user);
            localStorage.setItem('bunker_user', JSON.stringify(data.user));
          }
        }
      })
      .catch(() => {});
  }, [token]);

  // Persist tab change
  useEffect(() => {
    localStorage.setItem('bunker_active_tab', activeTab);
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.removeItem('bunker_auth_token');
    localStorage.removeItem('bunker_user');
    setUser(null);
    setToken(null);
    window.history.replaceState({}, '', '/');
  };

  const [settings, setSettings] = useState({
    gemini_key: '',
    groq_key: '',
    smtp_host: 'smtp.gmail.com',
    smtp_port: '465',
    smtp_user: '',
    smtp_pass: '',
    smtp_secure: 'true',
    cv_pdf_uploaded: 'false',
    auto_pilot: 'false',
    user_cv: '{}'
  });

  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    replied: 0,
    pending: 0,
    draftsCount: 0,
    queuedCount: 0,
    failedCount: 0
  });

  const [leads, setLeads] = useState([]);
  const [queue, setQueue] = useState([]);

  // Theme State
  const [theme, setTheme] = useState(localStorage.getItem('bunker_theme') || 'light');

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
    document.body.classList.toggle('bunker-app-body', Boolean(user && token));
    localStorage.setItem('bunker_theme', theme);
  }, [theme, token, user]);

  // CV Editor State
  const [cvJsonText, setCvJsonText] = useState('{}');
  const [cvEditorMode, setCvEditorMode] = useState('fields'); // 'fields' or 'json'
  const [cvData, setCvData] = useState({});

  // Helper to switch modes with explicit sync
  const toggleCvEditorMode = (mode) => {
    if (mode === 'json') {
      // Syncing fields -> json
      setCvJsonText(JSON.stringify(cvData, null, 2));
    } else {
      // Syncing json -> fields
      try {
        const parsed = JSON.parse(cvJsonText || '{}');
        setCvData(parsed);
      } catch {
        triggerNotification('JSON inválido. Corrija o código antes de voltar para o modo Visual.', 'error');
        return;
      }
    }
    setCvEditorMode(mode);
  };

  const candidateName = cvData?.personal_info?.name || 'Usuário';
  const candidateTitle = cvData?.personal_info?.title || 'Sem currículo';

  // Scraper State
  const [scraperStatus, setScraperStatus] = useState({
    status: 'stopped',
    python: { installed: false, version: null },
    installed: false,
    logs: []
  });
  const [searchJob, setSearchJob] = useState({
    status: 'idle',
    progress: 0,
    currentCity: '',
    cities: [],
    query: '',
    logs: []
  });
  const [scraperQuery, setScraperQuery] = useState('Brand Agency');
  const [scraperCountry, setScraperCountry] = useState('BR');
  const [scraperMaxResults, setScraperMaxResults] = useState(30);
  const [selectedCities, setSelectedCities] = useState(['São Paulo', 'Rio de Janeiro']);
  const [customCity, setCustomCity] = useState('');
  const [searchMode, setSearchMode] = useState('city'); // 'city' or 'country'
  const [searchGoal, setSearchGoal] = useState(30);
  const [dailyQuota, setDailyQuota] = useState({ dailyLimit: 50, usedToday: 0, remainingToday: 50, resetAt: '00:00' });

  // Worker State
  const [workerStatus, setWorkerStatus] = useState({
    status: 'idle',
    lastSentTime: null,
    logs: []
  });

  // App General UI
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);

  useEffect(() => {
    const resetTimer = setTimeout(() => setLoadingStage(0), 0);
    const interval = isLoading ? setInterval(() => {
        setLoadingStage((prev) => (prev + 1) % 4);
      }, 3500) : null;

    return () => {
      clearTimeout(resetTimer);
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  const loadingPhrases = [
    "Lendo suas competências...",
    "Treinando Inteligência Artificial...",
    "Estruturando seu perfil de vendas...",
    "Finalizando análise semântica..."
  ];

  const [statusMessage, setStatusMessage] = useState(null);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  // Helper to update deeply nested fields in cvData
  const updateCvField = (path, value) => {
    const newData = { ...cvData };
    const parts = path.split('.');
    let current = newData;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current[parts[i]] = { ...current[parts[i]] };
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
    setCvData(newData);
  };

  // Helper to add/remove items in CV lists
  const updateCvList = (path, action, index = -1, newItem = null) => {
    const newData = { ...cvData };
    const parts = path.split('.');
    let current = newData;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current[parts[i]] = { ...current[parts[i]] };
      current = current[parts[i]];
    }

    const targetArray = parts[parts.length - 1];
    if (!Array.isArray(current[targetArray])) current[targetArray] = [];
    else current[targetArray] = [...current[targetArray]];

    if (action === 'add') {
      current[targetArray].push(newItem);
    } else if (action === 'remove') {
      current[targetArray].splice(index, 1);
    } else if (action === 'update' && index >= 0) {
      current[targetArray][index] = newItem;
    }

    setCvData(newData);
  };

  // Helper specifically for nested lists (like responsibilities inside experience)
  const updateCvNestedList = (parentPath, parentIndex, listKey, action, index = -1, value = '') => {
    const newData = { ...cvData };
    const parts = parentPath.split('.');
    let current = newData;

    for (const part of parts) {
      if (!current[part]) current[part] = [];
      current = current[part];
    }

    const item = { ...current[parentIndex] };
    if (!Array.isArray(item[listKey])) item[listKey] = [];
    else item[listKey] = [...item[listKey]];

    if (action === 'add') item[listKey].push(value);
    else if (action === 'remove') item[listKey].splice(index, 1);
    else if (action === 'update') item[listKey][index] = value;

    current[parentIndex] = item;
    setCvData(newData);
  };

  // Onboarding Setup State
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);

  // Table state
  const [leadsPage, setLeadsPage] = useState(0);
  const [leadsSearch, setLeadsSearch] = useState('');
  const [leadsCountryFilter, setLeadsCountryFilter] = useState('ALL');
  const [queueCountryFilter, setQueueCountryFilter] = useState('ALL');

  const scraperLogEndRef = useRef(null);
  const workerLogEndRef = useRef(null);

  const popularCitiesByCountry = {
    BR: ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Salvador', 'Brasília', 'Fortaleza', 'Recife', 'Florianópolis'],
    CA: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton', 'Mississauga', 'Winnipeg', 'Quebec City', 'Hamilton'],
    US: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'],
    UK: ['London', 'Birmingham', 'Leeds', 'Glasgow', 'Sheffield', 'Bradford', 'Manchester', 'Edinburgh', 'Liverpool', 'Bristol'],
    PT: ['Lisbon', 'Porto', 'Vila Nova de Gaia', 'Amadora', 'Braga', 'Funchal', 'Coimbra', 'Setúbal', 'Almada', 'Aveiro']
  };

  const handleCountryChange = (countryCode) => {
    setScraperCountry(countryCode);
    const defaultCities = popularCitiesByCountry[countryCode]?.slice(0, 2) || [];
    setSelectedCities(defaultCities);
  };

  // Fetch metrics & stats
  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [token, authFetch]);

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setCvJsonText(data.user_cv);

        try {
          setCvData(JSON.parse(data.user_cv || '{}'));
        } catch (e) {
          console.error('Initial CV parse failed', e);
        }

        if (data.onboarding_completed !== 'true') {
          setShowOnboarding(true);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [token, authFetch, setShowOnboarding]);

  // Fetch Leads
  const fetchLeads = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch(`/api/leads?limit=50&offset=${leadsPage * 50}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [token, authFetch, leadsPage]);

  // Fetch Queue
  const fetchQueue = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/queue');
      if (res.ok) {
        const data = await res.json();
        setQueue(data);

        setSelectedDraft((currentDraft) => {
          if (!currentDraft) return currentDraft;
          return data.find((draft) => draft.id === currentDraft.id) || currentDraft;
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, [token, authFetch, setSelectedDraft]);

  // Fetch Scraper Status
  const fetchScraperStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/scraper/status');
      if (res.ok) {
        const data = await res.json();
        setScraperStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [authFetch]);

  // Fetch Search status
  const fetchSearchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/scraper/search/status');
      if (res.ok) {
        const data = await res.json();
        setSearchJob(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [token, authFetch]);

  // Fetch worker status
  const fetchWorkerStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/worker/status');
      if (res.ok) {
        const data = await res.json();
        setWorkerStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [token, authFetch]);

  // Fetch Daily Quota
  const fetchDailyQuota = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/scraper/quota');
      if (res.ok) {
        const data = await res.json();
        setDailyQuota(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [token, authFetch]);

  // Refresh only the data relevant to the current task. This keeps the CasaOS
  // instance quiet when the user is reading settings or admin pages.
  const fetchActiveData = useCallback(() => {
    const requests = [fetchStats()];

    if (activeTab === 'dashboard' || activeTab === 'scraper') {
      requests.push(fetchSearchStatus(), fetchScraperStatus(), fetchDailyQuota());
    }

    if (activeTab === 'dashboard' || activeTab === 'queue') {
      requests.push(fetchQueue(), fetchWorkerStatus());
    }

    if (activeTab === 'leads') {
      requests.push(fetchLeads());
    }

    return Promise.all(requests);
  }, [activeTab, fetchDailyQuota, fetchLeads, fetchQueue, fetchScraperStatus, fetchSearchStatus, fetchStats, fetchWorkerStatus]);

  useEffect(() => {
    if (!token) return undefined;
    const initialLoad = setTimeout(() => void fetchSettings(), 0);
    return () => clearTimeout(initialLoad);
  }, [fetchSettings, token]);

  // Task-scoped periodic refresh. It pauses while the browser tab is hidden.
  useEffect(() => {
    if (!token) return undefined;

    const initialRefresh = setTimeout(() => void fetchActiveData(), 0);

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void fetchActiveData();
    };
    const interval = setInterval(refreshIfVisible, 6000);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      clearTimeout(initialRefresh);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [fetchActiveData, token]);

  // Scroll to log bottom on change
  useEffect(() => {
    if (scraperLogEndRef.current) {
      scraperLogEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [searchJob.logs, scraperStatus.logs]);

  useEffect(() => {
    if (workerLogEndRef.current) {
      workerLogEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [workerStatus.logs]);

  // Action helpers
  const triggerNotification = (msg, type = 'success') => {
    setStatusMessage({ msg, type });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Trigger Google Maps Search Run
  const handleStartSearch = async () => {
    if (searchMode === 'city' && selectedCities.length === 0) {
      triggerNotification('Por favor, selecione ou adicione pelo menos uma cidade.', 'error');
      return;
    }

    try {
      const res = await authFetch('/api/scraper/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: scraperQuery,
          cities: selectedCities,
          country: scraperCountry,
          maxResults: scraperMaxResults,
          mode: searchMode,
          goal: Math.min(Math.max(parseInt(searchGoal) || 30, 5), 50)
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.limitWarning) {
          triggerNotification(data.limitWarning, 'warning');
        } else {
          triggerNotification(searchMode === 'country' ? `Busca nacional iniciada! Meta: ${Math.min(searchGoal, 50)} leads.` : 'Tarefa de busca em lote iniciada com sucesso.');
        }
        fetchSearchStatus();
      } else {
        triggerNotification('Erro no scraper: ' + data.error, 'error');
      }
    } catch (e) {
      triggerNotification('Erro de conexão: ' + e.message, 'error');
    }
  };

  const handleStopSearch = async () => {
    try {
      const res = await authFetch('/api/scraper/search/stop', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        triggerNotification('Tarefa de busca cancelada com sucesso.');
        fetchSearchStatus();
      }
    } catch (e) {
      triggerNotification(e.message, 'error');
    }
  };

  // Trigger Email worker toggle
  const handleToggleWorker = async (mode = 'drafting') => {
    let endpoint = 'start';
    if (workerStatus.status === mode) {
      endpoint = 'stop';
    } else if (workerStatus.status !== 'idle') {
      await authFetch('/api/worker/stop', { method: 'POST' });
    }

    try {
      const res = await authFetch(`/api/worker/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      const data = await res.json();
      if (data.success) {
        triggerNotification(`Motor de e-mail [${mode === 'drafting' ? 'Redação' : 'Envio'}] ${endpoint === 'start' ? 'iniciado' : 'parado'}.`);
        fetchWorkerStatus();
      }
    } catch (e) {
      triggerNotification(e.message, 'error');
    }
  };

  // Queue actions
  const handleApproveDraft = async (email, sendNow = false) => {
    const endpoint = sendNow ? 'send-now' : 'approve';
    try {
      const res = await authFetch(`/api/queue/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          subject: isEditingDraft ? editSubject : selectedDraft.draft_subject,
          body: isEditingDraft ? editBody : selectedDraft.draft_body
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerNotification(sendNow ? 'E-mail enviado para o servidor SMTP!' : 'E-mail aprovado e adicionado à fila de envio.');
        setSelectedDraft(null);
        setIsEditingDraft(false);
        fetchQueue();
        fetchStats();
      }
    } catch (e) {
      triggerNotification(e.message, 'error');
    }
  };

  const handleRejectDraft = async (email) => {
    try {
      const res = await authFetch('/api/queue/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) {
        triggerNotification('Rascunho rejeitado. Lead retornou para a lista de "Não Enviados".');
        setSelectedDraft(null);
        fetchQueue();
        fetchStats();
      }
    } catch (e) {
      triggerNotification(e.message, 'error');
    }
  };

  const handleRejectAllDrafts = async () => {
    if (!window.confirm('Tem certeza de que deseja rejeitar todos os rascunhos pendentes? Eles voltarão para a lista de "Não Enviados".')) return;
    try {
      const res = await authFetch('/api/queue/reject-all', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        triggerNotification('Todos os rascunhos foram rejeitados com sucesso!');
        setSelectedDraft(null);
        fetchQueue();
        fetchStats();
      }
    } catch (e) {
      triggerNotification(e.message, 'error');
    }
  };

  const handleDeleteLead = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este lead?')) return;
    try {
      const res = await authFetch(`/api/leads/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        triggerNotification('Lead excluído com sucesso.');
        fetchLeads();
        fetchStats();
      }
    } catch (e) {
      triggerNotification(e.message, 'error');
    }
  };

  const handleDeleteAllLeads = async () => {
    if (!window.confirm('🚨 CUIDADO: Isso excluirá TODOS os leads do seu banco de dados permanentemente. Tem certeza absoluta?')) return;
    try {
      setIsLoading(true);
      const res = await authFetch('/api/leads', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        triggerNotification('Banco de dados de leads limpo com sucesso.');
        fetchLeads();
        fetchStats();
        fetchQueue();
        setSelectedDraft(null);
      }
    } catch (e) {
      triggerNotification(e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };


  // Settings Save
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Sync to JSON string if we are in fields mode
    let finalCvJson = cvJsonText;
    if (cvEditorMode === 'fields') {
      finalCvJson = JSON.stringify(cvData, null, 2);
    }

    // Validate JSON CV
    try {
      JSON.parse(finalCvJson);
    } catch {
      triggerNotification('Estrutura JSON do currículo inválida. Por favor, corrija o formato.', 'error');
      setIsLoading(false);
      return;
    }

    try {
      const updatedSettings = {
        ...settings,
        user_cv: finalCvJson
      };

      const res = await authFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      const data = await res.json();
      if (data.success) {
        triggerNotification('Configurações salvas com sucesso!');
        setSettings(data.settings);
        setCvJsonText(finalCvJson);
      }
    } catch (e) {
      triggerNotification('Erro de conexão: ' + e.message, 'error');
    }
    setIsLoading(false);
  };

  const handleLanguageChange = async (newLang) => {
    const updatedSettings = { ...settings, target_language: newLang };
    setSettings(updatedSettings);
    try {
      const res = await authFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (e) {
      triggerNotification('Erro ao salvar idioma: ' + e.message, 'error');
    }
  };

  // Upload PDF File
  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type.includes('pdf'));
    if (!isPdf) {
      triggerNotification('Por favor, selecione um arquivo válido com extensão .pdf.', 'error');
      e.target.value = '';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      triggerNotification('O arquivo PDF excede o limite máximo de 15MB.', 'error');
      e.target.value = '';
      return;
    }

    setIsLoading(true);
    triggerNotification('Processando e analisando seu currículo PDF...', 'warning');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      try {
        const res = await authFetch('/api/cv/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 })
        });
        const data = await res.json();
        if (data.success) {
          triggerNotification(data.message || 'PDF do currículo carregado e salvo com sucesso!');
          if (data.settings) setSettings(data.settings);
          if (data.user_cv) setCvJsonText(JSON.stringify(data.user_cv, null, 2));
          fetchSettings();
        } else {
          triggerNotification('Falha no envio do PDF: ' + (data.error || 'Erro desconhecido'), 'error');
        }
      } catch (err) {
        triggerNotification('Erro de rede ao enviar PDF: ' + err.message, 'error');
      } finally {
        setIsLoading(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      triggerNotification('Falha ao ler o arquivo selecionado no seu navegador.', 'error');
      setIsLoading(false);
      e.target.value = '';
    };
  };

  // City checklist helper
  const handleCityCheckbox = (city) => {
    if (selectedCities.includes(city)) {
      setSelectedCities(selectedCities.filter(c => c !== city));
    } else {
      setSelectedCities([...selectedCities, city]);
    }
  };

  const handleAddCustomCity = () => {
    if (!customCity.trim()) return;
    const cleanCity = customCity.trim();
    if (!selectedCities.includes(cleanCity)) {
      setSelectedCities([...selectedCities, cleanCity]);
    }
    setCustomCity('');
  };

  // Helper status renderers
  const renderStatusBadge = (status) => {
    switch (status) {
      case 0: return <span className="badge badge-unsent">Novo</span>;
      case 1: return <span className="badge badge-sent">Enviado</span>;
      case 2: return <span className="badge badge-draft">Rascunho</span>;
      case 3: return <span className="badge badge-queued">Fila</span>;
      case 4: return <span className="badge badge-failed">Falhou</span>;
      case 5: return <span className="badge badge-failed">Erro IA</span>;
      default: return <span className="badge badge-unsent">Desconhecido</span>;
    }
  };

  const filteredLeads = leads.filter(l => {
    const search = leadsSearch.toLowerCase();
    const matchesSearch = l.name.toLowerCase().includes(search) || l.email.toLowerCase().includes(search) || (l.website && l.website.toLowerCase().includes(search));
    const leadCountry = l.country || 'BR';
    const matchesCountry = leadsCountryFilter === 'ALL' || leadCountry === leadsCountryFilter;
    return matchesSearch && matchesCountry;
  });

  const filteredQueue = queue.filter(l => {
    const leadCountry = l.country || 'BR';
    return queueCountryFilter === 'ALL' || leadCountry === queueCountryFilter;
  });

  if (!user || !token) {
    return (
      <AuthScreen
        onAuthSuccess={(authenticatedUser, authToken) => {
          setUser(authenticatedUser);
          setToken(authToken);
          navigateToTab('dashboard');
        }}
        apiBase={API_BASE}
      />
    );
  }

  const handleEmailChange = (e) => {
    const val = e.target.value;
    const newSettings = { ...settings, smtp_user: val };

    // Auto-detect based on domain
    if (val.endsWith('@gmail.com')) {
      newSettings.smtp_host = 'smtp.gmail.com';
      newSettings.smtp_port = '465';
      newSettings.smtp_secure = 'true';
    } else if (val.endsWith('@outlook.com') || val.endsWith('@hotmail.com')) {
      newSettings.smtp_host = 'smtp.office365.com';
      newSettings.smtp_port = '587';
      newSettings.smtp_secure = 'false';
    }

    setSettings(newSettings);
  };

  const getDerivedProvider = () => {
    if (settings?.smtp_host === 'smtp.gmail.com') return 'gmail';
    if (settings?.smtp_host === 'smtp.office365.com' || settings?.smtp_host === 'smtp-mail.outlook.com') return 'outlook';
    return 'custom';
  };
  const provider = getDerivedProvider();

  if (showOnboarding) {
    return (
      <div className="responsive-screen flex min-h-screen bg-dark-bg text-gray-100 font-sans items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-900/10 via-dark-bg to-dark-bg">
        <div className="w-full max-w-xl relative">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-cyber-cyan/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Global Notifications popup in Onboarding */}
          {statusMessage && (
          <div role={statusMessage.type === 'error' ? 'alert' : 'status'} aria-live={statusMessage.type === 'error' ? 'assertive' : 'polite'} className="fixed top-4 left-4 right-4 sm:top-6 sm:left-auto sm:right-6 z-50 flex items-center gap-3 px-4 sm:px-5 py-3.5 rounded-xl border shadow-2xl glass-panel animate-fade-in backdrop-blur-xl">
              {statusMessage.type === 'error' ? (
                <AlertTriangle size={18} className="text-red-400 shrink-0" />
              ) : statusMessage.type === 'warning' ? (
                <Loader2 size={18} className="text-amber-400 shrink-0 animate-spin" />
              ) : (
                <CheckCircle size={18} className="text-emerald-400 shrink-0" />
              )}
              <span className="text-xs font-semibold text-gray-100">{statusMessage.msg}</span>
            </div>
          )}

          {/* Step Progress Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-8 border-b border-dark-border pb-4 relative z-10">
            <div>
              <span className="text-[10px] text-brand-300 font-bold uppercase tracking-widest">Passo {Math.min(onboardingStep, 3)} de 3</span>
              <h1 className="text-xl font-extrabold text-white">
                {onboardingStep === 1 && "Iniciando sua Máquina de Prospecção"}
                {onboardingStep === 2 && "Treinando sua IA de Vendas"}
                {onboardingStep === 3 && "Conectando seu E-mail"}
              </h1>
            </div>
            {/* Progress Bubbles */}
            <div className="flex gap-1.5 self-end sm:self-auto" aria-label="Progresso da configuração">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all duration-300 ${onboardingStep === s ? 'bg-gradient-to-r from-brand-500 to-cyber-cyan w-12' : onboardingStep > s ? 'bg-brand-600 w-8' : 'bg-gray-800 w-8'}`}
                />
              ))}
            </div>
          </div>

          {/* Content body based on step */}
          <div className="flex-1 py-4 relative z-10">
            {onboardingStep === 1 && (
              <div className="space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyber-cyan flex items-center justify-center font-black text-true-white text-3xl shadow-shadow-glow mx-auto mb-4 animate-float">
                  🚀
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-lg font-bold text-gray-200">Chega de copiar e colar. Deixe a IA vender por você.</h2>
                  <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                    O Bunker faz o trabalho duro de minerar as empresas no Google Maps e escrever e-mails de vendas impecáveis e personalizados para cada lead, no piloto automático.
                  </p>
                </div>

                <div className="bg-dark-bg/50 border border-white/5 rounded-xl p-5 max-w-lg mx-auto flex flex-col gap-4">
                  <label className="text-xs font-bold text-gray-300 flex items-center justify-center gap-2">
                    <Globe size={14} className="text-brand-400" />
                    Em qual idioma você quer abordar seus clientes?
                  </label>
                  <select
                    value={settings.target_language || 'Portuguese'}
                    onChange={(e) => setSettings({ ...settings, target_language: e.target.value })}
                    className="glass-input text-sm font-medium py-3 text-center bg-dark-bg focus:bg-dark-surface"
                  >
                    <option value="Portuguese">Português 🇧🇷</option>
                    <option value="English">Inglês 🇺🇸</option>
                    <option value="Spanish">Espanhol 🇪🇸</option>
                    <option value="French">Francês 🇫🇷</option>
                    <option value="German">Alemão 🇩🇪</option>
                    <option value="Italian">Italiano 🇮🇹</option>
                  </select>
                </div>

                {/* Experimental Community Notice */}
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5 max-w-lg mx-auto text-left">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                    <AlertTriangle size={15} className="shrink-0 text-amber-400" />
                    <span>Ferramenta da Comunidade Bunker</span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    Sua conta tem um limite diário de uso. Não exigimos que você coloque suas próprias chaves de IA — tudo é processado gratuitamente pela chave global do nosso servidor!
                  </p>
                </div>
              </div>
            )}

            {onboardingStep === 2 && (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyber-cyan flex items-center justify-center font-black text-true-white text-3xl shadow-shadow-glow mx-auto mb-4 animate-float">
                  🧠
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-lg font-bold text-gray-200">Treinando a sua Inteligência Artificial</h2>
                  <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                    Para que a IA escreva e-mails que soem como você e destaquem as suas qualidades, precisamos conhecer a sua trajetória. Suba o seu currículo em PDF e nós faremos a leitura.
                  </p>
                </div>

                {/* Upload CV PDF */}
                <div className="mt-6 p-4 bg-black/20 border border-dark-border rounded-xl space-y-3 max-w-lg mx-auto">
                  <span className="text-xs text-gray-300 font-bold flex items-center justify-center gap-2">
                    <FileText size={14} className="text-brand-400" />
                    Envie seu Currículo em PDF
                  </span>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-dark-border hover:border-brand-500 rounded-xl py-6 cursor-pointer bg-black/10 hover:bg-black/20 transition-all">
                      {isLoading ? (
                        <>
                          <Loader2 className="text-brand-400 mb-2 animate-spin" size={26} />
                          <span className="text-xs font-bold text-brand-300 transition-all">{loadingPhrases[loadingStage]}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="text-gray-400 mb-2" size={26} />
                          <span className="text-sm font-bold text-gray-200">Clique para selecionar (.pdf)</span>
                          <span className="text-[10px] text-gray-500 mt-1">Nós extrairemos o que for mais relevante</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handlePdfUpload}
                        disabled={isLoading}
                        className="hidden"
                      />
                    </label>
                    <div className="text-center font-bold text-xs shrink-0 w-full sm:w-24">
                      {settings.cv_pdf_uploaded === 'true' ? (
                        <span className="text-emerald-400 flex flex-col items-center gap-0.5"><CheckCircle size={22}/> Carregado!</span>
                      ) : (
                        <span className="text-gray-500 flex flex-col items-center gap-0.5"><HelpCircle size={22}/> Opcional</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Candidate Profile Live Preview Card */}
                {(() => {
                  let parsedProfile = null;
                  try {
                    parsedProfile = JSON.parse(cvJsonText);
                  } catch {
                    // JSON inválido: não exibir a prévia até o conteúdo ser corrigido.
                  }

                  if (!parsedProfile || !parsedProfile.personal_info) return null;

                  return (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-brand-900/30 to-cyber-cyan/10 border border-brand-500/20 shadow-lg backdrop-blur-md relative overflow-hidden animate-fade-in">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/10 rounded-full blur-xl"></div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-wide">{parsedProfile.personal_info.name || "Seu Nome"}</h4>
                          <p className="text-[10px] font-bold text-cyber-cyan mt-0.5">{parsedProfile.personal_info.title || "Seu Cargo / Especialidade"}</p>
                          {parsedProfile.personal_info.location && (
                            <p className="text-[9px] text-gray-400 flex items-center gap-1 mt-1">
                              <MapPin size={10} className="text-gray-500" /> {parsedProfile.personal_info.location}
                            </p>
                          )}
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 uppercase tracking-widest">
                          Perfil Sincronizado
                        </span>
                      </div>

                      {parsedProfile.professional_summary && (
                        <p className="text-[10px] text-gray-300 mt-2.5 line-clamp-2 leading-relaxed border-t border-dark-border pt-2.5 italic">
                          "{parsedProfile.professional_summary}"
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* CV Profile JSON Editor (Collapsed/Preview) */}
                <div className="space-y-1.5">
                  <span className="text-xs text-gray-400 font-semibold flex items-center gap-2">
                    <Code size={13} className="text-yellow-500" />
                    Resumo Estruturado do Perfil
                  </span>
                  <textarea
                    value={cvJsonText}
                    onChange={(e) => setCvJsonText(e.target.value)}
                    rows={4}
                    className="glass-input font-mono text-[10px] w-full leading-relaxed resize-none bg-black/35 focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            {onboardingStep === 3 && (
              <div className="space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyber-cyan flex items-center justify-center font-black text-true-white text-3xl shadow-shadow-glow mx-auto mb-4 animate-float">
                  ✉️
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-lg font-bold text-gray-200">Conectando seu E-mail de Trabalho</h2>
                  <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                    O Bunker enviará os e-mails diretamente da sua conta, como se fosse você digitando, de forma orgânica e indetectável. Digite seu e-mail abaixo e nós configuramos os servidores automaticamente!
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-gray-300 font-semibold">Endereço de E-mail de Disparo</label>
                    <input
                      type="email"
                      value={settings.smtp_user || ''}
                      onChange={handleEmailChange}
                      placeholder="demo@example.com"
                      className="glass-input text-xs font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs text-gray-300 font-semibold">Senha de App</label>
                      {provider === 'gmail' && (
                        <a
                          href="https://support.google.com/accounts/answer/185833"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-brand-400 hover:underline flex items-center gap-1"
                        >
                          Como gerar? <ExternalLink size={10} />
                        </a>
                      )}
                      {provider === 'outlook' && (
                        <a
                          href="https://support.microsoft.com/pt-br/account-billing/gerenciar-senhas-de-aplicativos-para-a-verifica%C3%A7%C3%A3o-em-duas-etapas-d6dc8c6d-4bf7-4851-ad95-6d07799387e9"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-brand-400 hover:underline flex items-center gap-1"
                        >
                          Como gerar? <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <input
                      type="password"
                      value={settings.smtp_pass || ''}
                      onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                      placeholder="Senha de app do provedor"
                      className="glass-input text-xs font-mono"
                    />
                  </div>
                </div>

                {provider === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-dark-bg/50 border border-white/5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-gray-400 font-semibold">Servidor SMTP</label>
                      <input
                        type="text"
                        value={settings.smtp_host || ''}
                        onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                        placeholder="Ex: smtp.host.com"
                        className="glass-input text-xs font-mono bg-dark-surface/50"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-gray-400 font-semibold">Porta</label>
                      <input
                        type="text"
                        value={settings.smtp_port || ''}
                        onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                        placeholder="Ex: 465 ou 587"
                        className="glass-input text-xs font-mono bg-dark-surface/50"
                      />
                    </div>
                  </div>
                )}

                {provider === 'custom' && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center pt-2">
                    <span className="text-xs text-gray-400 font-semibold">Protocolo de Segurança</span>
                    <select
                      value={settings.smtp_secure || 'true'}
                      onChange={(e) => setSettings({ ...settings, smtp_secure: e.target.value })}
                      className="glass-input text-xs bg-dark-bg focus:bg-dark-surface"
                    >
                      <option value="true">Seguro (SSL/TLS - 465)</option>
                      <option value="false">Padrão (StartTLS - 587)</option>
                    </select>
                  </div>
                )}

                <div className="bg-black/25 border border-dark-border rounded-xl p-3 flex gap-3 justify-between items-center mt-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-200 font-bold">Modo Piloto Automático</span>
                    <span className="text-[10px] text-gray-500">Enviar mensagens automaticamente após redigir rascunhos.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, auto_pilot: settings.auto_pilot === 'true' ? 'false' : 'true' })}
                    className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 cursor-pointer ${settings.auto_pilot === 'true' ? 'bg-brand-600' : 'bg-gray-800'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.auto_pilot === 'true' ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Controls Footer */}
          <div className="mt-8 pt-4 border-t border-dark-border flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 relative z-10">
            {onboardingStep > 1 ? (
              <button
                onClick={() => setOnboardingStep(onboardingStep - 1)}
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Voltar
              </button>
            ) : (
              <div></div>
            )}

            {onboardingStep < 3 ? (
              <button
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const res = await authFetch('/api/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(settings)
                    });
                    const data = await res.json();
                    if (data.success) {
                      setSettings(data.settings);
                    }
                  } catch (err) {
                    console.error("[Erro no salvamento intermediário]", err);
                  }
                  setIsLoading(false);

                  setOnboardingStep(onboardingStep + 1);
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-true-white font-bold rounded-xl text-xs transition shadow-lg shadow-shadow-glow cursor-pointer"
              >
                Próximo Passo
              </button>
            ) : (
              <button
                onClick={async () => {
                  setIsLoading(true);
                  let parsedCv;
                  try {
                    parsedCv = JSON.parse(cvJsonText);
                  } catch {
                    parsedCv = {};
                  }

                  try {
                    const finalSettings = {
                      ...settings,
                      user_cv: JSON.stringify(parsedCv, null, 2),
                      onboarding_completed: 'true'
                    };

                    const res = await authFetch('/api/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(finalSettings)
                    });
                    const data = await res.json();
                    if (data.success) {
                      triggerNotification("Bunker.Outrch configurado com sucesso!");
                      setSettings(data.settings);
                      setShowOnboarding(false);
                      fetchStats();
                    } else {
                      triggerNotification("Falha ao finalizar configurações.", "error");
                    }
                  } catch (e) {
                    triggerNotification(e.message, "error");
                  }
                  setIsLoading(false);
                }}
                disabled={isLoading}
                className="w-full sm:w-auto px-8 py-2.5 bg-gradient-to-r from-cyber-cyan to-brand-500 text-black font-extrabold rounded-xl text-xs transition shadow-lg hover:scale-105 cursor-pointer"
              >
                {isLoading ? "Salvando..." : "Abrir Meu Bunker"}
              </button>
            )}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div data-theme={theme} className="app-shell bunker-app flex h-screen overflow-hidden bg-dark-bg text-gray-100 font-sans">

      {/* 1. Sidebar Navigation */}
      <aside className={`app-sidebar bunker-sidebar fixed inset-y-0 left-0 z-40 w-[min(18rem,calc(100vw-1rem))] h-full bg-dark-surface border-r border-dark-border flex flex-col justify-between shrink-0 transform transition-transform duration-200 lg:static lg:w-64 lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          {/* Logo */}
          <div className="bunker-sidebar-brand p-6 border-b border-dark-border flex flex-col justify-center gap-1.5 items-start">
            <img src="/Union.svg" alt="Bunker Logo" className="w-32 h-auto object-contain logo-image opacity-100" />
            <p className="bunker-sidebar-caption text-[10px] text-brand-500 uppercase tracking-[0.3em] font-mono pl-1">B2B Outbound</p>
          </div>

          {/* Navigation Links */}
          <nav className="bunker-nav p-4 space-y-1" aria-label="Navegação principal">
            <button
              onClick={() => navigateToTab('dashboard')}
              aria-current={activeTab === 'dashboard' ? 'page' : undefined}
              className={`bunker-nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${activeTab === 'dashboard' ? 'is-active bg-brand-600 text-true-white font-semibold' : 'text-gray-400 hover:bg-gray-800/40 hover:text-true-white'}`}
            >
              <LayoutDashboard size={18} />
              Hoje
            </button>
            <button
              onClick={() => navigateToTab('scraper')}
              aria-current={activeTab === 'scraper' ? 'page' : undefined}
              className={`bunker-nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${activeTab === 'scraper' ? 'is-active bg-brand-600 text-true-white font-semibold' : 'text-gray-400 hover:bg-gray-800/40 hover:text-true-white'}`}
            >
              <Search size={18} />
              Campanhas
            </button>
            <button
              onClick={() => navigateToTab('leads')}
              aria-current={activeTab === 'leads' ? 'page' : undefined}
              className={`bunker-nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${activeTab === 'leads' ? 'is-active bg-brand-600 text-true-white font-semibold' : 'text-gray-400 hover:bg-gray-800/40 hover:text-true-white'}`}
            >
              <Users size={18} />
              Leads
            </button>
            <button
              onClick={() => navigateToTab('queue')}
              aria-current={activeTab === 'queue' ? 'page' : undefined}
              className={`bunker-nav-item w-full flex items-center justify-between px-4 py-3 rounded-xl transition text-sm font-medium ${activeTab === 'queue' ? 'is-active bg-brand-600 text-true-white font-semibold' : 'text-gray-400 hover:bg-gray-800/40 hover:text-true-white'}`}
            >
              <span className="flex items-center gap-3">
                <Mail size={18} />
                Revisar
              </span>
              {(stats.draftsCount > 0 || stats.queuedCount > 0) && (
                <span className="bunker-nav-count px-2 py-0.5 bg-cyber-cyan text-black font-bold text-[10px] rounded-full" aria-label={`${stats.draftsCount + stats.queuedCount} itens pendentes`}>
                  {stats.draftsCount + stats.queuedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigateToTab('settings')}
              aria-current={activeTab === 'settings' ? 'page' : undefined}
              className={`bunker-nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${activeTab === 'settings' ? 'is-active bg-brand-600 text-true-white font-semibold' : 'text-gray-400 hover:bg-gray-800/40 hover:text-true-white'}`}
            >
              <Settings size={18} />
              Configurações
            </button>

            {/* Admin Command Center Link (Only for Admins) */}
            {user?.role === 'admin' && (
              <div className="bunker-admin-nav pt-2">
                <button
                  onClick={() => navigateToTab('admin')}
                  aria-current={activeTab === 'admin' ? 'page' : undefined}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition text-sm font-medium ${
                    activeTab === 'admin'
                      ? 'bunker-nav-item is-active bg-brand-600 text-true-white font-bold shadow-glow border border-brand-400/40'
                      : 'text-amber-300/90 hover:bg-amber-950/30 hover:text-amber-200 border border-amber-500/20'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Shield size={18} className="text-amber-400" />
                    Admin
                  </span>
                  <span className="bunker-admin-label px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[9px] font-bold rounded">
                    Gestão
                  </span>
                </button>
              </div>
            )}
          </nav>
        </div>

        {/* User Footer / Info */}
        <div className="bunker-sidebar-footer p-4 border-t border-dark-border bg-gray-950/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-purple-800 flex items-center justify-center text-xs font-bold border border-brand-500/30 text-true-white shadow-sm shrink-0">
                {(user?.name || candidateName).substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-200 truncate">{user?.name || candidateName}</p>
                <p className="text-[10px] text-gray-400 truncate">{user?.email || candidateTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title="Alternar Tema"
                className="min-h-11 min-w-11 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair da Conta (Logout)"
                className="min-h-11 min-w-11 p-2 text-white hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}

      {/* Main Content Area */}
      <main className="bunker-main flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Top Navbar */}
        <header className="app-mobile-topbar bunker-topbar min-h-16 border-b border-dark-border flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:h-16 lg:flex-nowrap lg:px-8 lg:py-0 bg-dark-surface/40 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Abrir menu"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(true)}
              className="min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-dark-border text-gray-300 hover:bg-white/5 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="bunker-breadcrumb flex min-w-0 items-center gap-2 truncate" aria-label="Localização atual">
            <span className="bunker-breadcrumb-section text-gray-500 font-medium capitalize">
              {TAB_LABELS[activeTab]?.section || 'Hoje'}
            </span>
            <ChevronRight size={14} aria-hidden="true" className="text-gray-600" />
            <span className="bunker-breadcrumb-title text-gray-200 font-semibold truncate">
              {TAB_LABELS[activeTab]?.title || TAB_LABELS.dashboard.title}
            </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Community Experimental Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="font-semibold text-[11px]">Beta Experimental</span>
              <span className="text-[10px] text-gray-400">• Achou bug? Avisa no Zap!</span>
            </div>

            {/* Onboarding Checks */}
            {!settings.smtp_pass && (
              <span className="hidden sm:flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-lg animate-pulse-slow">
                <AlertTriangle size={14} />
                Faltam chaves SMTP / API
              </span>
            )}

            {/* Active User Pill */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-brand-950/40 border border-brand-500/20 text-brand-300 text-xs rounded-lg">
                <Shield size={12} className={user.role === 'admin' ? 'text-amber-400' : 'text-brand-400'} />
                <span className="font-semibold text-gray-300">{user.name}</span>
                {user.role === 'admin' && (
                  <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold rounded">
                    ADM
                  </span>
                )}
                <span className="text-[10px] text-gray-500">({user.email})</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="min-h-11 flex items-center gap-1.5 px-3 py-1 text-xs text-white hover:text-rose-300 hover:bg-rose-950/30 border border-transparent hover:border-rose-500/20 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        {/* Global Broadcast Announcement Banner */}
        {announcement && announcement.active && (
          <div className={`px-4 sm:px-6 lg:px-8 py-2.5 text-xs font-medium flex items-start justify-between gap-3 border-b ${
            announcement.type === 'warning'
              ? 'bg-amber-950/50 border-amber-500/30 text-amber-200'
              : announcement.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-200'
              : 'bg-brand-950/60 border-brand-500/30 text-cyan-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <Bell size={14} className="animate-pulse shrink-0 text-amber-400" />
              <span>{announcement.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setAnnouncement(null)}
              className="min-h-11 min-w-11 flex items-center justify-center text-gray-400 hover:text-white p-1 rounded transition shrink-0"
              title="Fechar comunicado"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Global Notifications popup */}
        {statusMessage && (
          <div role={statusMessage.type === 'error' ? 'alert' : 'status'} aria-live={statusMessage.type === 'error' ? 'assertive' : 'polite'} className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg glass-panel animate-fade-in">
            {statusMessage.type === 'error' ? (
              <AlertTriangle size={18} className="text-red-500" />
            ) : statusMessage.type === 'warning' ? (
              <HelpCircle size={18} className="text-amber-500" />
            ) : (
              <CheckCircle size={18} className="text-emerald-500" />
            )}
            <span className="text-sm font-medium text-gray-200">{statusMessage.msg}</span>
          </div>
        )}

        {/* 2. Content Tabs */}
        <div className="bunker-content flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 lg:space-y-8">

          {/* TAB: TODAY */}
          {activeTab === 'dashboard' && (
            <OperationsOverview
              user={user}
              stats={stats}
              settings={settings}
              queue={queue}
              searchJob={searchJob}
              workerStatus={workerStatus}
              onNavigate={navigateToTab}
            />
          )}


          {/* TAB: CAMPAIGNS */}
          {activeTab === 'scraper' && (
            <div className="space-y-8">
              <div className="bunker-section-intro">
                <div>
                  <p className="bunker-kicker">Campanhas</p>
                  <h1>Crie uma campanha</h1>
                  <p>Escolha um nicho, uma região e o tamanho da busca. Você revisa os próximos passos antes de qualquer envio.</p>
                </div>
              </div>
              <CampaignWorkspace
                scraperStatus={scraperStatus}
                searchJob={searchJob}
                scraperQuery={scraperQuery}
                setScraperQuery={setScraperQuery}
                scraperCountry={scraperCountry}
                handleCountryChange={handleCountryChange}
                popularCitiesByCountry={popularCitiesByCountry}
                selectedCities={selectedCities}
                handleCityCheckbox={handleCityCheckbox}
                customCity={customCity}
                setCustomCity={setCustomCity}
                handleAddCustomCity={handleAddCustomCity}
                searchMode={searchMode}
                setSearchMode={setSearchMode}
                searchGoal={searchGoal}
                setSearchGoal={setSearchGoal}
                scraperMaxResults={scraperMaxResults}
                setScraperMaxResults={setScraperMaxResults}
                dailyQuota={dailyQuota}
                fetchScraperStatus={fetchScraperStatus}
                handleStartSearch={handleStartSearch}
                handleStopSearch={handleStopSearch}
                isLoading={isLoading}
                scraperLogEndRef={scraperLogEndRef}
                triggerNotification={triggerNotification}
              />
            </div>
          )}

          {/* TAB: LEADS */}
          {activeTab === 'leads' && (
            <div className="bunker-leads-panel glass-panel p-4 sm:p-6 space-y-6">

              {/* Header search bar filters */}
              <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 pb-6 border-b border-dark-border">
                <div>
                  <h3 className="text-lg font-bold text-gray-100">Leads</h3>
                  <p className="text-gray-400 text-xs">Todos os contatos únicos capturados para sua conta.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4 w-full md:w-auto">
                  <select
                    value={leadsCountryFilter}
                    onChange={(e) => setLeadsCountryFilter(e.target.value)}
                    className="glass-input text-xs w-full sm:min-w-[120px] bg-dark-bg focus:bg-dark-surface"
                  >
                    <option value="ALL">Todos Países</option>
                    <option value="BR">Brasil 🇧🇷</option>
                    <option value="CA">Canadá 🇨🇦</option>
                    <option value="US">Estados Unidos 🇺🇸</option>
                    <option value="UK">Reino Unido 🇬🇧</option>
                    <option value="PT">Portugal 🇵🇹</option>
                  </select>

                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-3 text-gray-500" size={16} />
                    <input
                      type="text"
                      value={leadsSearch}
                      onChange={(e) => setLeadsSearch(e.target.value)}
                      placeholder="Buscar empresa, email..."
                      className="glass-input text-xs pl-10 w-full"
                    />
                  </div>

                  <button
                    onClick={fetchLeads}
                    className="min-h-11 sm:min-h-0 p-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition"
                    title="Atualizar Lista"
                  >
                    <RefreshCw size={16} />
                  </button>

                  <button
                    onClick={handleDeleteAllLeads}
                    className="min-h-11 sm:min-h-0 p-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-500/20 rounded-lg transition sm:ml-2"
                    title="Excluir Todos os Leads"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Table rendering */}
              <div className="responsive-table overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-dark-border text-gray-400 font-semibold uppercase tracking-wider">
                      <th className="py-4 px-4">Nome da Empresa</th>
                      <th className="py-4 px-4 text-center">País</th>
                      <th className="py-4 px-4">Email do Lead</th>
                      <th className="py-4 px-4">Website</th>
                      <th className="py-4 px-4 text-center">Status</th>
                      <th className="py-4 px-4">Última Atualização</th>
                      <th className="py-4 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border text-gray-300 font-medium">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-20 text-center text-gray-500 italic">Nenhum lead encontrado com esses filtros. Inicie o scraper para coletar dados.</td>
                      </tr>
                    ) : (
                      filteredLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-800/10 transition-colors">
                          <td className="py-4 px-4 font-bold text-white">{lead.name}</td>
                          <td className="py-4 px-4 text-center font-bold text-cyber-cyan">{lead.country || 'BR'}</td>
                          <td className="py-4 px-4 font-mono">{lead.email}</td>
                          <td className="py-4 px-4 text-brand-400">
                            {lead.website ? (
                              <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                                {lead.website.replace(/^https?:\/\//i, '').substring(0, 30)}
                                <ExternalLink size={12} />
                              </a>
                            ) : '-'}
                          </td>
                          <td className="py-4 px-4 text-center">{renderStatusBadge(lead.email_sent)}</td>
                          <td className="py-4 px-4 text-gray-500 font-mono">{new Date(lead.last_update).toLocaleDateString('pt-BR')}</td>
                          <td className="py-4 px-4 text-center">
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 rounded transition"
                              title="Excluir Lead"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bunker-leads-mobile-list" aria-label="Lista de leads em formato compacto">
                {filteredLeads.length === 0 ? (
                  <div className="bunker-lead-mobile-empty">Nenhum lead encontrado com esses filtros.</div>
                ) : (
                  filteredLeads.map((lead) => (
                    <article className="bunker-lead-mobile-card" key={`mobile-${lead.id}`}>
                      <div className="bunker-lead-mobile-heading">
                        <div>
                          <h4>{lead.name}</h4>
                          <span>{lead.country || 'BR'}</span>
                        </div>
                        {renderStatusBadge(lead.email_sent)}
                      </div>
                      <a href={`mailto:${lead.email}`} className="bunker-lead-mobile-email">{lead.email}</a>
                      {lead.website && (
                        <a href={lead.website} target="_blank" rel="noreferrer" className="bunker-lead-mobile-site">
                          {lead.website.replace(/^https?:\/\//i, '').substring(0, 34)}
                          <ExternalLink size={13} aria-hidden="true" />
                        </a>
                      )}
                      <div className="bunker-lead-mobile-footer">
                        <span>{new Date(lead.last_update).toLocaleDateString('pt-BR')}</span>
                        <button type="button" onClick={() => handleDeleteLead(lead.id)} aria-label={`Excluir lead ${lead.name}`}>
                          <Trash2 size={15} aria-hidden="true" /> Excluir
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>

              {/* Table Pagination */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-4 border-t border-dark-border text-xs text-gray-400">
                <span>Exibindo 1-50 de {stats.total} leads totais</span>
                <div className="flex gap-2 sm:justify-end">
                  <button
                    disabled={leadsPage === 0}
                    onClick={() => setLeadsPage(leadsPage - 1)}
                    className="flex-1 sm:flex-none px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg transition"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={leads.length < 50}
                    onClick={() => setLeadsPage(leadsPage + 1)}
                    className="flex-1 sm:flex-none px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg transition"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* TAB: REVIEW INBOX */}
          {activeTab === 'queue' && (
            <div className="space-y-8">
              <div className="bunker-section-intro">
                <div>
                  <p className="bunker-kicker">Revisar</p>
                  <h1>Mensagens para revisar</h1>
                  <p>Leia cada abordagem, ajuste o que precisar e coloque na fila somente o que estiver pronto.</p>
                </div>
              </div>
              <ReviewWorkspace
                workerStatus={workerStatus}
                settings={settings}
                handleLanguageChange={handleLanguageChange}
                handleToggleWorker={handleToggleWorker}
                filteredQueue={filteredQueue}
                queueCountryFilter={queueCountryFilter}
                setQueueCountryFilter={setQueueCountryFilter}
                handleRejectAllDrafts={handleRejectAllDrafts}
                fetchQueue={fetchQueue}
                selectedDraft={selectedDraft}
                setSelectedDraft={setSelectedDraft}
                setIsEditingDraft={setIsEditingDraft}
                setEditSubject={setEditSubject}
                setEditBody={setEditBody}
                isEditingDraft={isEditingDraft}
                editSubject={editSubject}
                editBody={editBody}
                handleRejectDraft={handleRejectDraft}
                handleApproveDraft={handleApproveDraft}
                renderStatusBadge={renderStatusBadge}
                workerLogEndRef={workerLogEndRef}
              />
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="bunker-settings-workspace space-y-8">
              <div className="bunker-section-intro">
                <div>
                  <p className="bunker-kicker">Configurações</p>
                  <h1>Prepare seu espaço de trabalho</h1>
                  <p>Conecte o envio, revise seu perfil e deixe o Bunker pronto para escrever com a sua voz.</p>
                </div>
              </div>

              {/* Form Action (Movido para o Topo) */}
              <div className="bunker-settings-actionbar flex flex-col gap-4 glass-panel px-4 sm:px-6 py-4 border-b-2 border-brand-500/20 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-400 font-medium">Outreach Automático (Piloto Automático)</span>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, auto_pilot: settings.auto_pilot === 'true' ? 'false' : 'true' })}
                      className={`w-12 h-6 min-h-0 rounded-full p-1 transition-colors ${settings.auto_pilot === 'true' ? 'bg-brand-600' : 'bg-gray-800'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.auto_pilot === 'true' ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setOnboardingStep(1);
                      setShowOnboarding(true);
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-dark-border font-semibold rounded-xl text-xs transition"
                  >
                    Reabrir assistente de configuração
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full lg:w-auto px-8 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-true-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-shadow-glow"
                >
                  {isLoading && <Loader2 size={14} className="animate-spin" />}
                  Salvar alterações
                </button>
              </div>

              <div className="bunker-settings-grid grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left: SMTP Configuration */}
                <div className="bunker-settings-card glass-panel p-4 sm:p-6 space-y-6">
                  <h3 className="text-base font-bold text-gray-100 border-b border-dark-border pb-3 flex items-center gap-2">
                    <Mail size={18} className="text-brand-400" />
                    Envio de e-mail
                  </h3>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-gray-400 font-semibold">Endereço de E-mail de Disparo</label>
                      <input
                        type="email"
                        required
                        value={settings.smtp_user || ''}
                        onChange={handleEmailChange}
                        placeholder="demo@example.com"
                        className="glass-input text-xs font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-gray-400 font-semibold">Senha de App do SMTP</label>
                        {provider === 'gmail' && (
                          <a
                            href="https://support.google.com/accounts/answer/185833"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-brand-400 hover:underline flex items-center gap-1"
                          >
                            Como gerar? <ExternalLink size={10} />
                          </a>
                        )}
                        {provider === 'outlook' && (
                          <a
                            href="https://support.microsoft.com/pt-br/account-billing/gerenciar-senhas-de-aplicativos-para-a-verifica%C3%A7%C3%A3o-em-duas-etapas-d6dc8c6d-4bf7-4851-ad95-6d07799387e9"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-brand-400 hover:underline flex items-center gap-1"
                          >
                            Como gerar? <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                      <input
                        type="password"
                        required
                        value={settings.smtp_pass || ''}
                        onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                        placeholder={settings.smtp_pass ? '••••••••••••••••' : 'Digite a Senha de App'}
                        className="glass-input text-xs font-mono"
                      />
                    </div>
                  </div>

                  {provider === 'custom' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-gray-400 font-semibold">Servidor SMTP</label>
                          <input
                            type="text"
                            required
                            value={settings.smtp_host}
                            onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                            className="glass-input text-xs font-mono"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-gray-400 font-semibold">Porta SMTP</label>
                          <input
                            type="text"
                            required
                            value={settings.smtp_port}
                            onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                            className="glass-input text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center pt-2">
                        <span className="text-xs text-gray-400 font-semibold">Segurança (SSL/TLS)</span>
                        <select
                          value={settings.smtp_secure}
                          onChange={(e) => setSettings({ ...settings, smtp_secure: e.target.value })}
                        className="glass-input text-xs w-full sm:w-auto bg-dark-bg focus:bg-dark-surface"
                        >
                          <option value="true">Forçar Seguro (TLS - 465)</option>
                          <option value="false">Padrão / Nenhum (StartTLS)</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div className="flex flex-col gap-2 pt-4 border-t border-dark-border">
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                      <span className="text-xs text-gray-100 font-bold uppercase tracking-wider flex items-center gap-2">
                        <Languages size={14} className="text-cyber-cyan" />
                        Idioma Alvo da IA
                      </span>
                      <select
                        value={settings.target_language || 'Portuguese'}
                        onChange={(e) => setSettings({ ...settings, target_language: e.target.value })}
                        className="glass-input text-xs min-w-[140px]"
                      >
                        <option value="Portuguese">Português 🇧🇷</option>
                        <option value="English">Inglês 🇺🇸</option>
                        <option value="Spanish">Espanhol 🇪🇸</option>
                        <option value="French">Francês 🇫🇷</option>
                        <option value="German">Alemão 🇩🇪</option>
                        <option value="Italian">Italiano 🇮🇹</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-gray-500 italic">Isso comandará a IA a escrever todos os rascunhos no idioma escolhido.</p>
                  </div>
                </div>


                {/* Right: API Keys & CV PDF Upload */}
                <div className="bunker-settings-card glass-panel p-4 sm:p-6 space-y-6 flex flex-col justify-between">
                  <div className="space-y-6">
                    <h3 className="text-base font-bold text-gray-100 border-b border-dark-border pb-3 flex items-center gap-2">
                      <Settings size={18} className="text-cyber-cyan" />
                      Inteligência artificial
                    </h3>

                    <div className="p-4 bg-brand-950/20 border border-brand-500/20 rounded-xl flex items-start gap-3">
                      <Shield size={20} className="shrink-0 text-brand-400 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-gray-200 mb-1">Inteligência Artificial Global Integrada</h4>
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                          A plataforma usa um pool de chaves gerenciadas de forma centralizada pelo administrador para acesso a modelos avançados (OpenRouter / Gemini 2.0). Você não precisa trazer a sua própria chave.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CV Upload zone */}
                  <div className="pt-4 border-t border-dark-border space-y-4">
                    <span className="text-xs text-gray-400 font-semibold flex items-center gap-2">
                      <FileText size={16} className="text-brand-400" />
                      Anexar Currículo em PDF
                    </span>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                      <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-dark-border hover:border-brand-500 rounded-xl py-6 cursor-pointer bg-black/10 hover:bg-black/20 transition-all">
                        {isLoading ? (
                          <>
                            <Loader2 className="text-brand-400 mb-2 animate-spin" size={24} />
                            <span className="text-xs font-bold text-brand-300">Enviando e processando PDF...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="text-gray-400 mb-2" size={24} />
                            <span className="text-xs font-bold text-gray-200">Escolher arquivo PDF (.pdf)</span>
                            <span className="text-[10px] text-gray-500 mt-1">Máximo 15MB • Envie seu currículo atualizado</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handlePdfUpload}
                          disabled={isLoading}
                          className="hidden"
                        />
                      </label>

                      <div className="w-full sm:w-24 text-center">
                        {settings.cv_pdf_uploaded === 'true' ? (
                          <div className="flex flex-col items-center text-emerald-400 font-bold text-xs gap-1">
                            <CheckCircle size={28} />
                            Pronto
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-gray-500 font-bold text-xs gap-1">
                            <HelpCircle size={28} />
                            Sem PDF
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: Candidate CV Editor */}
              <div className="bunker-settings-card bunker-cv-card glass-panel p-4 sm:p-6 space-y-6 border-t-2 border-brand-500/20">
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center border-b border-dark-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 rounded-lg">
                      <FileText size={20} className="text-yellow-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-100">Perfil do Candidato</h3>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Dados para Personalização IA</p>
                    </div>
                  </div>

                  {/* Mode Toggle */}
                  <div className="flex bg-black/40 p-1 rounded-xl border border-dark-border shadow-inner">
                    <button
                      type="button"
                      onClick={() => toggleCvEditorMode('fields')}
                      className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${cvEditorMode === 'fields' ? 'bg-brand-600 text-true-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <User size={14} />
                      Visual
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCvEditorMode('json')}
                      className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${cvEditorMode === 'json' ? 'bg-brand-600 text-true-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <Code size={14} />
                      JSON
                    </button>
                  </div>
                </div>

                {cvEditorMode === 'json' ? (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg flex items-start gap-3">
                      <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-200/70 leading-relaxed italic">
                        <strong>Cuidado:</strong> Edições manuais no JSON precisam seguir a estrutura exata para não quebrar a geração da IA. Use o modo Visual se preferir segurança.
                      </p>
                    </div>
                    <textarea
                      value={cvJsonText}
                      onChange={(e) => setCvJsonText(e.target.value)}
                      rows={20}
                      className="glass-input font-mono text-[11px] w-full leading-relaxed resize-none bg-black/45 border-dark-border focus:border-brand-500 min-h-[400px]"
                    />
                  </div>
                ) : (
                  /* Visual Field Editor */
                  <div className="space-y-10 animate-fade-in pb-4">

                    {/* 1. Personal Info */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-brand-400 border-b border-dark-border/40 pb-2">
                        <User size={16} />
                        <h4 className="text-xs font-bold uppercase tracking-wider">Informações Pessoais</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-gray-500 font-bold uppercase">Nome Completo</label>
                          <input
                            type="text"
                            value={cvData.personal_info?.name || ''}
                            onChange={(e) => updateCvField('personal_info.name', e.target.value)}
                            className="glass-input text-xs"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-gray-500 font-bold uppercase">Título Profissional</label>
                          <input
                            type="text"
                            value={cvData.personal_info?.title || ''}
                            onChange={(e) => updateCvField('personal_info.title', e.target.value)}
                            placeholder="Ex: Senior Designer"
                            className="glass-input text-xs"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-gray-500 font-bold uppercase">Localização</label>
                          <input
                            type="text"
                            value={cvData.personal_info?.location || ''}
                            onChange={(e) => updateCvField('personal_info.location', e.target.value)}
                            placeholder="Cidade, País"
                            className="glass-input text-xs"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-gray-500 font-bold uppercase">Telefone</label>
                          <input
                            type="text"
                            value={cvData.personal_info?.phone || ''}
                            onChange={(e) => updateCvField('personal_info.phone', e.target.value)}
                            className="glass-input text-xs"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-gray-500 font-bold uppercase">E-mail Público</label>
                          <input
                            type="email"
                            value={cvData.personal_info?.email || ''}
                            onChange={(e) => updateCvField('personal_info.email', e.target.value)}
                            className="glass-input text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2. Web Links */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-cyber-cyan border-b border-dark-border/40 pb-2">
                        <Globe size={16} />
                        <h4 className="text-xs font-bold uppercase tracking-wider">Links & Portfólio</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {['linkedin', 'behance', 'github', 'portfolio'].map((key) => (
                          <div key={key} className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-gray-500 font-bold uppercase">{key}</label>
                            <input
                              type="text"
                              value={cvData.personal_info?.links?.[key] || ''}
                              onChange={(e) => updateCvField(`personal_info.links.${key}`, e.target.value)}
                              className="glass-input text-[11px] font-mono"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Professional Summary */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-yellow-500 border-b border-dark-border/40 pb-2">
                        <FileText size={16} />
                        <h4 className="text-xs font-bold uppercase tracking-wider">Resumo Profissional</h4>
                      </div>
                      <textarea
                        value={cvData.professional_summary || ''}
                        onChange={(e) => updateCvField('professional_summary', e.target.value)}
                        rows={6}
                        className="glass-input w-full text-xs leading-relaxed resize-y bg-black/20"
                      />
                    </div>

                    {/* 4. Experience */}
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-dark-border/40 pb-2">
                        <div className="flex items-center gap-2 text-brand-400">
                          <Briefcase size={16} />
                          <h4 className="text-xs font-bold uppercase tracking-wider">Experiência Profissional</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateCvList('professional_experience', 'add', -1, { title: '', company: '', start_date: '', end_date: '', responsibilities: [] })}
                          className="flex items-center gap-1.5 px-3 py-1 bg-brand-600/20 hover:bg-brand-600/30 text-brand-400 text-[10px] font-bold rounded-lg transition border border-brand-500/20"
                        >
                          <Plus size={12} /> ADICIONAR CARGO
                        </button>
                      </div>

                      <div className="space-y-6">
                        {(cvData.professional_experience || []).map((exp, idx) => (
                          <div key={idx} className="glass-panel p-5 space-y-4 border-l-2 border-brand-500/40 relative group">
                            <button
                              type="button"
                              onClick={() => updateCvList('professional_experience', 'remove', idx)}
                              className="absolute top-4 right-4 p-1.5 text-gray-600 hover:text-red-400 transition"
                            >
                              <Trash2 size={14} />
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Título do Cargo</label>
                                <input
                                  type="text"
                                  value={exp.title || ''}
                                  onChange={(e) => {
                                    const updated = { ...exp, title: e.target.value };
                                    updateCvList('professional_experience', 'update', idx, updated);
                                  }}
                                  className="glass-input text-xs font-bold"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Empresa</label>
                                <input
                                  type="text"
                                  value={exp.company || ''}
                                  onChange={(e) => {
                                    const updated = { ...exp, company: e.target.value };
                                    updateCvList('professional_experience', 'update', idx, updated);
                                  }}
                                  className="glass-input text-xs"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Início</label>
                                <input type="text" value={exp.start_date || ''} onChange={(e) => updateCvList('professional_experience', 'update', idx, { ...exp, start_date: e.target.value })} className="glass-input text-[10px]" placeholder="MM/AAAA" />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Fim</label>
                                <input type="text" value={exp.end_date || ''} onChange={(e) => updateCvList('professional_experience', 'update', idx, { ...exp, end_date: e.target.value })} className="glass-input text-[10px]" placeholder="MM/AAAA ou ATUAL" />
                              </div>
                            </div>

                            {/* Inner List: Responsibilities */}
                            <div className="space-y-2 pt-2">
                              <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest flex flex-wrap justify-between items-center gap-2">
                                Principais Responsabilidades & Conquistas
                                <button type="button" onClick={() => updateCvNestedList('professional_experience', idx, 'responsibilities', 'add')} className="text-cyber-cyan hover:text-white transition flex items-center gap-1">
                                  <PlusCircle size={10} /> Add
                                </button>
                              </label>
                              <div className="space-y-2">
                                {(exp.responsibilities || []).map((resp, rIdx) => (
                                  <div key={rIdx} className="flex gap-2 items-center">
                                    <input
                                      type="text"
                                      value={resp}
                                      onChange={(e) => updateCvNestedList('professional_experience', idx, 'responsibilities', 'update', rIdx, e.target.value)}
                                      className="glass-input text-[10px] flex-1 py-1"
                                    />
                                    <button type="button" onClick={() => updateCvNestedList('professional_experience', idx, 'responsibilities', 'remove', rIdx)} className="text-gray-600 hover:text-red-400">
                                      <MinusCircle size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 5. Education & Languages (Simplified Grid) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Education */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-dark-border/40 pb-2">
                          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                            <FileCheck size={16} /> Educação
                          </div>
                          <button type="button" onClick={() => updateCvList('education', 'add', -1, { degree: '', institution: '', start_date: '', end_date: '' })} className="text-[10px] text-indigo-400 hover:text-white flex items-center gap-1">
                            <PlusCircle size={12} /> Novo
                          </button>
                        </div>
                        <div className="space-y-4">
                          {(cvData.education || []).map((edu, idx) => (
                            <div key={idx} className="bg-black/20 p-4 rounded-xl border border-dark-border/50 relative space-y-3">
                              <button type="button" onClick={() => updateCvList('education', 'remove', idx)} className="absolute top-2 right-2 text-gray-700 hover:text-red-400"><X size={12} /></button>
                              <input type="text" value={edu.degree || ''} placeholder="Grau/Curso" onChange={(e) => updateCvList('education', 'update', idx, { ...edu, degree: e.target.value })} className="glass-input text-[11px] w-full font-bold" />
                              <input type="text" value={edu.institution || ''} placeholder="Instituição" onChange={(e) => updateCvList('education', 'update', idx, { ...edu, institution: e.target.value })} className="glass-input text-[10px] w-full" />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Languages */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-dark-border/40 pb-2">
                          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                            <Languages size={16} /> Idiomas
                          </div>
                          <button type="button" onClick={() => updateCvList('languages', 'add', -1, { language: '', proficiency: '' })} className="text-[10px] text-emerald-400 hover:text-white flex items-center gap-1">
                            <PlusCircle size={12} /> Novo
                          </button>
                        </div>
                        <div className="space-y-4">
                          {(cvData.languages || []).map((lang, idx) => (
                            <div key={idx} className="bg-black/20 p-4 rounded-xl border border-dark-border/50 relative flex gap-3 items-center">
                               <button type="button" onClick={() => updateCvList('languages', 'remove', idx)} className="absolute -top-1 -right-1 p-1 bg-red-900/20 text-red-500 rounded-full border border-red-500/20"><X size={8} /></button>
                               <input type="text" value={lang.language || ''} placeholder="Idioma" onChange={(e) => updateCvList('languages', 'update', idx, { ...lang, language: e.target.value })} className="glass-input text-[11px] flex-1 font-bold" />
                               <input type="text" value={lang.proficiency || ''} placeholder="Nível" onChange={(e) => updateCvList('languages', 'update', idx, { ...lang, proficiency: e.target.value })} className="glass-input text-[10px] w-24 text-center" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>


            </form>
          )}

          {/* TAB: ADMIN COMMAND CENTER (COMPLETASSO) */}
          {activeTab === 'admin' && (
            <AdminDashboard
              authFetch={authFetch}
              currentUser={user}
              onNotify={triggerNotification}
              apiBase={API_BASE}
            />
          )}
        </div>
      </main>

      <nav className="bunker-mobile-nav" aria-label="Navegação rápida">
        <button type="button" className={activeTab === 'dashboard' ? 'is-active' : ''} aria-current={activeTab === 'dashboard' ? 'page' : undefined} onClick={() => navigateToTab('dashboard')}>
          <LayoutDashboard size={18} aria-hidden="true" />
          <span>Hoje</span>
        </button>
        <button type="button" className={activeTab === 'scraper' ? 'is-active' : ''} aria-current={activeTab === 'scraper' ? 'page' : undefined} onClick={() => navigateToTab('scraper')}>
          <Search size={18} aria-hidden="true" />
          <span>Campanhas</span>
        </button>
        <button type="button" className={activeTab === 'leads' ? 'is-active' : ''} aria-current={activeTab === 'leads' ? 'page' : undefined} onClick={() => navigateToTab('leads')}>
          <Users size={18} aria-hidden="true" />
          <span>Leads</span>
        </button>
        <button type="button" className={activeTab === 'queue' ? 'is-active' : ''} aria-current={activeTab === 'queue' ? 'page' : undefined} onClick={() => navigateToTab('queue')}>
          <Mail size={18} aria-hidden="true" />
          <span>Revisar</span>
          {(stats.draftsCount > 0 || stats.queuedCount > 0) && <small>{stats.draftsCount + stats.queuedCount}</small>}
        </button>
        <button type="button" className={activeTab === 'settings' ? 'is-active' : ''} aria-current={activeTab === 'settings' ? 'page' : undefined} onClick={() => navigateToTab('settings')}>
          <Settings size={18} aria-hidden="true" />
          <span>Config.</span>
        </button>
      </nav>
    </div>
  );
}
