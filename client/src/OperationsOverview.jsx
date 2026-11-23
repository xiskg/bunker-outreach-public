import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MailCheck,
  MapPinned,
  Plus,
  Settings2,
  Sparkles,
  UsersRound
} from 'lucide-react';

const getFirstName = (name = '') => name.trim().split(/\s+/)[0] || 'por aqui';

const formatCount = (value) => new Intl.NumberFormat('pt-BR').format(Number(value) || 0);

const getSearchLabel = (searchJob) => {
  if (!searchJob || searchJob.status === 'idle') return 'Nenhuma campanha em andamento';
  if (['running', 'searching', 'active'].includes(searchJob.status)) return 'Uma campanha está buscando leads';
  if (searchJob.status === 'completed') return 'Sua última campanha terminou';
  if (searchJob.status === 'stopped') return 'A última campanha foi pausada';
  return 'Confira o status da sua campanha';
};

export default function OperationsOverview({
  user,
  stats,
  settings,
  queue,
  searchJob,
  workerStatus,
  onNavigate
}) {
  const draftsCount = Number(stats?.draftsCount) || queue.filter((item) => item.status === 'draft').length;
  const queuedCount = Number(stats?.queuedCount) || queue.filter((item) => item.status === 'queued').length;
  const sentCount = Number(stats?.sent) || 0;
  const totalLeads = Number(stats?.total) || 0;
  const searchIsActive = ['running', 'searching', 'active'].includes(searchJob?.status);
  const workerIsActive = workerStatus?.status && workerStatus.status !== 'idle';
  const smtpReady = Boolean(settings?.smtp_user && settings?.smtp_pass);
  const profileReady = Boolean(settings?.cv_pdf_uploaded === 'true' || settings?.user_cv && settings.user_cv !== '{}');

  const nextAction = draftsCount > 0
    ? {
      eyebrow: 'Próximo passo',
      title: `Você tem ${formatCount(draftsCount)} ${draftsCount === 1 ? 'rascunho para revisar' : 'rascunhos para revisar'}`,
      detail: 'Leia, ajuste o tom e aprove somente as mensagens que fazem sentido para cada empresa.',
      action: 'Abrir revisão',
      target: 'queue',
      icon: MailCheck
    }
    : searchIsActive
      ? {
        eyebrow: 'Campanha em andamento',
        title: 'Sua busca está encontrando oportunidades',
        detail: 'Você pode acompanhar o progresso ou continuar trabalhando em outra parte da plataforma.',
        action: 'Acompanhar campanha',
        target: 'scraper',
        icon: MapPinned
      }
      : {
        eyebrow: 'Próximo passo',
        title: totalLeads > 0 ? 'Crie uma nova campanha para continuar' : 'Encontre seus primeiros leads',
        detail: totalLeads > 0
          ? 'Escolha um nicho e uma região. O Bunker cuida da primeira coleta para você.'
          : 'Defina um nicho, escolha onde prospectar e deixe a busca trabalhar.',
        action: 'Criar campanha',
        target: 'scraper',
        icon: Plus
      };

  const NextActionIcon = nextAction.icon;
  const setupItems = [
    { label: 'Perfil de abordagem', complete: profileReady, target: 'settings' },
    { label: 'Conta de envio', complete: smtpReady, target: 'settings' },
    { label: 'Primeira campanha', complete: totalLeads > 0 || searchIsActive, target: 'scraper' }
  ];

  return (
    <section className="bunker-home" aria-labelledby="home-title">
      <header className="bunker-page-intro">
        <div>
          <p className="bunker-kicker">Seu espaço de operação</p>
          <h1 id="home-title">Olá, {getFirstName(user?.name)}.</h1>
          <p className="bunker-page-lede">Veja o que precisa da sua atenção e avance uma campanha por vez.</p>
        </div>
        <button type="button" className="bunker-button bunker-button-primary" onClick={() => onNavigate('scraper')}>
          <Plus size={18} aria-hidden="true" />
          Nova campanha
        </button>
      </header>

      <article className="bunker-next-action">
        <div className="bunker-next-action-copy">
          <span className="bunker-kicker">{nextAction.eyebrow}</span>
          <h2>{nextAction.title}</h2>
          <p>{nextAction.detail}</p>
          <div className="bunker-action-row">
            <button type="button" className="bunker-button bunker-button-primary" onClick={() => onNavigate(nextAction.target)}>
              <NextActionIcon size={17} aria-hidden="true" />
              {nextAction.action}
            </button>
            <button type="button" className="bunker-button bunker-button-quiet" onClick={() => onNavigate('queue')}>
              Ver revisão
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="bunker-pipeline" aria-label="Etapas de uma campanha">
          <div className={`bunker-pipeline-step ${totalLeads > 0 || searchIsActive ? 'is-done' : 'is-current'}`}>
            <span className="bunker-pipeline-marker">{totalLeads > 0 || searchIsActive ? <CheckCircle2 size={15} /> : '1'}</span>
            <span>Encontrar</span>
          </div>
          <div className={`bunker-pipeline-step ${draftsCount > 0 ? 'is-current' : totalLeads > 0 ? 'is-done' : ''}`}>
            <span className="bunker-pipeline-marker">{draftsCount > 0 ? <MailCheck size={15} /> : '2'}</span>
            <span>Preparar</span>
          </div>
          <div className={`bunker-pipeline-step ${queuedCount > 0 ? 'is-current' : sentCount > 0 ? 'is-done' : ''}`}>
            <span className="bunker-pipeline-marker">{queuedCount > 0 ? <Clock3 size={15} /> : '3'}</span>
            <span>Enviar</span>
          </div>
        </div>
      </article>

      <div className="bunker-stat-strip" aria-label="Resumo da operação">
        <div className="bunker-stat-item">
          <span className="bunker-stat-label"><UsersRound size={15} /> Leads encontrados</span>
          <strong>{formatCount(totalLeads)}</strong>
        </div>
        <div className="bunker-stat-item">
          <span className="bunker-stat-label"><MailCheck size={15} /> Para revisar</span>
          <strong>{formatCount(draftsCount)}</strong>
        </div>
        <div className="bunker-stat-item">
          <span className="bunker-stat-label"><CheckCircle2 size={15} /> Enviados</span>
          <strong>{formatCount(sentCount)}</strong>
        </div>
        <div className="bunker-stat-item">
          <span className="bunker-stat-label"><Clock3 size={15} /> Na fila</span>
          <strong>{formatCount(queuedCount)}</strong>
        </div>
      </div>

      <div className="bunker-home-grid">
        <section className="bunker-panel bunker-panel-campaign" aria-labelledby="campaign-status-title">
          <div className="bunker-panel-heading">
            <div>
              <p className="bunker-kicker">Acompanhe sem ruído</p>
              <h2 id="campaign-status-title">Campanha atual</h2>
            </div>
            <span className={`bunker-status ${searchIsActive ? 'bunker-status-warning' : workerIsActive ? 'bunker-status-success' : 'bunker-status-neutral'}`}>
              <span className="bunker-status-dot" aria-hidden="true" />
              {searchIsActive ? 'Buscando' : workerIsActive ? 'Em andamento' : 'Parada'}
            </span>
          </div>
          <div className="bunker-campaign-line">
            <div className="bunker-campaign-icon"><MapPinned size={21} /></div>
            <div>
              <strong>{getSearchLabel(searchJob)}</strong>
              <p>{searchJob?.currentCity ? `Agora em ${searchJob.currentCity}` : 'Quando você iniciar uma campanha, o progresso aparece aqui.'}</p>
            </div>
          </div>
          <button type="button" className="bunker-inline-link" onClick={() => onNavigate('scraper')}>
            Ver campanhas <ArrowRight size={15} aria-hidden="true" />
          </button>
        </section>

        <section className="bunker-panel bunker-panel-setup" aria-labelledby="setup-title">
          <div className="bunker-panel-heading">
            <div>
              <p className="bunker-kicker">Pronto para operar?</p>
              <h2 id="setup-title">Checklist rápido</h2>
            </div>
            <Settings2 size={19} aria-hidden="true" />
          </div>
          <div className="bunker-checklist">
            {setupItems.map((item) => (
              <button type="button" key={item.label} className="bunker-check-item" onClick={() => onNavigate(item.target)}>
                <span className={`bunker-check-icon ${item.complete ? 'is-complete' : ''}`}>
                  {item.complete ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
                </span>
                <span>{item.label}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="bunker-home-note" aria-label="Dica do Bunker">
        <Sparkles size={18} aria-hidden="true" />
        <p><strong>Uma boa campanha começa pequena.</strong> Teste uma região, revise os primeiros rascunhos e só depois aumente o alcance.</p>
      </section>
    </section>
  );
}
