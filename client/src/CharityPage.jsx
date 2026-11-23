import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  HeartHandshake,
  Loader2,
  ShieldCheck
} from 'lucide-react';

const getInitials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'IN';

const getDomain = (url = '') => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export default function CharityPage({ apiBase = '' }) {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadInstitutions = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${apiBase}/api/charities`);
        if (!res.ok) throw new Error('Não foi possível carregar a lista agora.');
        const data = await res.json();
        if (!cancelled) setInstitutions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Não foi possível carregar a lista agora.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadInstitutions();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  return (
    <main className="responsive-screen min-h-screen overflow-x-hidden bg-dark-bg text-gray-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(201,168,76,0.13),transparent_30%),radial-gradient(circle_at_88%_26%,rgba(184,184,192,0.08),transparent_26%)]" />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 py-5 sm:py-6">
          <a href="/" className="flex min-h-11 items-center" aria-label="Voltar para o Bunker">
            <img src="/Union.svg" alt="Bunker" className="logo-image h-auto w-32 sm:w-40" />
          </a>
          <div className="flex items-center gap-2 sm:gap-4">
            <a href="/" className="hidden text-xs font-semibold text-gray-400 transition hover:text-white sm:inline-flex">
              Já tenho acesso
            </a>
            <a
              href="/?modo=cadastro"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-400/40 bg-brand-500/15 px-3.5 text-xs font-bold text-brand-200 transition hover:bg-brand-500/25 sm:px-4"
            >
              <span>Começar cadastro</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </header>

        <section className="grid gap-8 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-16 lg:pb-24 lg:pt-24">
          <div>
            <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.28em] text-brand-300">Bunker / formas de apoio</p>
            <h1 className="max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
              Seu compromisso pode <span className="text-brand-300">seguir outro caminho.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-gray-400 sm:text-lg">
              Nem todo mundo pode doar sangue. Por isso, reunimos instituições sérias que recebem apoio de outras formas — e fazem esse gesto chegar onde importa.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-300" />
                Escolha uma causa
              </span>
              <span className="hidden h-px w-8 bg-white/15 sm:block" />
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-300" />
                Guarde o comprovante
              </span>
              <span className="hidden h-px w-8 bg-white/15 sm:block" />
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-300" />
                Entre para o Bunker
              </span>
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[1.5rem] border border-brand-400/25 bg-gradient-to-br from-brand-500/15 via-dark-surface to-dark-bg p-5 shadow-[0_20px_70px_rgba(0,0,0,0.28)] sm:p-7">
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full border border-brand-300/15" />
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full border border-brand-300/10" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-400/15 text-brand-300">
                  <HeartHandshake className="h-5 w-5" />
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">Apoio real</span>
              </div>
              <h2 className="mt-8 max-w-xs text-2xl font-bold leading-tight text-white sm:text-3xl">
                Uma ação simples. Um impacto que continua.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-gray-400">
                Abra o site oficial da instituição, contribua como puder e anexe o comprovante no seu cadastro.
              </p>
              <div className="mt-8 flex items-start gap-3 border-t border-white/10 pt-4 text-xs leading-relaxed text-gray-500">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                <span>Os links abaixo são mantidos pelo time do Bunker e levam para os canais oficiais.</span>
              </div>
            </div>
          </aside>
        </section>

        <section id="instituicoes" className="scroll-mt-6 border-t border-white/10 pt-8 sm:pt-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-500">Causas apoiadas</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Escolha onde o seu gesto começa.</h2>
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-gray-500 sm:text-right">
              Você será levado ao link oficial de cada instituição para fazer sua contribuição com segurança.
            </p>
          </div>

          {loading ? (
            <div className="mt-8 flex min-h-48 items-center justify-center rounded-2xl border border-white/10 bg-dark-surface/60 text-sm text-gray-400" role="status">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand-300" />
              Carregando instituições...
            </div>
          ) : error ? (
            <div className="mt-8 rounded-2xl border border-rose-500/25 bg-rose-950/20 p-6 text-sm text-rose-300" role="alert">
              {error}
            </div>
          ) : institutions.length === 0 ? (
            <div className="mt-8 flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-dark-surface/40 px-6 text-center">
              <HeartHandshake className="h-8 w-8 text-brand-300" />
              <h3 className="mt-4 text-lg font-bold text-white">A curadoria está sendo atualizada.</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                Em breve, novas instituições estarão disponíveis aqui. Enquanto isso, você pode voltar ao cadastro e escolher a doação de sangue.
              </p>
              <a href="/?modo=cadastro" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-black transition hover:bg-gray-200">
                Voltar para o cadastro
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : (
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {institutions.map((institution, index) => (
                <article
                  key={institution.id}
                  className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-dark-surface/75 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-brand-400/50 hover:bg-dark-surface sm:p-6 ${index === 0 ? 'md:col-span-2 md:p-8' : ''}`}
                >
                  <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full border border-brand-300/10 transition duration-500 group-hover:scale-125" />
                  <div className="relative flex h-full flex-col justify-between gap-8">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3.5">
                        <span className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-400/15 font-bold text-brand-300 ${index === 0 ? 'h-14 w-14 text-base' : 'h-11 w-11 text-xs'}`}>
                          {getInitials(institution.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-brand-300">{institution.category}</p>
                          <h3 className={`mt-1 truncate font-bold text-white ${index === 0 ? 'text-2xl sm:text-3xl' : 'text-lg'}`}>{institution.name}</h3>
                          <p className="mt-1 truncate text-xs font-mono text-gray-600">{getDomain(institution.website_url)}</p>
                        </div>
                      </div>
                      <span className="hidden text-[10px] font-mono text-gray-600 sm:inline">{String(index + 1).padStart(2, '0')}</span>
                    </div>

                    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                      <p className={`max-w-2xl text-sm leading-relaxed text-gray-400 ${index === 0 ? 'sm:text-base' : ''}`}>
                        {institution.description || 'Conheça o trabalho desta instituição e descubra como contribuir.'}
                      </p>
                      <a
                        href={institution.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-xl border border-white/15 px-3.5 text-xs font-bold text-gray-200 transition hover:border-brand-400/50 hover:bg-brand-400/10 hover:text-brand-200 sm:self-auto"
                      >
                        Conhecer e apoiar
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-16 flex flex-col gap-5 border-t border-white/10 pt-6 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>O apoio começa com uma escolha possível.</p>
          <a href="/?modo=cadastro" className="inline-flex min-h-10 items-center gap-2 font-semibold text-brand-300 hover:text-brand-200">
            Anexar meu comprovante
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </footer>
      </div>
    </main>
  );
}
