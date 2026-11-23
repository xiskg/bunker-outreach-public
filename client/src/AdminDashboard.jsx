import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Server,
  Database,
  Activity,
  Users,
  Mail,
  Search,
  RefreshCw,
  AlertTriangle,
  Clock,
  Key,
  Trash2,
  Settings,
  Sliders,
  Bell,
  Eye,
  Zap,
  TrendingUp,
  BarChart3,
  HardDrive,
  UserCheck,
  UserX,
  Radio,
  Loader2,
  X,
  Check,
  Edit2,
  AlertOctagon,
  Send,
  FileText,
  Plus,
  PlusCircle,
  MinusCircle,
  Code,
  Briefcase,
  GraduationCap,
  Globe,
  FileCheck,
  Droplets,
  HeartHandshake,
  ExternalLink
} from 'lucide-react';

const EMPTY_CHARITY_FORM = {
  name: '',
  category: 'Instituição apoiada',
  description: '',
  websiteUrl: '',
  displayOrder: 0,
  isActive: true
};

const getCharityInitials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'IN';

const getCharityDomain = (url = '') => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export default function AdminDashboard({ authFetch, currentUser, onNotify, apiBase = '' }) {
  // Navigation inside Admin Panel
  const [adminTab, setAdminTab] = useState('overview'); // 'overview', 'users', 'metrics', 'abuse', 'settings'
  const [autoRefreshSec, setAutoRefreshSec] = useState(30); // 0 (off), 10, 30, 60
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data States
  const [overview, setOverview] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [auditLogsData, setAuditLogsData] = useState({ logs: [], total: 0, limit: 50, offset: 0 });
  const [systemSettings, setSystemSettings] = useState(null);
  const [waitlistData, setWaitlistData] = useState([]);
  const [charityInstitutions, setCharityInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proofModalUrl, setProofModalUrl] = useState(null);
  const [charityEditorOpen, setCharityEditorOpen] = useState(false);
  const [editingCharity, setEditingCharity] = useState(null);
  const [charityForm, setCharityForm] = useState(EMPTY_CHARITY_FORM);
  const [charitySaving, setCharitySaving] = useState(false);
  const [charityDeletingId, setCharityDeletingId] = useState(null);

  // Filter & Search States
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');

  const [logCategoryFilter, setLogCategoryFilter] = useState('all');
  const [logSeverityFilter, setLogSeverityFilter] = useState('all');
  const [logSearch, setLogSearch] = useState('');
  const [logPage, setLogPage] = useState(0);

  // Modals States
  const [quotaModalUser, setQuotaModalUser] = useState(null);
  const [newQuotaValue, setNewQuotaValue] = useState('');

  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');

  const [inspectModalUser, setInspectModalUser] = useState(null);
  const [userLeadsData, setUserLeadsData] = useState({ leads: [], total: 0, limit: 25, offset: 0 });
  const [inspectStatusFilter, setInspectStatusFilter] = useState('all');
  const [inspectSearch, setInspectSearch] = useState('');
  const [inspectLoading, setInspectLoading] = useState(false);

  const [deleteModalUser, setDeleteModalUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // CV Inspection & Edit Modal State
  const [cvModalUser, setCvModalUser] = useState(null);
  const [cvData, setCvData] = useState({});
  const [cvJsonText, setCvJsonText] = useState('');
  const [cvEditorTab, setCvEditorTab] = useState('visual'); // 'visual' | 'json'
  const [cvLoading, setCvLoading] = useState(false);
  const [cvSaving, setCvSaving] = useState(false);

  // Toast trigger helper
  const notify = useCallback((msg, type = 'info') => {
    if (onNotify) onNotify(msg, type);
  }, [onNotify]);

  // Fetch Overview Data
  const fetchOverview = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/overview');
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (err) {
      console.error('Error fetching admin overview:', err);
    }
  }, [authFetch]);

  // Fetch Users Data
  const fetchUsers = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error('Error fetching admin users:', err);
    }
  }, [authFetch]);

  // Fetch Audit Logs Data
  const fetchAuditLogs = useCallback(async (page = logPage) => {
    try {
      const params = new URLSearchParams({
        limit: '50',
        offset: String(page * 50),
        category: logCategoryFilter,
        severity: logSeverityFilter,
        search: logSearch
      });
      const res = await authFetch(`/api/admin/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogsData(data);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    }
  }, [authFetch, logCategoryFilter, logSeverityFilter, logSearch, logPage]);

  // Fetch System Settings
  const fetchSystemSettings = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/system-settings');
      if (res.ok) {
        const data = await res.json();
        setSystemSettings(data);
      }
    } catch (err) {
      console.error('Error fetching system settings:', err);
    }
  }, [authFetch]);

  // Fetch Waitlist
  const fetchWaitlist = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/waitlist');
      if (res.ok) {
        const data = await res.json();
        setWaitlistData(data);
      }
    } catch (err) {
      console.error('Error fetching waitlist:', err);
    }
  }, [authFetch]);

  // Fetch supported charity institutions for the mini-CMS
  const fetchCharityInstitutions = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/charities');
      if (res.ok) {
        const data = await res.json();
        setCharityInstitutions(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching charity institutions:', err);
    }
  }, [authFetch]);

  const openCharityEditor = (institution = null) => {
    setEditingCharity(institution);
    setCharityForm(institution ? {
      name: institution.name || '',
      category: institution.category || 'Instituição apoiada',
      description: institution.description || '',
      websiteUrl: institution.website_url || '',
      displayOrder: institution.display_order || 0,
      isActive: institution.is_active !== false
    } : { ...EMPTY_CHARITY_FORM });
    setCharityEditorOpen(true);
  };

  const closeCharityEditor = () => {
    setCharityEditorOpen(false);
    setEditingCharity(null);
    setCharityForm({ ...EMPTY_CHARITY_FORM });
  };

  const handleSaveCharity = async (e) => {
    e.preventDefault();
    if (!charityForm.name.trim() || !charityForm.websiteUrl.trim()) {
      notify('Informe o nome e o link oficial da instituição.', 'warning');
      return;
    }

    setCharitySaving(true);
    const isEditing = Boolean(editingCharity);
    try {
      const endpoint = isEditing ? `/api/admin/charities/${editingCharity.id}` : '/api/admin/charities';
      const res = await authFetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...charityForm,
          displayOrder: Number(charityForm.displayOrder) || 0
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        notify(data.error || 'Não foi possível salvar a instituição.', 'error');
        return;
      }

      notify(isEditing ? 'Instituição atualizada com sucesso!' : 'Instituição adicionada à curadoria.', 'success');
      closeCharityEditor();
      await fetchCharityInstitutions();
    } catch (err) {
      notify(`Erro ao salvar instituição: ${err.message}`, 'error');
    } finally {
      setCharitySaving(false);
    }
  };

  const handleToggleCharity = async (institution) => {
    try {
      const res = await authFetch(`/api/admin/charities/${institution.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: institution.name,
          category: institution.category,
          description: institution.description,
          websiteUrl: institution.website_url,
          displayOrder: institution.display_order,
          isActive: !institution.is_active
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        notify(data.error || 'Não foi possível alterar a visibilidade.', 'error');
        return;
      }
      notify(institution.is_active ? 'Instituição ocultada do cadastro.' : 'Instituição publicada no cadastro.', 'success');
      await fetchCharityInstitutions();
    } catch (err) {
      notify(`Erro ao alterar visibilidade: ${err.message}`, 'error');
    }
  };

  const handleDeleteCharity = async (institution) => {
    if (!window.confirm(`Remover ${institution.name} da curadoria? Cadastros existentes não serão apagados.`)) return;
    setCharityDeletingId(institution.id);
    try {
      const res = await authFetch(`/api/admin/charities/${institution.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || data.error) {
        notify(data.error || 'Não foi possível remover a instituição.', 'error');
        return;
      }
      notify('Instituição removida da curadoria.', 'success');
      await fetchCharityInstitutions();
    } catch (err) {
      notify(`Erro ao remover instituição: ${err.message}`, 'error');
    } finally {
      setCharityDeletingId(null);
    }
  };



  // Fetch all primary admin data
  const loadAllAdminData = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    await Promise.all([
      fetchOverview(),
      fetchUsers(),
      fetchAuditLogs(logPage),
      fetchSystemSettings(),
      fetchWaitlist(),
      fetchCharityInstitutions()
    ]);
    setLoading(false);
    if (showIndicator) setIsRefreshing(false);
  }, [fetchOverview, fetchUsers, fetchAuditLogs, fetchSystemSettings, fetchWaitlist, fetchCharityInstitutions, logPage]);

  // Initial Load
  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void loadAllAdminData();
    }, 0);
    return () => clearTimeout(initialLoad);
  }, [loadAllAdminData]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefreshSec || autoRefreshSec <= 0) return;
    const interval = setInterval(() => {
      loadAllAdminData(false);
    }, autoRefreshSec * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshSec, loadAllAdminData]);

  // User Actions
  const handleToggleRole = async (targetUser) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    if (targetUser.id === currentUser?.id && newRole === 'user') {
      notify('Você não pode remover seu próprio privilégio de administrador!', 'warning');
      return;
    }

    if (!window.confirm(`Tem certeza que deseja alterar a permissão de ${targetUser.name} para ${newRole.toUpperCase()}?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/admin/users/${targetUser.id}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        notify(`Permissão de ${targetUser.name} alterada para ${newRole.toUpperCase()}.`, 'success');
        fetchUsers();
        fetchOverview();
      } else {
        const err = await res.json();
        notify(err.error || 'Erro ao alterar permissão.', 'error');
      }
    } catch {
      notify('Erro de comunicação com o servidor.', 'error');
    }
  };

  const handleToggleStatus = async (targetUser) => {
    let newStatus = 'active';
    let displayStatus = 'ATIVO';
    if (targetUser.status === 'active') { newStatus = 'suspended'; displayStatus = 'SUSPENSO'; }
    else if (targetUser.status === 'suspended') { newStatus = 'active'; displayStatus = 'ATIVO'; }
    else if (targetUser.status === 'pending') { newStatus = 'active'; displayStatus = 'ATIVO (Aprovado)'; }

    if (targetUser.id === currentUser?.id && newStatus === 'suspended') {
      notify('Você não pode suspender sua própria conta!', 'warning');
      return;
    }

    if (!window.confirm(`Tem certeza que deseja alterar o status de ${targetUser.name} para ${displayStatus}?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/admin/users/${targetUser.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        notify(`Bunker de ${targetUser.name} agora está ${displayStatus}.`, 'success');
        fetchUsers();
        fetchOverview();
      } else {
        const err = await res.json();
        notify(err.error || 'Erro ao alterar status.', 'error');
      }
    } catch {
      notify('Erro de comunicação com o servidor.', 'error');
    }
  };

  const handleSaveQuota = async () => {
    if (!quotaModalUser) return;
    setActionLoading(true);
    try {
      const limitVal = newQuotaValue.trim() === '' ? null : parseInt(newQuotaValue, 10);
      const res = await authFetch(`/api/admin/users/${quotaModalUser.id}/limit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: limitVal })
      });
      if (res.ok) {
        notify(`Cota diária de ${quotaModalUser.name} atualizada com sucesso!`, 'success');
        setQuotaModalUser(null);
        fetchUsers();
      } else {
        notify('Falha ao atualizar cota do usuário.', 'error');
      }
    } catch {
      notify('Erro ao salvar cota.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!passwordModalUser || !newPasswordValue) return;
    if (newPasswordValue.length < 6) {
      notify('A senha deve conter pelo menos 6 caracteres.', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      const res = await authFetch(`/api/admin/users/${passwordModalUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPasswordValue })
      });
      if (res.ok) {
        notify(`Senha do bunker #${passwordModalUser.id} redefinida com sucesso!`, 'success');
        setPasswordModalUser(null);
        setNewPasswordValue('');
      } else {
        const err = await res.json();
        notify(err.error || 'Falha ao redefinir senha.', 'error');
      }
    } catch {
      notify('Erro ao redefinir senha.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteModalUser) return;
    setActionLoading(true);
    try {
      const res = await authFetch(`/api/admin/users/${deleteModalUser.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        notify(`Bunker de ${deleteModalUser.name} e todos os leads excluídos com sucesso.`, 'success');
        setDeleteModalUser(null);
        fetchUsers();
        fetchOverview();
      } else {
        const err = await res.json();
        notify(err.error || 'Falha ao excluir usuário.', 'error');
      }
    } catch {
      notify('Erro ao excluir usuário.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ----------------- CV Management Handlers -----------------
  const openCvModal = async (u) => {
    setCvModalUser(u);
    setCvLoading(true);
    setCvEditorTab('visual');
    try {
      const res = await authFetch(`/api/admin/users/${u.id}/cv`);
      if (res.ok) {
        const data = await res.json();
        setCvData(data.cvData || {});
        setCvJsonText(JSON.stringify(data.cvData || {}, null, 2));
      } else {
        notify('Não foi possível carregar o currículo deste bunker.', 'error');
      }
    } catch (e) {
      notify('Erro ao buscar currículo: ' + e.message, 'error');
    } finally {
      setCvLoading(false);
    }
  };

  const updateCvField = (section, field, value) => {
    const newData = { ...cvData };
    if (!newData[section]) newData[section] = {};
    if (typeof newData[section] === 'object' && !Array.isArray(newData[section])) {
      newData[section][field] = value;
    } else {
      newData[section] = value;
    }
    setCvData(newData);
    setCvJsonText(JSON.stringify(newData, null, 2));
  };

  const updateCvList = (section, action, index, itemData) => {
    const newData = { ...cvData };
    if (!Array.isArray(newData[section])) {
      newData[section] = [];
    }
    if (action === 'add') {
      newData[section].push(itemData);
    } else if (action === 'remove') {
      newData[section].splice(index, 1);
    } else if (action === 'update') {
      newData[section][index] = itemData;
    }
    setCvData(newData);
    setCvJsonText(JSON.stringify(newData, null, 2));
  };

  const updateCvNestedList = (section, itemIndex, nestedField, action, nestedIndex, value) => {
    const newData = { ...cvData };
    if (!newData[section] || !newData[section][itemIndex]) return;
    if (!Array.isArray(newData[section][itemIndex][nestedField])) {
      newData[section][itemIndex][nestedField] = [];
    }
    if (action === 'add') {
      newData[section][itemIndex][nestedField].push(value || 'Nova responsabilidade/conquista');
    } else if (action === 'remove') {
      newData[section][itemIndex][nestedField].splice(nestedIndex, 1);
    } else if (action === 'update') {
      newData[section][itemIndex][nestedField][nestedIndex] = value;
    }
    setCvData(newData);
    setCvJsonText(JSON.stringify(newData, null, 2));
  };

  const handleSaveUserCv = async () => {
    if (!cvModalUser) return;
    setCvSaving(true);

    let finalJson = cvJsonText;
    if (cvEditorTab === 'visual') {
      finalJson = JSON.stringify(cvData, null, 2);
    }

    try {
      JSON.parse(finalJson);
    } catch {
      notify('Estrutura JSON inválida. Por favor, corrija antes de salvar.', 'error');
      setCvSaving(false);
      return;
    }

    try {
      const res = await authFetch(`/api/admin/users/${cvModalUser.id}/cv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvRaw: finalJson })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(`Currículo de ${cvModalUser.name} atualizado com sucesso!`, 'success');
        setCvData(data.cvData || {});
        setCvJsonText(JSON.stringify(data.cvData || {}, null, 2));
        setCvModalUser(null);
      } else {
        notify(data.error || 'Falha ao salvar currículo.', 'error');
      }
    } catch (err) {
      notify('Erro de conexão: ' + err.message, 'error');
    } finally {
      setCvSaving(false);
    }
  };

  // Inspect User Leads
  const fetchUserLeads = async (userId, page = 0) => {
    setInspectLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '25',
        offset: String(page * 25),
        status: inspectStatusFilter,
        search: inspectSearch
      });
      const res = await authFetch(`/api/admin/users/${userId}/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUserLeadsData(data);
      }
    } catch (err) {
      console.error('Error inspecting leads:', err);
    } finally {
      setInspectLoading(false);
    }
  };

  const openInspectModal = (user) => {
    setInspectModalUser(user);
    setInspectStatusFilter('all');
    setInspectSearch('');
    fetchUserLeads(user.id, 0);
  };

  // Save System Settings
  const handleSaveSystemSettings = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await authFetch('/api/admin/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemSettings)
      });
      if (res.ok) {
        notify('Configurações globais salvas com sucesso!', 'success');
        fetchSystemSettings();
        fetchOverview();
      } else {
        notify('Falha ao salvar configurações.', 'error');
      }
    } catch {
      notify('Erro ao atualizar configurações.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Run System Diagnostics & Actions
  const handleOptimizeDb = async () => {
    setActionLoading(true);
    try {
      const res = await authFetch('/api/admin/system/optimize-db', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        notify(data.message || 'PostgreSQL otimizado com sucesso!', 'success');
        fetchOverview();
      } else {
        notify('Falha ao otimizar banco de dados.', 'error');
      }
    } catch {
      notify('Erro ao executar otimização.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCleanupUploads = async () => {
    setActionLoading(true);
    try {
      const res = await authFetch('/api/admin/system/cleanup-uploads', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        notify(data.message || 'Uploads temporários limpos.', 'success');
      } else {
        notify('Falha ao limpar uploads temporários.', 'error');
      }
    } catch {
      notify('Erro ao executar limpeza.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearLogs = async (days = 30) => {
    if (!window.confirm(`Confirma expurgar todos os logs de auditoria anteriores a ${days} dias?`)) return;
    try {
      const res = await authFetch('/api/admin/logs/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days })
      });
      if (res.ok) {
        const data = await res.json();
        notify(`${data.clearedCount} registros de logs antigos foram limpos!`, 'success');
        fetchAuditLogs(0);
        fetchOverview();
      }
    } catch {
      notify('Erro ao limpar logs.', 'error');
    }
  };

  // Filtered Users List
  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const matchesStatus = userStatusFilter === 'all' || u.status === userStatusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Export Analytics to JSON / CSV
  const handleExportData = () => {
    const dataStr = JSON.stringify({ overview, users: usersList, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bunker-admin-report-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    notify('Relatório administrativo exportado com sucesso!', 'success');
  };

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
        <p className="text-gray-400 font-mono text-sm tracking-wider">
          Carregando Telemetria do Bunker Command Center...
        </p>
      </div>
    );
  }

  const sys = overview?.system || {};
  const db = overview?.database || {};
  const scraper = overview?.scraper || {};
  const globalLeads = overview?.globalStats?.leads || {};
  const globalUsers = overview?.globalStats?.users || {};
  const liveWorkers = overview?.liveWorkers || {};
  const abuse = overview?.abuseSummary || {};

  return (
    <div className="admin-dashboard bunker-admin-workspace space-y-6 lg:space-y-8 animate-fadeIn">
      {/* Top Header & Telemetry Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 glass-panel p-4 sm:p-6 border-brand-500/20 bg-gradient-to-r from-dark-surface/90 via-dark-surface/70 to-brand-950/30">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyber-cyan p-0.5 flex items-center justify-center shadow-glow">
            <div className="w-full h-full bg-dark-bg rounded-[14px] flex items-center justify-center">
              <Shield className="w-7 h-7 text-brand-400" />
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Administração <span className="text-gradient">da plataforma</span>
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-brand-500/20 text-brand-300 border border-brand-500/40">
                ACESSO ADMIN
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Visão Completa Multi-Tenant</span>
              <details className="bunker-admin-diagnostics">
                <summary>Diagnóstico técnico</summary>
                <div className="bunker-admin-diagnostics-content">
                  <span>PID: {sys.pid || '—'}</span>
                  <span>Node {sys.nodeVersion}</span>
                  <span>{sys.uptimeFormatted || 'Calculando...'}</span>
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex w-full flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 lg:w-auto">
          {/* Auto Refresh Switcher */}
          <div className="flex items-center justify-between bg-dark-bg/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300">
            <Clock className="w-3.5 h-3.5 text-gray-400 mr-2" />
            <span className="mr-2 hidden sm:inline">Auto-Sync:</span>
            <select
              value={autoRefreshSec}
              onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
              className="bg-transparent text-cyber-cyan font-bold outline-none cursor-pointer"
            >
              <option value={0} className="bg-dark-surface text-gray-200">Desativado</option>
              <option value={10} className="bg-dark-surface text-gray-200">10s (Ao Vivo)</option>
              <option value={30} className="bg-dark-surface text-gray-200">30s (Padrão)</option>
              <option value={60} className="bg-dark-surface text-gray-200">60s</option>
            </select>
          </div>

          <button
            onClick={() => loadAllAdminData(true)}
            disabled={isRefreshing}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-dark-bg/80 hover:bg-brand-900/40 border border-white/10 hover:border-brand-500/40 text-gray-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-400' : 'text-gray-400'}`} />
            <span>{isRefreshing ? 'Sincronizando...' : 'Atualizar'}</span>
          </button>

          <button
            onClick={handleExportData}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600/30 hover:bg-brand-600/50 border border-brand-500/40 text-brand-200 transition"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Exportar Relatório</span>
          </button>
        </div>
      </div>

      {/* Live System Health Radar Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Node Backend */}
        <div className="glass-panel p-4 flex items-center justify-between border-white/5 bg-dark-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyber-cyan/10 border border-cyber-cyan/20 flex items-center justify-center text-cyber-cyan">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-400 font-medium">Servidor Node.js</div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Online</span>
              </div>
            </div>
          </div>
          <div className="text-right text-xs font-mono text-gray-400">
            <div>RSS: {sys.memory?.rssMb || 0} MB</div>
            <div className="text-[10px] text-gray-500">Heap: {sys.memory?.heapUsedMb || 0} MB</div>
          </div>
        </div>

        {/* 2. PostgreSQL */}
        <div className="glass-panel p-4 flex items-center justify-between border-white/5 bg-dark-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-400 font-medium">PostgreSQL Multi-Tenant</div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                {db.status === 'connected' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>{db.latencyMs}ms ping</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span className="text-rose-400">Desconectado</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="text-right text-xs font-mono text-gray-400">
            <div>{db.dbSize || '0 MB'}</div>
            <div className="text-[10px] text-gray-500">{db.totalTables || 0} tabelas</div>
          </div>
        </div>

        {/* 3. Scraper Python Engine */}
        <div className="glass-panel p-4 flex items-center justify-between border-white/5 bg-dark-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-400 font-medium">Motor Scraper (Porta 8000)</div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                {scraper.status === 'running' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="text-emerald-400">Operacional</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span className="text-amber-400">Standby / Off</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="text-right text-xs font-mono text-gray-400">
            <div>{scraper.python?.installed ? 'Python 3 OK' : 'Py Ausente'}</div>
            <div className="text-[10px] text-gray-500">{scraper.platform || 'CasaOS'}</div>
          </div>
        </div>

        {/* 4. Active Background Tasks */}
        <div className="glass-panel p-4 flex items-center justify-between border-white/5 bg-dark-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-400 font-medium">Workers em Execução</div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse"></span>
                <span>{liveWorkers.activeSearchesCount || 0} Buscas | {liveWorkers.activeEmailsCount || 0} Envio</span>
              </div>
            </div>
          </div>
          <div className="text-right text-xs font-mono text-cyber-cyan font-bold">
            {(liveWorkers.activeSearchesCount || 0) + (liveWorkers.activeEmailsCount || 0) > 0 ? 'TRABALHANDO' : 'EM ESPERA'}
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch gap-2 border-b border-white/10 pb-4" role="tablist" aria-label="Seções administrativas">
        {[
          { id: 'overview', label: 'Visão Geral & Telemetria', icon: BarChart3 },
          { id: 'waitlist', label: 'Lista de Espera', icon: Bell },
          { id: 'charities', label: 'Instituições', icon: HeartHandshake },
          { id: 'users', label: `Gestão de Usuários (${usersList.length})`, icon: Users },
          { id: 'metrics', label: 'Funil & Métricas Globais', icon: TrendingUp },
          { id: 'abuse', label: `Segurança & Auditoria ${abuse.recentAlerts?.length ? `(${abuse.recentAlerts.length})` : ''}`, icon: Shield },
          { id: 'settings', label: 'Configurações do Sistema', icon: Settings }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = adminTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setAdminTab(tab.id)}
              aria-selected={isActive}
              role="tab"
              className={`w-full justify-center flex items-center gap-2 px-3 sm:px-5 py-3 sm:py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-brand-600 text-true-white shadow-glow font-semibold border border-brand-400/40'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-true-white' : 'text-gray-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: VISÃO GERAL & TELEMETRIA                          */}
      {/* ======================================================== */}
      {adminTab === 'overview' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Main Counters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Total Users */}
            <div className="glass-panel p-5 border-white/10 hover:border-brand-500/30 transition">
              <div className="flex items-center justify-between text-gray-400 text-xs font-semibold uppercase tracking-wider">
                <span>Total de Bunkers</span>
                <Users className="w-4 h-4 text-brand-400" />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="text-3xl font-black text-white">{globalUsers.total || 0}</div>
                <div className="text-xs text-emerald-400 font-medium">
                  {globalUsers.active || 0} ativos hoje
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                <span>{globalUsers.suspended || 0} suspensos</span>
                <span>{globalUsers.loggedInToday || 0} online hoje</span>
              </div>
            </div>

            {/* Total Leads */}
            <div className="glass-panel p-5 border-white/10 hover:border-cyan-500/30 transition">
              <div className="flex items-center justify-between text-gray-400 text-xs font-semibold uppercase tracking-wider">
                <span>Total Leads Minerados</span>
                <Search className="w-4 h-4 text-cyber-cyan" />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="text-3xl font-black text-white font-mono">{globalLeads.total || 0}</div>
                <div className="text-xs text-cyber-cyan font-bold">
                  +{globalLeads.scrapedToday || 0} hoje
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                <span>{globalLeads.pending || 0} aguardando redação</span>
                <span>{globalLeads.drafts || 0} rascunhos</span>
              </div>
            </div>

            {/* Total Sent & Conversion */}
            <div className="glass-panel p-5 border-white/10 hover:border-emerald-500/30 transition">
              <div className="flex items-center justify-between text-gray-400 text-xs font-semibold uppercase tracking-wider">
                <span>E-mails Disparados</span>
                <Send className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="text-3xl font-black text-white font-mono">{globalLeads.sent || 0}</div>
                <div className="text-xs text-emerald-400 font-bold">
                  {globalLeads.responseRate || '0.0%'} resp.
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                <span>{globalLeads.replied || 0} respostas obtidas</span>
                <span>{globalLeads.deliverySuccessRate || '100%'} entrega</span>
              </div>
            </div>

            {/* Total in Queue / Action Required */}
            <div className="glass-panel p-5 border-white/10 hover:border-amber-500/30 transition">
              <div className="flex items-center justify-between text-gray-400 text-xs font-semibold uppercase tracking-wider">
                <span>Fila de Disparo</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="text-3xl font-black text-amber-300 font-mono">{globalLeads.queued || 0}</div>
                <div className="text-xs text-amber-400 font-medium">Prontos p/ envio</div>
              </div>
              <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                <span>{globalLeads.failed || 0} falhas de entrega</span>
                <span className="text-rose-400">{abuse.failedLogins24h || 0} falhas de auth</span>
              </div>
            </div>
          </div>

          {/* Active Live In-Memory Jobs Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Google Maps Searches */}
            <div className="glass-panel p-6 border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyber-cyan" />
                  <span>Buscas de Leads Ativas ({liveWorkers.activeSearches?.length || 0})</span>
                </h2>
                <span className="text-xs font-mono text-gray-400">Tempo Real</span>
              </div>

              {liveWorkers.activeSearches && liveWorkers.activeSearches.length > 0 ? (
                <div className="space-y-3">
                  {liveWorkers.activeSearches.map((job) => (
                    <div key={job.userId} className="p-4 rounded-xl bg-dark-bg/60 border border-cyber-cyan/30">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-white">Bunker #{job.userId}</span>
                        <span className="text-xs font-mono text-cyber-cyan">
                          {job.leadsFound} / {job.targetGoal || '30'} leads
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Alvo: <span className="text-gray-200">"{job.query}"</span> • Cidade atual:{' '}
                        <span className="text-brand-300">{job.currentCity || 'Iniciando...'}</span>
                      </div>
                      <div className="w-full bg-dark-bg rounded-full h-2 mt-3 overflow-hidden border border-white/10">
                        <div
                          className="bg-gradient-to-r from-brand-500 to-cyber-cyan h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress || 10}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-gray-500">
                  Nenhuma busca no Google Maps em execução no momento.
                </div>
              )}
            </div>

            {/* Live SMTP Dispatch Workers */}
            <div className="glass-panel p-6 border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  <span>Workers de E-mail Ativos ({liveWorkers.activeEmails?.length || 0})</span>
                </h2>
                <span className="text-xs font-mono text-gray-400">Tempo Real</span>
              </div>

              {liveWorkers.activeEmails && liveWorkers.activeEmails.length > 0 ? (
                <div className="space-y-3">
                  {liveWorkers.activeEmails.map((worker) => (
                    <div key={worker.userId} className="p-4 rounded-xl bg-dark-bg/60 border border-emerald-500/30">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-white">Bunker #{worker.userId}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300">
                          {worker.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-2 flex items-center justify-between">
                        <span>Último disparo: {worker.lastSentTime ? new Date(worker.lastSentTime).toLocaleTimeString() : 'Recentemente'}</span>
                        <span className="text-emerald-400">Operando com Cooldown Ativo</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-gray-500">
                  Nenhum worker de disparo ativo em segundo plano no momento.
                </div>
              )}
            </div>
          </div>

          {/* Funnel Overview */}
          <div className="glass-panel p-4 sm:p-6 border-white/10">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              <span>Funil de Conversão B2B Global</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
              <div className="p-4 rounded-xl bg-dark-bg/50 border border-white/5">
                <div className="text-xs text-gray-400 font-medium">1. Leads Scrapados</div>
                <div className="text-xl font-bold text-white mt-1 font-mono">{globalLeads.total || 0}</div>
                <div className="text-[10px] text-gray-500 mt-1">100% base minerada</div>
              </div>

              <div className="p-4 rounded-xl bg-dark-bg/50 border border-white/5">
                <div className="text-xs text-gray-400 font-medium">2. Rascunhos IA</div>
                <div className="text-xl font-bold text-brand-300 mt-1 font-mono">
                  {(globalLeads.drafts || 0) + (globalLeads.queued || 0) + (globalLeads.sent || 0)}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Personalizados</div>
              </div>

              <div className="p-4 rounded-xl bg-dark-bg/50 border border-white/5">
                <div className="text-xs text-gray-400 font-medium">3. Fila Aprovada</div>
                <div className="text-xl font-bold text-blue-400 mt-1 font-mono">{globalLeads.queued || 0}</div>
                <div className="text-[10px] text-gray-500 mt-1">Prontos p/ envio</div>
              </div>

              <div className="p-4 rounded-xl bg-dark-bg/50 border border-white/5">
                <div className="text-xs text-gray-400 font-medium">4. Disparados</div>
                <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">{globalLeads.sent || 0}</div>
                <div className="text-[10px] text-gray-500 mt-1">Enviados via SMTP</div>
              </div>

              <div className="p-4 rounded-xl bg-dark-bg/50 border border-white/5">
                <div className="text-xs text-gray-400 font-medium">5. Respondidos</div>
                <div className="text-xl font-bold text-cyber-cyan mt-1 font-mono">{globalLeads.replied || 0}</div>
                <div className="text-[10px] text-cyber-cyan font-bold mt-1">{globalLeads.responseRate || '0.0%'} taxa</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB WAITLIST: LISTA DE ESPERA                           */}
      {/* ======================================================== */}
      {adminTab === 'waitlist' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="glass-panel p-4 sm:p-6 border-white/10">
            <h2 className="text-lg font-bold text-white mb-4">Interessados (Landing Page)</h2>
            <div className="responsive-table overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[620px] text-left border-collapse">
                <thead>
                  <tr className="bg-dark-surface border-b border-white/10 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="p-4 font-semibold">ID</th>
                    <th className="p-4 font-semibold">Nome</th>
                    <th className="p-4 font-semibold">WhatsApp</th>
                    <th className="p-4 font-semibold">Data Cadastro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {waitlistData.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-4 text-sm text-gray-400 font-mono">#{item.id}</td>
                      <td className="p-4 text-sm text-gray-200 font-semibold">{item.name}</td>
                      <td className="p-4 text-sm text-brand-300 font-mono">{item.phone}</td>
                      <td className="p-4 text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                  {waitlistData.length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-gray-500 text-sm">
                        Nenhum interessado registrado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB: INSTITUIÇÕES APOIADAS / MINI-CMS                   */}
      {/* ======================================================== */}
      {adminTab === 'charities' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="relative overflow-hidden rounded-2xl border border-brand-400/25 bg-gradient-to-br from-brand-500/15 via-dark-surface to-dark-bg p-5 sm:p-7">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-brand-300/10" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-300">
                  <HeartHandshake className="h-4 w-4" />
                  Mini-CMS de apoio
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">Uma outra forma de fazer parte.</h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-400">
                  Cadastre as instituições que o Bunker apoia. As instituições ativas aparecem na página pública e no fluxo de cadastro, com o link oficial para contribuição.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openCharityEditor()}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-xs font-bold text-true-black transition hover:bg-brand-300"
              >
                <Plus className="h-4 w-4" />
                Adicionar instituição
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Curadoria publicada</h3>
              <p className="mt-1 text-xs text-gray-500">
                {charityInstitutions.filter((institution) => institution.is_active).length} ativas de {charityInstitutions.length} cadastradas.
              </p>
            </div>
            <a
              href="/apoie"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-white/10 px-3.5 text-xs font-semibold text-gray-300 transition hover:border-brand-400/40 hover:bg-brand-400/10 hover:text-brand-200 sm:self-auto"
            >
              Ver página pública
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {charityInstitutions.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-dark-surface/40 px-6 text-center">
              <HeartHandshake className="h-9 w-9 text-brand-300" />
              <h3 className="mt-4 text-lg font-bold text-white">Sua curadoria começa aqui.</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                Adicione a primeira instituição com um link oficial, uma descrição curta e a causa que ela representa.
              </p>
              <button
                type="button"
                onClick={() => openCharityEditor()}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-400/40 bg-brand-500/10 px-4 text-xs font-bold text-brand-200 transition hover:bg-brand-500/20"
              >
                <Plus className="h-4 w-4" />
                Cadastrar primeira instituição
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {charityInstitutions.map((institution, index) => (
                <article
                  key={institution.id}
                  className={`group relative overflow-hidden rounded-2xl border p-5 transition sm:p-6 ${
                    institution.is_active
                      ? 'border-white/10 bg-dark-surface/75 hover:border-brand-400/45'
                      : 'border-white/5 bg-dark-bg/50 opacity-75'
                  } ${index === 0 ? 'md:col-span-2' : ''}`}
                >
                  <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border border-brand-300/10 transition duration-500 group-hover:scale-125" />
                  <div className="relative flex h-full flex-col justify-between gap-7">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3.5">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-black ${institution.is_active ? 'bg-brand-400/15 text-brand-300' : 'bg-white/5 text-gray-500'}`}>
                          {getCharityInitials(institution.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-300">{institution.category}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${institution.is_active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-black'}`}>
                              {institution.is_active ? 'Publicada' : 'Oculta'}
                            </span>
                          </div>
                          <h4 className="mt-1 truncate text-xl font-bold text-white">{institution.name}</h4>
                          <p className="mt-1 truncate text-xs font-mono text-gray-600">{getCharityDomain(institution.website_url)}</p>
                        </div>
                      </div>
                      <span className="hidden text-[10px] font-mono text-gray-600 sm:inline">{String(index + 1).padStart(2, '0')}</span>
                    </div>

                    <div className="flex flex-col gap-4 border-t border-white/5 pt-4 sm:flex-row sm:items-end sm:justify-between">
                      <p className="max-w-xl text-sm leading-relaxed text-gray-400">
                        {institution.description || 'Sem descrição cadastrada.'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={institution.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-gray-400 transition hover:bg-white/5 hover:text-white"
                          title="Abrir link oficial"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir link
                        </a>
                        <button
                          type="button"
                          onClick={() => openCharityEditor(institution)}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[11px] font-semibold text-gray-300 transition hover:border-brand-400/40 hover:bg-brand-400/10 hover:text-brand-200"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleCharity(institution)}
                          className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition ${institution.is_active ? 'border-amber-400/20 text-amber-300 hover:bg-amber-400/10' : 'border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/10'}`}
                          aria-pressed={institution.is_active}
                        >
                          {institution.is_active ? 'Ocultar' : 'Publicar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCharity(institution)}
                          disabled={charityDeletingId === institution.id}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-black transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                        >
                          {charityDeletingId === institution.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: GESTÃO DE USUÁRIOS (TENANTS)                     */}
      {/* ======================================================== */}
      {adminTab === 'users' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Filter Bar */}
          <div className="glass-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full bg-dark-bg border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="w-full sm:w-auto bg-dark-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="all">Todas as Permissões</option>
                <option value="admin">Apenas Admins</option>
                <option value="user">Apenas Usuários</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="w-full sm:w-auto bg-dark-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="all">Todos os Status</option>
                <option value="active">Ativos</option>
                <option value="pending">Pendentes (Aprovação)</option>
                <option value="suspended">Suspensos</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="glass-panel overflow-hidden border-white/10">
            <div className="responsive-table overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="py-4 px-4">Bunker / Usuário</th>
                    <th className="py-4 px-4">Permissão</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4">Comprovante</th>
                    <th className="py-4 px-4 text-center">Leads (Total / Hoje)</th>
                    <th className="py-4 px-4 text-center">Disparos / Respostas</th>
                    <th className="py-4 px-4">Cota Diária</th>
                    <th className="py-4 px-4">Último Login</th>
                    <th className="py-4 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-gray-300 font-medium">
                  {filteredUsers.map((u) => {
                    const st = u.stats || {};
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition">
                        {/* User info */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center font-bold text-true-white text-sm shadow-md">
                              {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-brand-500/20 text-brand-300 font-mono">
                                    VOCÊ
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 font-mono">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleToggleRole(u)}
                            className={`px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider flex items-center gap-1.5 transition ${
                              u.role === 'admin'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                                : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            <span>{u.role ? u.role.toUpperCase() : 'USER'}</span>
                          </button>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider flex items-center gap-1.5 transition ${
                              u.status === 'suspended'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                                : u.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/40 hover:bg-yellow-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            }`}
                          >
                            {u.status === 'suspended' ? (
                              <>
                                <UserX className="w-3 h-3 text-rose-400" />
                                <span>SUSPENSO</span>
                              </>
                            ) : u.status === 'pending' ? (
                              <>
                                <Clock className="w-3 h-3 text-yellow-500" />
                                <span>PENDENTE</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3 h-3 text-emerald-400" />
                                <span>ATIVO</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Comprovante */}
                        <td className="py-4 px-4">
                          <div className="space-y-1.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${u.proof_type === 'charity' ? 'bg-brand-500/15 text-brand-300' : 'bg-rose-500/10 text-rose-300'}`}>
                              {u.proof_type === 'charity' ? <HeartHandshake className="h-3 w-3" /> : <Droplets className="h-3 w-3" />}
                              {u.proof_type === 'charity' ? 'Instituição' : 'Sangue'}
                            </span>
                            {u.proof_type === 'charity' && u.institution_name && (
                              <div className="max-w-[150px] truncate text-[10px] text-gray-500" title={u.institution_name}>
                                {u.institution_name}
                              </div>
                            )}
                            {u.proof_path ? (
                              <button
                                onClick={() => setProofModalUrl(`${apiBase}${u.proof_path}`)}
                                className="flex items-center gap-1 text-xs font-medium text-brand-400 underline hover:text-brand-300"
                              >
                                <Eye className="h-3 w-3" /> Abrir Anexo
                              </button>
                            ) : (
                              <span className="text-xs text-gray-600">Sem anexo</span>
                            )}
                          </div>
                        </td>

                        {/* Leads */}
                        <td className="py-4 px-4 text-center font-mono">
                          <span className="font-bold text-white">{st.total || 0}</span>
                          <span className="text-xs text-cyber-cyan ml-1">
                            (+{st.scrapedToday || 0})
                          </span>
                        </td>

                        {/* Sent & Replied */}
                        <td className="py-4 px-4 text-center font-mono">
                          <span className="text-emerald-400 font-bold">{st.sent || 0}</span>
                          <span className="text-gray-500 mx-1">/</span>
                          <span className="text-cyber-cyan font-bold">{st.replied || 0}</span>
                        </td>

                        {/* Daily Limit */}
                        <td className="py-4 px-4">
                          <button
                            onClick={() => {
                              setQuotaModalUser(u);
                              setNewQuotaValue(u.daily_limit_override || '');
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs bg-dark-bg border border-white/10 hover:border-brand-500/40 text-gray-300 font-mono flex items-center gap-1.5 transition"
                          >
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>{u.daily_limit_override ? `${u.daily_limit_override}/dia` : 'Global (50)'}</span>
                          </button>
                        </td>

                        {/* Last Login */}
                        <td className="py-4 px-4 text-xs font-mono text-gray-400">
                          {u.last_login ? new Date(u.last_login).toLocaleString() : 'Nunca'}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View / Edit CV */}
                            <button
                              onClick={() => openCvModal(u)}
                              title="Ver / Ajustar Currículo (CV)"
                              className="p-2 rounded-xl bg-dark-bg hover:bg-purple-900/40 border border-white/10 hover:border-purple-500/40 text-white hover:text-purple-300 transition"
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            {/* Inspect Leads */}
                            <button
                              onClick={() => openInspectModal(u)}
                              title="Inspecionar Leads"
                              className="p-2 rounded-xl bg-dark-bg hover:bg-brand-900/40 border border-white/10 hover:border-brand-500/40 text-gray-300 hover:text-brand-300 transition"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => {
                                setPasswordModalUser(u);
                                setNewPasswordValue('');
                              }}
                              title="Redefinir Senha"
                              className="p-2 rounded-xl bg-dark-bg hover:bg-amber-900/40 border border-white/10 hover:border-amber-500/40 text-white hover:text-amber-300 transition"
                            >
                              <Key className="w-4 h-4" />
                            </button>

                            {/* Delete User */}
                            {!isSelf && (
                              <button
                                onClick={() => setDeleteModalUser(u)}
                                title="Excluir Bunker"
                                className="p-2 rounded-xl bg-dark-bg hover:bg-rose-900/40 border border-white/10 hover:border-rose-500/40 text-white hover:text-rose-300 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-500 text-xs">
                        Nenhum bunker encontrado para o filtro informado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: FUNIL & MÉTRICAS GLOBAIS                          */}
      {/* ======================================================== */}
      {adminTab === 'metrics' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="glass-panel p-4 sm:p-6 border-white/10">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-400" />
              <span>Ranking de Produtividade dos Bunkers</span>
            </h2>
            <p className="text-xs text-gray-400 mb-6">
              Volume total de extrações e respostas obtidas por cada usuário do sistema.
            </p>

            <div className="space-y-4">
              {usersList
                .slice()
                .sort((a, b) => (b.stats?.total || 0) - (a.stats?.total || 0))
                .map((u, idx) => {
                  const st = u.stats || {};
                  const totalSysLeads = globalLeads.total || 1;
                  const pct = Math.round(((st.total || 0) / totalSysLeads) * 100);
                  return (
                    <div key={u.id} className="p-4 rounded-xl bg-dark-bg/40 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <span className="w-6 text-center font-bold text-gray-500 font-mono text-sm">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-white text-sm">{u.name}</div>
                          <div className="text-xs text-gray-400 font-mono">{u.email}</div>
                        </div>
                      </div>

                      {/* Progress representation */}
                      <div className="flex-1 max-w-md">
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-1 font-mono">
                          <span>{st.total || 0} leads minerados</span>
                          <span>{pct}% do banco global</span>
                        </div>
                        <div className="w-full bg-dark-bg rounded-full h-2 overflow-hidden border border-white/10">
                          <div
                            className="bg-gradient-to-r from-brand-500 to-cyber-cyan h-2 rounded-full"
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 font-mono text-xs">
                        <div className="text-center">
                          <div className="text-gray-400">Disparados</div>
                          <div className="text-emerald-400 font-bold text-sm mt-0.5">{st.sent || 0}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400">Respostas</div>
                          <div className="text-cyber-cyan font-bold text-sm mt-0.5">{st.replied || 0}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400">Fila</div>
                          <div className="text-amber-400 font-bold text-sm mt-0.5">{st.queued || 0}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: SEGURANÇA, ABUSOS & AUDITORIA                     */}
      {/* ======================================================== */}
      {adminTab === 'abuse' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Abuse Radar Alert Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel p-4 border-rose-500/20 bg-rose-950/10">
              <div className="flex items-center justify-between text-rose-400 text-xs font-bold uppercase tracking-wider">
                <span>Falhas de Login (24h)</span>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-rose-300 mt-2 font-mono">
                {abuse.failedLogins24h || 0}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">Tentativas incorretas registradas</div>
            </div>

            <div className="glass-panel p-4 border-amber-500/20 bg-amber-950/10">
              <div className="flex items-center justify-between text-amber-400 text-xs font-bold uppercase tracking-wider">
                <span>Violações de Cota (24h)</span>
                <AlertOctagon className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-amber-300 mt-2 font-mono">
                {abuse.quotaBreaches24h || 0}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">Tentativas além do teto diário</div>
            </div>

            <div className="glass-panel p-4 border-purple-500/20 bg-purple-950/10">
              <div className="flex items-center justify-between text-purple-400 text-xs font-bold uppercase tracking-wider">
                <span>Erros de SMTP / Bounce (24h)</span>
                <Mail className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-brand-400 mt-2 font-mono">
                {abuse.emailErrors24h || 0}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">Falhas de envio registradas</div>
            </div>

            <div className="glass-panel p-4 border-cyan-500/20 bg-cyan-950/10">
              <div className="flex items-center justify-between text-cyber-cyan text-xs font-bold uppercase tracking-wider">
                <span>Rate Limits Bloqueados</span>
                <Shield className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black text-cyan-300 mt-2 font-mono">
                {abuse.rateLimits24h || 0}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">Requisições barradas no IP</div>
            </div>
          </div>

          {/* Audit Logs Filter & Controls */}
          <div className="glass-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filtrar logs por ação, IP, e-mail ou detalhes..."
                value={logSearch}
                onChange={(e) => {
                  setLogSearch(e.target.value);
                  setLogPage(0);
                }}
                className="w-full bg-dark-bg border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
              <select
                value={logCategoryFilter}
                onChange={(e) => {
                  setLogCategoryFilter(e.target.value);
                  setLogPage(0);
                }}
                className="w-full sm:w-auto bg-dark-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="all">Todas as Categorias</option>
                <option value="auth">Autenticação (Auth)</option>
                <option value="scraper">Scraper / Buscas</option>
                <option value="email">E-mail / SMTP</option>
                <option value="security">Segurança</option>
                <option value="admin">Ações de Admin</option>
                <option value="system">Sistema</option>
              </select>

              <select
                value={logSeverityFilter}
                onChange={(e) => {
                  setLogSeverityFilter(e.target.value);
                  setLogPage(0);
                }}
                className="w-full sm:w-auto bg-dark-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="all">Todas as Gravidades</option>
                <option value="info">Info</option>
                <option value="warning">Atenção (Warning)</option>
                <option value="danger">Perigo (Danger)</option>
                <option value="success">Sucesso</option>
              </select>

              <button
                onClick={() => handleClearLogs(30)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 transition"
              >
                Expurgar &gt; 30 dias
              </button>
            </div>
          </div>

          {/* Audit Logs Stream */}
          <div className="glass-panel overflow-hidden border-white/10">
            <div className="responsive-table overflow-x-auto">
              <table className="w-full min-w-[850px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4">Gravidade</th>
                    <th className="py-3 px-4">Ação</th>
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">IP</th>
                    <th className="py-3 px-4">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-gray-300 font-mono">
                  {auditLogsData.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.severity === 'danger'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : log.severity === 'warning'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : log.severity === 'success'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          }`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-white whitespace-nowrap">{log.action}</td>
                      <td className="py-3 px-4 text-gray-300">{log.user_email || '—'}</td>
                      <td className="py-3 px-4 text-gray-400">{log.ip_address || '—'}</td>
                      <td className="py-3 px-4 text-gray-300 max-w-md truncate font-sans text-xs">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                  {auditLogsData.logs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500 text-xs">
                        Nenhum registro de auditoria encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-400">
              <div>
                Total: <span className="text-white font-bold">{auditLogsData.total}</span> registros de log
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={logPage === 0}
                  onClick={() => {
                    const prev = Math.max(0, logPage - 1);
                    setLogPage(prev);
                    fetchAuditLogs(prev);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-dark-bg border border-white/10 disabled:opacity-40 hover:bg-white/5"
                >
                  Anterior
                </button>
                <span className="font-mono">Página {logPage + 1}</span>
                <button
                  disabled={(logPage + 1) * 50 >= auditLogsData.total}
                  onClick={() => {
                    const next = logPage + 1;
                    setLogPage(next);
                    fetchAuditLogs(next);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-dark-bg border border-white/10 disabled:opacity-40 hover:bg-white/5"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: CONFIGURAÇÕES DO SISTEMA & MANUTENÇÃO             */}
      {/* ======================================================== */}
      {adminTab === 'settings' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Global Parameters Form */}
          <form onSubmit={handleSaveSystemSettings} className="glass-panel p-4 sm:p-6 border-white/10 space-y-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-brand-400" />
              <span>Parâmetros Globais do Bunker</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Daily Leads Limit */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Cota Diária Padrão (por Usuário)
                </label>
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={systemSettings.global_daily_leads_limit || '50'}
                  onChange={(e) =>
                    setSystemSettings({ ...systemSettings, global_daily_leads_limit: e.target.value })
                  }
                  className="w-full bg-dark-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500 font-mono"
                />
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Limite padrão de novos leads minerados por dia por bunker.
                </p>
              </div>

              {/* Default Cooldown */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Intervalo entre Disparos (Minutos)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={systemSettings.default_cooldown_minutes || '30'}
                  onChange={(e) =>
                    setSystemSettings({ ...systemSettings, default_cooldown_minutes: e.target.value })
                  }
                  className="w-full bg-dark-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500 font-mono"
                />
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Tempo de segurança entre cada envio SMTP para evitar spam.
                </p>
              </div>

              {/* Allow New Registrations */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Novos Cadastros de Usuários
                </label>
                <select
                  value={systemSettings.allow_registrations || 'true'}
                  onChange={(e) =>
                    setSystemSettings({ ...systemSettings, allow_registrations: e.target.value })
                  }
                  className="w-full bg-dark-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500 cursor-pointer"
                >
                  <option value="true">Permitir Novos Registros (Aberto)</option>
                  <option value="false">Bloquear Novos Registros (Fechado)</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Controla se novos membros podem criar conta no bunker.
                </p>
              </div>
            </div>

            {/* Global Announcement Banner */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-cyber-cyan" />
                    <span>Comunicado Global (Broadcast Banner)</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Exibe um banner de aviso no topo da interface de todos os usuários logados.
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={systemSettings.announcement_banner_active === 'true'}
                    onChange={(e) =>
                      setSystemSettings({
                        ...systemSettings,
                        announcement_banner_active: e.target.checked ? 'true' : 'false'
                      })
                    }
                    className="w-4 h-4 rounded border-gray-600 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-xs font-semibold text-gray-300">Ativar Banner</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs text-gray-400 mb-1">Tipo de Aviso</label>
                  <select
                    value={systemSettings.announcement_banner_type || 'info'}
                    onChange={(e) =>
                      setSystemSettings({ ...systemSettings, announcement_banner_type: e.target.value })
                    }
                    className="w-full bg-dark-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-500 cursor-pointer"
                  >
                    <option value="info">Informativo (Azul/Ciano)</option>
                    <option value="warning">Atenção (Amarelo)</option>
                    <option value="success">Novidade / Sucesso (Verde)</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-400 mb-1">Mensagem do Comunicado</label>
                  <input
                    type="text"
                    placeholder="Ex: 🚀 Servidor atualizado com melhorias de velocidade na extração de e-mails!"
                    value={systemSettings.announcement_banner_text || ''}
                    onChange={(e) =>
                      setSystemSettings({ ...systemSettings, announcement_banner_text: e.target.value })
                    }
                    className="w-full bg-dark-bg border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-stretch sm:justify-end pt-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm bg-brand-600 hover:bg-brand-500 text-true-white transition shadow-glow flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Salvar Configurações Globais</span>
              </button>
            </div>
          </form>

          {/* Maintenance & System Tools */}
          <div className="glass-panel p-4 sm:p-6 border-white/10 space-y-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-cyber-cyan" />
              <span>Ferramentas de Manutenção & Otimização do Bunker</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Tool 1: PostgreSQL Vacuum */}
              <div className="p-4 rounded-xl bg-dark-bg/60 border border-white/5 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    <span>Otimizar PostgreSQL</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Executa VACUUM ANALYZE em todas as tabelas de leads para liberar espaço e acelerar consultas.
                  </p>
                </div>
                <button
                  onClick={handleOptimizeDb}
                  disabled={actionLoading}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 transition flex items-center justify-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Executar Otimização</span>
                </button>
              </div>

              {/* Tool 2: Clean Temp Uploads */}
              <div className="p-4 rounded-xl bg-dark-bg/60 border border-white/5 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-amber-400" />
                    <span>Limpar Arquivos Temporários</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Remove PDFs de currículos e arquivos temporários com mais de 24 horas do diretório /uploads.
                  </p>
                </div>
                <button
                  onClick={handleCleanupUploads}
                  disabled={actionLoading}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/40 text-amber-300 transition flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar Uploads Antigos</span>
                </button>
              </div>

              {/* Tool 3: Diagnostic Ping */}
              <div className="p-4 rounded-xl bg-dark-bg/60 border border-white/5 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Diagnóstico Completo</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Verifica a integridade de todos os microsserviços (DB, Scraper, Memória, Rotas).
                  </p>
                </div>
                <button
                  onClick={() => {
                    loadAllAdminData(true);
                    notify('Diagnóstico atualizado com sucesso!', 'success');
                  }}
                  disabled={isRefreshing}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 transition flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>Testar Conexões</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: AJUSTAR COTA DIÁRIA                               */}
      {/* ======================================================== */}
      {quotaModalUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="glass-panel p-4 sm:p-6 border-white/10 max-w-md w-full max-h-[calc(100dvh-1rem)] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <span>Cota Diária de Leads</span>
              </h3>
              <button
                onClick={() => setQuotaModalUser(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Configure o limite diário personalizado de mineração para{' '}
              <strong className="text-white">{quotaModalUser.name}</strong> ({quotaModalUser.email}).
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Limite Diário de Novos Leads
              </label>
              <input
                type="number"
                min="5"
                max="500"
                placeholder="Deixe em branco para usar o padrão global (50)"
                value={newQuotaValue}
                onChange={(e) => setNewQuotaValue(e.target.value)}
                className="w-full bg-dark-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-brand-500"
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                Ex: 100 para dobrar a cota, ou deixe vazio para redefinir para o padrão global do sistema.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
              <button
                onClick={() => setQuotaModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveQuota}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-true-white transition shadow-glow flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Salvar Cota</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: REDEFINIR SENHA                                    */}
      {/* ======================================================== */}
      {passwordModalUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="glass-panel p-4 sm:p-6 border-white/10 max-w-md w-full max-h-[calc(100dvh-1rem)] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                <span>Redefinir Senha do Usuário</span>
              </h3>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Digite uma nova senha de acesso para{' '}
              <strong className="text-white">{passwordModalUser.name}</strong> ({passwordModalUser.email}).
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Nova Senha (Mínimo 6 caracteres)
              </label>
              <input
                type="text"
                placeholder="Digite a nova senha temporária..."
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                className="w-full bg-dark-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
              <button
                onClick={() => setPasswordModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetPassword}
                disabled={actionLoading || !newPasswordValue}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-glow flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Atualizar Senha</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EXCLUIR USUÁRIO                                   */}
      {/* ======================================================== */}
      {deleteModalUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="glass-panel p-4 sm:p-6 border-rose-500/30 max-w-md w-full max-h-[calc(100dvh-1rem)] overflow-y-auto space-y-5 bg-gradient-to-b from-dark-surface to-rose-950/20">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-rose-300 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                <span>Excluir Bunker Permanentemente</span>
              </h3>
              <button
                onClick={() => setDeleteModalUser(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Atenção: Você está prestes a excluir o usuário{' '}
              <strong className="text-white">{deleteModalUser.name}</strong> ({deleteModalUser.email}).
            </p>

            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200">
              Esta ação removerá a tabela dedicada <code className="font-mono font-bold">leads_user_{deleteModalUser.id}</code> com todos os leads, configurações e histórico de envio. Esta ação NÃO pode ser desfeita.
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-glow flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Excluir Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: INSPECIONAR LEADS DO USUÁRIO                     */}
      {/* ======================================================== */}
      {inspectModalUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 lg:p-8">
          <div className="glass-panel p-4 sm:p-6 border-white/10 max-w-5xl w-full h-[calc(100dvh-1rem)] max-h-[85vh] flex flex-col space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-brand-300">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Inspeção de Leads: {inspectModalUser.name}
                  </h3>
                  <div className="text-xs text-gray-400 font-mono">
                    Tabela: leads_user_{inspectModalUser.id} • {inspectModalUser.email}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setInspectModalUser(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter in Modal */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar leads por empresa, e-mail ou site..."
                  value={inspectSearch}
                  onChange={(e) => {
                    setInspectSearch(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') fetchUserLeads(inspectModalUser.id, 0);
                  }}
                  className="w-full bg-dark-bg border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-brand-500"
                />
              </div>

              <select
                value={inspectStatusFilter}
                onChange={(e) => {
                  setInspectStatusFilter(e.target.value);
                }}
                className="bg-dark-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none focus:border-brand-500"
              >
                <option value="all">Todos os Status</option>
                <option value="0">Não Enviados (0)</option>
                <option value="1">Enviados (1)</option>
                <option value="2">Rascunho IA (2)</option>
                <option value="3">Fila Aprovada (3)</option>
                <option value="4">Falha no Envio (4)</option>
              </select>

              <button
                onClick={() => fetchUserLeads(inspectModalUser.id, 0)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-true-white transition"
              >
                Filtrar
              </button>
            </div>

            {/* Leads Table in Modal */}
            <div className="responsive-table flex-1 overflow-auto border border-white/5 rounded-xl">
              {inspectLoading ? (
                <div className="flex items-center justify-center py-20 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-400 mr-2" />
                  <span>Carregando leads da tabela...</span>
                </div>
              ) : (
                <table className="w-full min-w-[720px] text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-dark-surface border-b border-white/10 text-gray-400 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-3">Empresa</th>
                      <th className="py-3 px-3">E-mail</th>
                      <th className="py-3 px-3">Website</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Assunto Redigido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-gray-300">
                    {userLeadsData.leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 font-bold text-white font-sans">{lead.name}</td>
                        <td className="py-2.5 px-3 text-cyan-300">{lead.email}</td>
                        <td className="py-2.5 px-3 text-gray-400 truncate max-w-xs">{lead.website || '—'}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              lead.email_sent === 1
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : lead.email_sent === 3
                                ? 'bg-blue-500/20 text-blue-300'
                                : lead.email_sent === 2
                                ? 'bg-amber-500/20 text-amber-300'
                                : lead.email_sent === 4
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-gray-800 text-gray-400'
                            }`}
                          >
                            {lead.email_sent === 1
                              ? 'ENVIADO'
                              : lead.email_sent === 3
                              ? 'FILA'
                              : lead.email_sent === 2
                              ? 'RASCUNHO'
                              : lead.email_sent === 4
                              ? 'FALHOU'
                              : 'PENDENTE'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-400 font-sans truncate max-w-xs">
                          {lead.draft_subject || '—'}
                        </td>
                      </tr>
                    ))}
                    {userLeadsData.leads.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-gray-500">
                          Nenhum lead encontrado nesta tabela.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs text-gray-400 pt-2 border-t border-white/5">
              <span>Total de Leads: <strong className="text-white">{userLeadsData.total}</strong></span>
              <button
                onClick={() => setInspectModalUser(null)}
                className="px-4 py-2 rounded-xl bg-dark-bg border border-white/10 text-gray-200 hover:bg-white/5"
              >
                Fechar Inspeção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: VER / EDITAR CURRÍCULO (CV DO USUÁRIO)            */}
      {/* ======================================================== */}
      {cvModalUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6">
          <div className="glass-panel p-4 sm:p-6 border-white/10 max-w-5xl w-full h-[calc(100dvh-1rem)] max-h-[90vh] flex flex-col space-y-4">

            {/* Modal Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex flex-wrap items-center gap-2">
                    <span>Currículo de {cvModalUser.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                      Bunker #{cvModalUser.id}
                    </span>
                  </h3>
                  <div className="text-xs text-gray-400 font-mono">
                    {cvModalUser.email} • {cvData.personal_info?.title || 'Sem título definido'}
                  </div>
                </div>
              </div>

              {/* Tab Switcher & Close */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-1 sm:flex-none bg-dark-bg/80 border border-white/10 rounded-xl p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      if (cvEditorTab === 'json') {
                        try {
                          const parsed = JSON.parse(cvJsonText);
                          setCvData(parsed);
                        } catch {
                          notify('JSON inválido. Corrija o conteúdo antes de voltar ao modo Visual.', 'error');
                        }
                      }
                      setCvEditorTab('visual');
                    }}
                    className={`flex-1 justify-center px-2 sm:px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                      cvEditorTab === 'visual'
                        ? 'bg-purple-600 text-white font-bold shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Visual / Campos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCvJsonText(JSON.stringify(cvData, null, 2));
                      setCvEditorTab('json');
                    }}
                    className={`flex-1 justify-center px-2 sm:px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                      cvEditorTab === 'json'
                        ? 'bg-purple-600 text-white font-bold shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>Editor JSON</span>
                  </button>
                </div>

                <button
                  onClick={() => setCvModalUser(null)}
                  className="min-h-11 min-w-11 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-6">
              {cvLoading ? (
                <div className="flex items-center justify-center py-24 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400 mr-2" />
                  <span>Carregando dados do currículo...</span>
                </div>
              ) : cvEditorTab === 'json' ? (
                <div className="h-full flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Estrutura JSON bruta utilizada pelos modelos de IA (Gemini/Groq) na redação de pitches:</span>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const formatted = JSON.stringify(JSON.parse(cvJsonText), null, 2);
                          setCvJsonText(formatted);
                          notify('JSON formatado com sucesso!', 'success');
                        } catch {
                          notify('JSON inválido, impossível formatar.', 'error');
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-dark-bg border border-white/10 hover:border-purple-500/40 text-purple-300 font-mono text-[11px]"
                    >
                      Formatar JSON
                    </button>
                  </div>
                  <textarea
                    value={cvJsonText}
                    onChange={(e) => setCvJsonText(e.target.value)}
                    rows={18}
                    className="w-full flex-1 bg-dark-bg border border-white/10 rounded-xl p-4 font-mono text-xs text-purple-200 outline-none focus:border-purple-500 leading-relaxed resize-none"
                    placeholder="Cole ou edite a estrutura JSON do currículo..."
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 1. Personal Info */}
                  <div className="p-4 rounded-xl bg-dark-bg/60 border border-white/5 space-y-4">
                    <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                      <FileCheck className="w-4 h-4" />
                      <span>1. Informações Pessoais & Contato</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 mb-1">Nome Completo</label>
                        <input
                          type="text"
                          value={cvData.personal_info?.name || ''}
                          onChange={(e) => updateCvField('personal_info', 'name', e.target.value)}
                          placeholder="Ex: Demo Operator"
                          className="w-full bg-dark-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 mb-1">Título / Cargo Alvo</label>
                        <input
                          type="text"
                          value={cvData.personal_info?.title || ''}
                          onChange={(e) => updateCvField('personal_info', 'title', e.target.value)}
                          placeholder="Ex: Full Stack Developer / BDR"
                          className="w-full bg-dark-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 mb-1">Localização</label>
                        <input
                          type="text"
                          value={cvData.personal_info?.location || ''}
                          onChange={(e) => updateCvField('personal_info', 'location', e.target.value)}
                          placeholder="Ex: São Paulo, Brasil"
                          className="w-full bg-dark-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 mb-1">E-mail de Contato</label>
                        <input
                          type="email"
                          value={cvData.personal_info?.email || ''}
                          onChange={(e) => updateCvField('personal_info', 'email', e.target.value)}
                          placeholder="Ex: demo@example.com"
                          className="w-full bg-dark-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 mb-1">Telefone / WhatsApp</label>
                        <input
                          type="text"
                          value={cvData.personal_info?.phone || ''}
                          onChange={(e) => updateCvField('personal_info', 'phone', e.target.value)}
                          placeholder="Ex: +55 (11) 99999-9999"
                          className="w-full bg-dark-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    {/* Links & Socials */}
                    <div className="pt-2 border-t border-white/5">
                      <label className="block text-[11px] font-semibold text-gray-400 mb-2">Links & Perfis Profissionais</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {['linkedin', 'github', 'portfolio'].map((key) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-mono text-purple-400 w-16">{key}:</span>
                            <input
                              type="text"
                              value={cvData.personal_info?.links?.[key] || ''}
                              onChange={(e) => {
                                const newLinks = { ...(cvData.personal_info?.links || {}) };
                                newLinks[key] = e.target.value;
                                updateCvField('personal_info', 'links', newLinks);
                              }}
                              placeholder={`URL ${key}...`}
                              className="flex-1 bg-dark-surface border border-white/10 rounded-lg px-2.5 py-1 text-xs text-gray-200 outline-none focus:border-purple-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 2. Professional Summary */}
                  <div className="p-4 rounded-xl bg-dark-bg/60 border border-white/5 space-y-2">
                    <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      <span>2. Resumo Profissional / Proposta de Valor</span>
                    </h4>
                    <textarea
                      rows={3}
                      value={cvData.professional_summary || ''}
                      onChange={(e) => updateCvField('professional_summary', null, e.target.value)}
                      placeholder="Breve resumo da trajetória, competências principais e diferenciais competitivos..."
                      className="w-full bg-dark-surface border border-white/10 rounded-lg p-3 text-xs text-white outline-none focus:border-purple-500 leading-relaxed"
                    />
                  </div>

                  {/* 3. Professional Experience */}
                  <div className="p-4 rounded-xl bg-dark-bg/60 border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        <span>3. Experiências Profissionais ({(cvData.professional_experience || []).length})</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          updateCvList('professional_experience', 'add', -1, {
                            role: 'Novo Cargo',
                            company: 'Nova Empresa',
                            period: '2023 - Presente',
                            responsibilities: ['Desenvolvimento e gestão de processos...']
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-300 text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar Experiência</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {(cvData.professional_experience || []).map((exp, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-dark-surface border border-white/10 space-y-3 relative">
                          <button
                            type="button"
                            onClick={() => updateCvList('professional_experience', 'remove', idx)}
                            title="Remover Experiência"
                            className="absolute top-3 right-3 text-gray-500 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pr-8">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cargo</label>
                              <input
                                type="text"
                                value={exp.role || ''}
                                onChange={(e) =>
                                  updateCvList('professional_experience', 'update', idx, { ...exp, role: e.target.value })
                                }
                                className="w-full bg-dark-bg border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Empresa</label>
                              <input
                                type="text"
                                value={exp.company || ''}
                                onChange={(e) =>
                                  updateCvList('professional_experience', 'update', idx, { ...exp, company: e.target.value })
                                }
                                className="w-full bg-dark-bg border border-white/10 rounded-lg px-2.5 py-1 text-xs text-purple-300 font-semibold"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Período / Datas</label>
                              <input
                                type="text"
                                value={exp.period || ''}
                                onChange={(e) =>
                                  updateCvList('professional_experience', 'update', idx, { ...exp, period: e.target.value })
                                }
                                className="w-full bg-dark-bg border border-white/10 rounded-lg px-2.5 py-1 text-xs text-gray-300 font-mono"
                              />
                            </div>
                          </div>

                          {/* Responsibilities list */}
                          <div className="pt-2 border-t border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">
                                Principais Responsabilidades / Conquistas:
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  updateCvNestedList('professional_experience', idx, 'responsibilities', 'add', -1, '')
                                }
                                className="text-[10px] text-purple-400 hover:text-white flex items-center gap-1"
                              >
                                <PlusCircle className="w-3 h-3" />
                                <span>Item</span>
                              </button>
                            </div>

                            <div className="space-y-1.5">
                              {(exp.responsibilities || []).map((resp, rIdx) => (
                                <div key={rIdx} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={resp}
                                    onChange={(e) =>
                                      updateCvNestedList('professional_experience', idx, 'responsibilities', 'update', rIdx, e.target.value)
                                    }
                                    className="flex-1 bg-dark-bg border border-white/10 rounded-lg px-2.5 py-1 text-xs text-gray-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCvNestedList('professional_experience', idx, 'responsibilities', 'remove', rIdx)
                                    }
                                    className="text-gray-500 hover:text-rose-400 p-1"
                                  >
                                    <MinusCircle className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                      {(cvData.professional_experience || []).length === 0 && (
                        <div className="text-center py-6 text-gray-500 text-xs">
                          Nenhuma experiência cadastrada neste currículo.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. Education & Languages */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Education */}
                    <div className="p-4 rounded-xl bg-dark-bg/60 border border-white/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                          <GraduationCap className="w-4 h-4" />
                          <span>Educação</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() =>
                            updateCvList('education', 'add', -1, {
                              degree: 'Graduação / Curso',
                              institution: 'Instituição de Ensino'
                            })
                          }
                          className="text-[10px] text-indigo-400 hover:text-white flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Novo</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(cvData.education || []).map((edu, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-dark-surface border border-white/10 space-y-1 relative">
                            <button
                              type="button"
                              onClick={() => updateCvList('education', 'remove', idx)}
                              className="absolute top-2 right-2 text-gray-500 hover:text-rose-400"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="text"
                              value={edu.degree || ''}
                              placeholder="Grau / Curso"
                              onChange={(e) =>
                                updateCvList('education', 'update', idx, { ...edu, degree: e.target.value })
                              }
                              className="w-full bg-transparent text-xs font-bold text-white outline-none border-b border-white/5 pb-1"
                            />
                            <input
                              type="text"
                              value={edu.institution || ''}
                              placeholder="Instituição"
                              onChange={(e) =>
                                updateCvList('education', 'update', idx, { ...edu, institution: e.target.value })
                              }
                              className="w-full bg-transparent text-[11px] text-gray-400 outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Languages */}
                    <div className="p-4 rounded-xl bg-dark-bg/60 border border-white/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          <span>Idiomas</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() =>
                            updateCvList('languages', 'add', -1, {
                              language: 'Inglês',
                              proficiency: 'Fluente'
                            })
                          }
                          className="text-[10px] text-emerald-400 hover:text-white flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Novo</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(cvData.languages || []).map((lang, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row items-stretch gap-2 p-2 rounded-lg bg-dark-surface border border-white/10">
                            <input
                              type="text"
                              value={lang.language || ''}
                              placeholder="Idioma"
                              onChange={(e) =>
                                updateCvList('languages', 'update', idx, { ...lang, language: e.target.value })
                              }
                              className="flex-1 bg-transparent text-xs font-bold text-white outline-none"
                            />
                            <input
                              type="text"
                              value={lang.proficiency || ''}
                              placeholder="Nível (ex: Fluente)"
                              onChange={(e) =>
                                updateCvList('languages', 'update', idx, { ...lang, proficiency: e.target.value })
                              }
                              className="w-full sm:w-28 bg-transparent text-xs sm:text-right text-emerald-400 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => updateCvList('languages', 'remove', idx)}
                              className="text-gray-500 hover:text-rose-400 p-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setCvModalUser(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5"
              >
                Fechar sem Salvar
              </button>

              <button
                type="button"
                onClick={handleSaveUserCv}
                disabled={cvSaving}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white transition shadow-glow flex items-center justify-center gap-2"
              >
                {cvSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Salvar Alterações no Currículo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mini-CMS: Edit / Create Supported Institution */}
      {charityEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4">
          <form
            onSubmit={handleSaveCharity}
            className="glass-panel flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-y-auto border-brand-400/25 bg-gradient-to-br from-dark-surface via-dark-surface to-brand-950/20"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-300">
                  <HeartHandshake className="h-4 w-4" />
                  Curadoria de apoio
                </div>
                <h3 className="mt-2 text-xl font-bold text-white">
                  {editingCharity ? 'Editar instituição' : 'Adicionar instituição'}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Esses dados aparecem no cadastro e na página pública de apoio.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCharityEditor}
                disabled={charitySaving}
                className="min-h-11 min-w-11 rounded-xl p-2 text-gray-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                aria-label="Fechar editor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div>
                  <label htmlFor="charity-name" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Nome da instituição
                  </label>
                  <input
                    id="charity-name"
                    type="text"
                    required
                    maxLength={160}
                    value={charityForm.name}
                    onChange={(e) => setCharityForm({ ...charityForm, name: e.target.value })}
                    placeholder="Ex.: Instituto Ayrton Senna"
                    className="w-full rounded-xl border border-white/10 bg-dark-bg px-4 py-3 text-sm text-white outline-none transition focus:border-brand-400"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                  <div>
                    <label htmlFor="charity-category" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-300">
                      Causa / categoria
                    </label>
                    <input
                      id="charity-category"
                      type="text"
                      required
                      maxLength={80}
                      value={charityForm.category}
                      onChange={(e) => setCharityForm({ ...charityForm, category: e.target.value })}
                      placeholder="Educação, saúde..."
                      className="w-full rounded-xl border border-white/10 bg-dark-bg px-4 py-3 text-sm text-white outline-none transition focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label htmlFor="charity-order" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-300">
                      Ordem
                    </label>
                    <input
                      id="charity-order"
                      type="number"
                      min="0"
                      max="9999"
                      value={charityForm.displayOrder}
                      onChange={(e) => setCharityForm({ ...charityForm, displayOrder: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-dark-bg px-4 py-3 text-sm text-white outline-none transition focus:border-brand-400"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="charity-url" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Link oficial para contribuição
                  </label>
                  <input
                    id="charity-url"
                    type="url"
                    required
                    value={charityForm.websiteUrl}
                    onChange={(e) => setCharityForm({ ...charityForm, websiteUrl: e.target.value })}
                    placeholder="https://instituicao.org.br/apoie"
                    className="w-full rounded-xl border border-white/10 bg-dark-bg px-4 py-3 text-sm text-white outline-none transition focus:border-brand-400"
                  />
                  <p className="mt-1.5 text-[11px] text-gray-500">Aceitamos somente links http:// ou https://.</p>
                </div>

                <div>
                  <label htmlFor="charity-description" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Descrição curta
                  </label>
                  <textarea
                    id="charity-description"
                    rows={4}
                    maxLength={1000}
                    value={charityForm.description}
                    onChange={(e) => setCharityForm({ ...charityForm, description: e.target.value })}
                    placeholder="Explique em uma ou duas frases o impacto desta instituição."
                    className="w-full resize-y rounded-xl border border-white/10 bg-dark-bg px-4 py-3 text-sm leading-relaxed text-white outline-none transition focus:border-brand-400"
                  />
                  <p className="mt-1.5 text-right text-[10px] text-gray-600">{charityForm.description.length}/1000</p>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-dark-bg/50 p-3.5">
                  <input
                    type="checkbox"
                    checked={charityForm.isActive}
                    onChange={(e) => setCharityForm({ ...charityForm, isActive: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-[var(--color-brand-400)]"
                  />
                  <span>
                    <span className="block text-xs font-bold text-white">Publicar imediatamente</span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-gray-500">Instituições ocultas ficam salvas no CMS, mas não aparecem para novos cadastros.</span>
                  </span>
                </label>
              </div>

              <aside className="self-start rounded-2xl border border-brand-400/20 bg-brand-500/10 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-300">Prévia na página</p>
                <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-400/15 text-sm font-black text-brand-300">
                  {getCharityInitials(charityForm.name)}
                </div>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-300">{charityForm.category || 'Instituição apoiada'}</p>
                <h4 className="mt-1 text-xl font-bold text-white">{charityForm.name || 'Nome da instituição'}</h4>
                <p className="mt-1 truncate text-xs font-mono text-gray-500">{getCharityDomain(charityForm.websiteUrl) || 'link-oficial.org.br'}</p>
                <p className="mt-5 text-sm leading-relaxed text-gray-400">
                  {charityForm.description || 'A descrição curta da instituição aparece aqui para orientar quem está escolhendo uma causa.'}
                </p>
                <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4 text-[11px] text-gray-500">
                  <Shield className="h-3.5 w-3.5 text-brand-300" />
                  Link oficial verificado pelo time
                </div>
              </aside>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-end sm:p-6">
              <button
                type="button"
                onClick={closeCharityEditor}
                disabled={charitySaving}
                className="min-h-11 rounded-xl px-4 text-xs font-semibold text-gray-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={charitySaving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-xs font-bold text-true-black transition hover:bg-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {charitySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingCharity ? 'Salvar alterações' : 'Adicionar à curadoria'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Proof Image Modal */}
      {proofModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-4xl bg-dark-surface border border-white/10 rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col h-[calc(100dvh-1rem)] max-h-[90vh]">
            <div className="flex justify-between items-center gap-3 mb-4">
              <h3 className="text-white font-bold text-lg">Comprovante de apoio</h3>
              <button
                onClick={() => setProofModalUrl(null)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto rounded-xl border border-white/5 bg-dark-bg/50 p-2 flex items-center justify-center">
              {proofModalUrl.toLowerCase().split('?')[0].endsWith('.pdf') ? (
                <iframe
                  src={proofModalUrl}
                  title="Comprovante enviado"
                  className="h-full min-h-[60vh] w-full rounded-lg bg-white"
                />
              ) : (
                <img
                  src={proofModalUrl}
                  alt="Comprovante"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
