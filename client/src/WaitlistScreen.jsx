import { useState } from 'react';
import { Loader2, CheckCircle, ArrowRight } from 'lucide-react';

export default function WaitlistScreen({ apiBase }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handlePhoneChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);

    let masked = val;
    if (val.length > 2) masked = `(${val.slice(0, 2)}) ${val.slice(2)}`;
    if (val.length > 7) masked = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;

    setPhone(masked);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setErrorMsg('Preencha os dois campos.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const fullUrl = apiBase ? `${apiBase}/api/waitlist` : '/api/waitlist';
      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setErrorMsg(data.error || 'Ocorreu um erro.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Erro de conexão. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="responsive-screen min-h-screen bg-dark-bg flex items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-dark-bg to-dark-bg">
      <div className="w-full max-w-md relative z-10 flex flex-col items-center">

        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(500px,140vw)] h-[min(500px,140vw)] bg-white/5 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Logo */}
        <div className="mb-8 sm:mb-14 relative w-full flex justify-center">
          <img src="/Union.svg" alt="Bunker Logo" className="w-48 sm:w-56 h-auto object-contain logo-image opacity-100" />
        </div>

        {/* Content */}
        <div className="w-full text-center space-y-4 mb-8 relative z-10">
          <h1
            className="text-2xl sm:text-3xl text-white tracking-tight uppercase text-balance font-display font-bold"
          >
            O PRIMEIRO DESAFIO DO BUNKER.
          </h1>
          <h2
            className="text-gray-400 text-sm max-w-[280px] mx-auto leading-relaxed text-balance font-display font-medium"
          >
            Prospecte no automático, de graça. Só pedimos uma coisa: coragem.
          </h2>
        </div>

        {/* Form */}
        <div className="w-full glass-panel p-5 sm:p-8 rounded-2xl border border-white/5 bg-black/40 backdrop-blur-md relative z-10">
          {success ? (
            <div className="flex flex-col items-center text-center space-y-4 animate-fadeIn py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2">
                <CheckCircle size={32} />
              </div>
              <h2 className="text-xl font-bold text-white">Interesse Registrado</h2>
              <p className="text-xs text-gray-400" role="status" aria-live="polite">
                Você está na lista. Avisaremos por WhatsApp quando as próximas vagas forem abertas.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div className="relative group">
                  <label htmlFor="waitlist-name" className="sr-only">Seu nome</label>
                  <input
                    id="waitlist-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu Nome"
                    disabled={loading}
                    className="waitlist-control w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-base sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50 focus:bg-white/10 transition-all duration-300"
                  />
                </div>
                <div className="relative group">
                  <label htmlFor="waitlist-phone" className="sr-only">Seu WhatsApp com DDD</label>
                  <input
                    id="waitlist-phone"
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="Seu WhatsApp (com DDD)"
                    disabled={loading}
                    className="waitlist-control w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-base sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50 focus:bg-white/10 transition-all duration-300"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="text-red-400 text-xs font-medium text-center animate-pulse" role="alert" aria-live="assertive">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-11 flex items-center justify-center gap-2 bg-white hover:bg-gray-200 text-black font-bold py-4 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed group uppercase tracking-widest text-xs"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>Entrar na lista de espera</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-[10px] text-gray-600 font-mono tracking-widest uppercase">
          PROJECT BUNKER // CLASSIFIED
        </div>
      </div>
    </div>
  );
}
