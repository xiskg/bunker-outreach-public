import { useEffect, useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  Droplets,
  ExternalLink,
  HeartHandshake,
  ShieldCheck
} from 'lucide-react';

const getInstitutionInitials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'IN';

const getInstitutionDomain = (url = '') => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export default function AuthScreen({ onAuthSuccess, apiBase = '' }) {
  const [isLogin, setIsLogin] = useState(() => {
    const mode = new URLSearchParams(window.location.search).get('modo');
    return mode !== 'cadastro';
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [proof, setProof] = useState(null);
  const [proofType, setProofType] = useState('blood');
  const [institutionId, setInstitutionId] = useState('');
  const [institutions, setInstitutions] = useState([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);
  const [institutionsError, setInstitutionsError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadInstitutions = async () => {
      setInstitutionsLoading(true);
      setInstitutionsError('');
      try {
        const res = await fetch(`${apiBase}/api/charities`);
        if (!res.ok) throw new Error('Não foi possível carregar as instituições.');
        const data = await res.json();
        if (!cancelled) setInstitutions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setInstitutionsError(err.message || 'Não foi possível carregar as instituições.');
        }
      } finally {
        if (!cancelled) setInstitutionsLoading(false);
      }
    };

    void loadInstitutions();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const selectedInstitution = institutions.find(
    (institution) => String(institution.id) === String(institutionId)
  );

  const handleProofTypeChange = (nextType) => {
    setProofType(nextType);
    setError(null);
    if (nextType === 'blood') setInstitutionId('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      let res;
      if (isLogin) {
        res = await fetch(`${apiBase}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password })
        });
      } else {
        if (!proof) {
          throw new Error('Anexe o comprovante da forma de apoio escolhida.');
        }
        if (proofType === 'charity' && !institutionId) {
          throw new Error('Escolha uma instituição antes de enviar o comprovante.');
        }
        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('email', email.trim());
        formData.append('password', password);
        formData.append('proofType', proofType);
        if (proofType === 'charity') formData.append('institutionId', institutionId);
        formData.append('proof', proof);

        res = await fetch(`${apiBase}${endpoint}`, {
          method: 'POST',
          body: formData
        });
      }

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Falha ao processar requisição. Tente novamente.');
      }

      if (isLogin) {
        if (data.token && data.user) {
          localStorage.setItem('bunker_auth_token', data.token);
          localStorage.setItem('bunker_user', JSON.stringify(data.user));
          onAuthSuccess(data.user, data.token);
        } else {
          throw new Error('Resposta inválida do servidor.');
        }
      } else {
        setSuccessMsg(data.message || 'Cadastro enviado com sucesso!');
        setIsLogin(true); // Switch to login view
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="responsive-screen min-h-screen w-full flex items-start sm:items-center justify-center p-4 sm:p-6 bg-dark-bg relative overflow-y-auto font-sans">
      {/* Background ambient glowing spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[min(500px,140vw)] h-[min(500px,140vw)] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[min(500px,140vw)] h-[min(500px,140vw)] bg-cyber-cyan/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8 sm:mb-12 flex flex-col items-center">
          <img src="/Union.svg" alt="Bunker Logo" className="w-48 sm:w-56 h-auto object-contain logo-image opacity-100" />
        </div>

        {/* Main Auth Card */}
        <h1 id="auth-title" className="sr-only">Acesse o Bunker</h1>
        <div className="glass-panel p-5 sm:p-8 border border-white/10 rounded-2xl shadow-2xl relative" aria-labelledby="auth-title">

          {/* Error notification */}
          {error && (
            <div className="mb-6 p-3.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-3 animate-in fade-in duration-200" role="alert" aria-live="assertive">
              <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex bg-dark-bg p-1 rounded-xl mb-6 border border-white/5" role="tablist" aria-label="Acesso ao Bunker">
            <button
              type="button"
              role="tab"
              aria-selected={isLogin}
              id="auth-login-tab"
              aria-controls="auth-form"
              onClick={() => setIsLogin(true)}
              className={`flex-1 min-h-11 py-2 text-sm font-bold rounded-lg transition-all ${
                isLogin
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Acessar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isLogin}
              id="auth-register-tab"
              aria-controls="auth-form"
              onClick={() => setIsLogin(false)}
              className={`flex-1 min-h-11 py-2 text-sm font-bold rounded-lg transition-all ${
                !isLogin
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Success notification */}
          {successMsg && (
            <div className="mb-6 p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-3 animate-in fade-in duration-200" role="status" aria-live="polite">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" id="auth-form" role="tabpanel" aria-labelledby={isLogin ? 'auth-login-tab' : 'auth-register-tab'}>

            {!isLogin && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Seu Nome
                </label>
                <div className="flex items-center gap-3 w-full bg-dark-bg/80 border border-white/10 rounded-xl px-3.5 py-3 focus-within:border-white/40 focus-within:ring-2 focus-within:ring-white/10 transition-all">
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Demo Operator"
                    className="w-full bg-transparent text-base sm:text-sm text-gray-100 placeholder-gray-500 outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                E-mail
              </label>
              <div className="flex items-center gap-3 w-full bg-dark-bg/80 border border-white/10 rounded-xl px-3.5 py-3 focus-within:border-white/40 focus-within:ring-2 focus-within:ring-white/10 transition-all">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="demo@example.com"
                  className="w-full bg-transparent text-base sm:text-sm text-gray-100 placeholder-gray-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Senha
              </label>
              <div className="flex items-center gap-3 w-full bg-dark-bg/80 border border-white/10 rounded-xl px-3.5 py-3 focus-within:border-white/40 focus-within:ring-2 focus-within:ring-white/10 transition-all">
                <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent text-base sm:text-sm text-gray-100 placeholder-gray-500 outline-none"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="min-h-11 min-w-11 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors shrink-0 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <>
                <fieldset className="pt-2 space-y-3">
                  <legend className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
                    Como você quer fazer parte?
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`relative flex gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        proofType === 'blood'
                          ? 'bg-brand-500/10 border-brand-400/60 shadow-[0_0_24px_rgba(201,168,76,0.08)]'
                          : 'bg-dark-bg/60 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <input
                        type="radio"
                        name="proof-type"
                        value="blood"
                        checked={proofType === 'blood'}
                        onChange={() => handleProofTypeChange('blood')}
                        className="sr-only"
                      />
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${proofType === 'blood' ? 'bg-brand-400/20 text-brand-300' : 'bg-white/5 text-gray-500'}`}>
                        <Droplets className="w-4 h-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-white">Doação de sangue</span>
                        <span className="block mt-1 text-[11px] leading-relaxed text-gray-500">Anexe o comprovante da sua doação.</span>
                      </span>
                    </label>

                    <label
                      className={`relative flex gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        proofType === 'charity'
                          ? 'bg-brand-500/10 border-brand-400/60 shadow-[0_0_24px_rgba(201,168,76,0.08)]'
                          : 'bg-dark-bg/60 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <input
                        type="radio"
                        name="proof-type"
                        value="charity"
                        checked={proofType === 'charity'}
                        onChange={() => handleProofTypeChange('charity')}
                        className="sr-only"
                      />
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${proofType === 'charity' ? 'bg-brand-400/20 text-brand-300' : 'bg-white/5 text-gray-500'}`}>
                        <HeartHandshake className="w-4 h-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-white">Apoiar uma instituição</span>
                        <span className="block mt-1 text-[11px] leading-relaxed text-gray-500">Uma alternativa para quem não pode doar sangue.</span>
                      </span>
                    </label>
                  </div>
                </fieldset>

                {proofType === 'charity' && (
                  <div className="rounded-2xl border border-brand-400/25 bg-gradient-to-br from-brand-500/10 via-dark-bg/70 to-dark-bg/70 p-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-400/15 text-brand-300">
                        <HeartHandshake className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Escolha uma causa para apoiar</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                          Contribua pelo link oficial, guarde o comprovante e envie-o abaixo.
                        </p>
                      </div>
                    </div>

                    {institutionsLoading ? (
                      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 p-3 text-xs text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin text-brand-300" />
                        Carregando causas apoiadas...
                      </div>
                    ) : institutionsError ? (
                      <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3 text-xs leading-relaxed text-rose-300" role="alert">
                        {institutionsError} Tente novamente em instantes ou conheça a página completa de apoio.
                      </div>
                    ) : institutions.length === 0 ? (
                      <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-relaxed text-gray-400">
                        Nenhuma instituição está disponível agora. Você pode voltar à opção de doação de sangue ou visitar a página de apoio.
                      </div>
                    ) : (
                      <div className="space-y-2" role="radiogroup" aria-label="Instituições apoiadas">
                        {institutions.map((institution) => {
                          const isSelected = String(institution.id) === String(institutionId);
                          return (
                            <div
                              key={institution.id}
                              className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                                isSelected
                                  ? 'border-brand-400/60 bg-brand-500/10'
                                  : 'border-white/10 bg-dark-bg/40 hover:border-white/25'
                              }`}
                            >
                              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                                <input
                                  type="radio"
                                  name="institution-id"
                                  value={institution.id}
                                  checked={isSelected}
                                  onChange={() => setInstitutionId(String(institution.id))}
                                  className="h-4 w-4 accent-[var(--color-brand-400)]"
                                />
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[11px] font-bold text-brand-300">
                                  {getInstitutionInitials(institution.name)}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-white">{institution.name}</span>
                                  <span className="block truncate text-[10px] uppercase tracking-wider text-gray-500">{institution.category}</span>
                                </span>
                              </label>
                              <a
                                href={institution.website_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-brand-300 hover:bg-brand-400/10 hover:text-brand-200"
                                title={`Abrir ${institution.name}`}
                              >
                                <span className="hidden sm:inline">Abrir</span>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <a href="/apoie" className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-brand-300 hover:text-brand-200">
                      Ver página completa de apoio
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2" htmlFor="auth-proof">
                    {proofType === 'charity' ? 'Comprovante da contribuição' : 'Comprovante da doação'}
                  </label>
                  <div className="flex items-center gap-3 w-full bg-dark-bg/80 border border-white/10 rounded-xl px-3.5 py-3 focus-within:border-white/40 focus-within:ring-2 focus-within:ring-white/10 transition-all">
                    <input
                      id="auth-proof"
                      type="file"
                      accept="image/*,.pdf"
                      required
                      onChange={(e) => setProof(e.target.files?.[0] || null)}
                      className="w-full bg-transparent text-base sm:text-sm text-gray-400 file:mr-4 file:py-2 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer outline-none"
                    />
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-[10px] leading-relaxed text-gray-500">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-400" />
                    JPG, PNG ou PDF de até 10 MB. O anexo será revisado pelo time do Bunker.
                  </p>
                  {selectedInstitution && proofType === 'charity' && (
                    <p className="mt-1 text-[10px] text-brand-300">
                      Instituição selecionada: {selectedInstitution.name} ({getInstitutionDomain(selectedInstitution.website_url)}).
                    </p>
                  )}
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading || (!isLogin && proofType === 'charity' && institutions.length === 0)}
              className="w-full min-h-11 mt-6 py-3 px-4 bg-white hover:bg-gray-200 text-black font-bold text-sm rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <span>{isLogin ? 'Acessar Painel' : 'Enviar Cadastro'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {!isLogin && proofType === 'blood' && (
            <div className="mt-5 border-t border-white/5 pt-4 text-center">
              <a href="/apoie" className="inline-flex min-h-10 items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-brand-300">
                Não pode doar sangue? Conheça outra forma de apoiar
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>


      </div>
    </div>
  );
}
