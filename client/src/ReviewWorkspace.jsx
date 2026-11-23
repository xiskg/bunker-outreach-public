import {
  Bot,
  Edit2,
  ExternalLink,
  Mail,
  Play,
  RefreshCw,
  Send,
  Square,
  Trash2
} from 'lucide-react';

const LANGUAGE_OPTIONS = [
  ['Portuguese', 'Português 🇧🇷'],
  ['English', 'Inglês 🇺🇸'],
  ['Spanish', 'Espanhol 🇪🇸'],
  ['French', 'Francês 🇫🇷'],
  ['German', 'Alemão 🇩🇪'],
  ['Italian', 'Italiano 🇮🇹']
];

const COUNTRY_OPTIONS = [
  ['ALL', 'Todos os países'],
  ['BR', 'Brasil 🇧🇷'],
  ['CA', 'Canadá 🇨🇦'],
  ['US', 'Estados Unidos 🇺🇸'],
  ['UK', 'Reino Unido 🇬🇧'],
  ['PT', 'Portugal 🇵🇹']
];

export default function ReviewWorkspace({
  workerStatus,
  settings,
  handleLanguageChange,
  handleToggleWorker,
  filteredQueue,
  queueCountryFilter,
  setQueueCountryFilter,
  handleRejectAllDrafts,
  fetchQueue,
  selectedDraft,
  setSelectedDraft,
  setIsEditingDraft,
  setEditSubject,
  setEditBody,
  isEditingDraft,
  editSubject,
  editBody,
  handleRejectDraft,
  handleApproveDraft,
  renderStatusBadge,
  workerLogEndRef
}) {
  const isDrafting = workerStatus.status === 'drafting';
  const isSending = workerStatus.status === 'sending';
  const workerLogs = workerStatus.logs || [];

  const selectDraft = (item) => {
    setSelectedDraft(item);
    setIsEditingDraft(false);
    setEditSubject(item.draft_subject || '');
    setEditBody(item.draft_body || '');
  };

  return (
    <div className="bunker-review-workspace">
      <section className="bunker-review-automation" aria-live="polite">
        <div className="bunker-review-automation-copy">
          <p className="bunker-kicker">Automação</p>
          <h2>Do rascunho ao envio</h2>
          <p>Prepare mensagens em lote, revise uma por uma e só envie o que representar bem o seu trabalho.</p>
        </div>
        <div className="bunker-worker-actions">
          <div className={`bunker-worker-card ${isDrafting ? 'is-active is-drafting' : ''}`}>
            <div className="bunker-worker-card-heading">
              <div className="bunker-worker-card-title">
                <Bot size={18} aria-hidden="true" />
                <strong>Preparar mensagens</strong>
              </div>
              {isDrafting && <span className="bunker-status bunker-status-warning"><span className="bunker-status-dot" /> Em andamento</span>}
            </div>
            <p>Gera uma primeira versão personalizada para os leads novos.</p>
            <div className="bunker-worker-language">
              <label htmlFor="review-language">Idioma da mensagem</label>
              <select id="review-language" value={settings.target_language || 'Portuguese'} onChange={(event) => handleLanguageChange(event.target.value)} className="glass-input">
                {LANGUAGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => handleToggleWorker('drafting')} disabled={isSending} className={`bunker-button ${isDrafting ? 'bunker-button-danger' : 'bunker-button-secondary'}`}>
              {isDrafting ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
              {isDrafting ? 'Parar preparação' : 'Preparar rascunhos'}
            </button>
          </div>

          <div className={`bunker-worker-card ${isSending ? 'is-active is-sending' : ''}`}>
            <div className="bunker-worker-card-heading">
              <div className="bunker-worker-card-title">
                <Send size={18} aria-hidden="true" />
                <strong>Envio programado</strong>
              </div>
              {isSending && <span className="bunker-status bunker-status-success"><span className="bunker-status-dot" /> Em andamento</span>}
            </div>
            <p>Envia somente mensagens aprovadas, respeitando o ritmo configurado.</p>
            <div className="bunker-worker-language bunker-worker-language-placeholder" aria-hidden="true">
              <span>Pronto para mensagens aprovadas</span>
            </div>
            <button type="button" onClick={() => handleToggleWorker('sending')} disabled={isDrafting} className={`bunker-button ${isSending ? 'bunker-button-danger' : 'bunker-button-secondary'}`}>
              {isSending ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
              {isSending ? 'Pausar envios' : 'Iniciar envios'}
            </button>
          </div>
        </div>
      </section>

      <div className="bunker-review-layout">
        <section className="bunker-panel bunker-review-list" aria-label="Mensagens para revisar">
          <div className="bunker-panel-heading">
            <div>
              <p className="bunker-kicker">Passo 3</p>
              <h2>Para revisar <span className="bunker-heading-count">{filteredQueue.length}</span></h2>
              <p className="bunker-panel-subtitle">Escolha uma mensagem para abrir os detalhes.</p>
            </div>
            <div className="bunker-review-list-actions">
              <label htmlFor="review-country" className="sr-only">Filtrar por país</label>
              <select id="review-country" value={queueCountryFilter} onChange={(event) => setQueueCountryFilter(event.target.value)} className="glass-input">
                {COUNTRY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="button" onClick={fetchQueue} className="bunker-icon-button" aria-label="Atualizar mensagens" title="Atualizar mensagens">
                <RefreshCw size={15} aria-hidden="true" />
              </button>
              <button type="button" onClick={handleRejectAllDrafts} className="bunker-icon-button bunker-icon-button-danger" aria-label="Rejeitar todos os rascunhos" title="Rejeitar todos os rascunhos">
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="bunker-review-items">
            {filteredQueue.length === 0 ? (
              <div className="bunker-review-empty">
                <Mail size={28} aria-hidden="true" />
                <strong>Você está em dia</strong>
                <p>Quando houver uma mensagem para revisar, ela aparecerá aqui.</p>
              </div>
            ) : (
              filteredQueue.map((item) => (
                <button type="button" key={item.id} aria-pressed={selectedDraft?.id === item.id} aria-label={`Revisar mensagem de ${item.name}`} onClick={() => selectDraft(item)} className={`bunker-review-item ${selectedDraft?.id === item.id ? 'is-selected' : ''}`}>
                  <span className="bunker-review-item-main">
                    <strong>{item.name}</strong>
                    <small>{item.email}</small>
                  </span>
                  <span className="bunker-review-item-meta">
                    <em>{item.country || 'BR'}</em>
                    {renderStatusBadge(item.email_sent)}
                  </span>
                  {item.error_message && <span className="bunker-review-item-error">{item.error_message}</span>}
                </button>
              ))
            )}
          </div>

          <details className="bunker-worker-log-details">
            <summary>Atividade técnica</summary>
            <div className="bunker-worker-log" aria-label="Atividade dos motores">
              {workerLogs.length === 0 ? <p>Nenhuma atividade registrada.</p> : workerLogs.map((log, index) => <div key={`${log}-${index}`}>{log}</div>)}
              <div ref={workerLogEndRef} />
            </div>
          </details>
        </section>

        <section className="bunker-panel bunker-review-detail" aria-label="Detalhes da mensagem">
          {!selectedDraft ? (
            <div className="bunker-review-detail-empty">
              <Mail size={36} aria-hidden="true" />
              <h2>Selecione uma mensagem</h2>
              <p>O texto e os dados do lead aparecerão aqui para você revisar com calma.</p>
            </div>
          ) : (
            <div className="bunker-review-detail-content">
              <header className="bunker-review-detail-header">
                <div>
                  <p className="bunker-kicker">Mensagem selecionada</p>
                  <h2>{selectedDraft.name}</h2>
                  <a href={`mailto:${selectedDraft.email}`}>{selectedDraft.email}</a>
                  {selectedDraft.website && <a href={selectedDraft.website} target="_blank" rel="noreferrer" className="bunker-review-website">{selectedDraft.website}<ExternalLink size={12} aria-hidden="true" /></a>}
                </div>
                <button type="button" onClick={() => setIsEditingDraft(!isEditingDraft)} className="bunker-button bunker-button-quiet">
                  <Edit2 size={14} aria-hidden="true" />
                  {isEditingDraft ? 'Ver prévia' : 'Editar texto'}
                </button>
              </header>

              <div className="bunker-review-fields">
                <div className="bunker-review-field">
                  <label htmlFor="review-subject">Assunto</label>
                  {isEditingDraft ? <input id="review-subject" type="text" value={editSubject} onChange={(event) => setEditSubject(event.target.value)} className="glass-input" /> : <div className="bunker-review-preview bunker-review-subject">{editSubject || 'Assunto vazio'}</div>}
                </div>
                <div className="bunker-review-field">
                  <label htmlFor="review-body">Mensagem</label>
                  {isEditingDraft ? <textarea id="review-body" value={editBody} onChange={(event) => setEditBody(event.target.value)} rows={12} className="glass-input bunker-review-textarea" /> : <div className="bunker-review-preview bunker-review-body">{editBody || 'Mensagem sem conteúdo.'}</div>}
                  {isEditingDraft && <small>As quebras de linha serão preservadas.</small>}
                </div>
              </div>

              <footer className="bunker-review-detail-actions">
                <button type="button" onClick={() => handleRejectDraft(selectedDraft.email)} className="bunker-button bunker-button-danger-quiet">Rejeitar</button>
                <div>
                  <button type="button" onClick={() => handleApproveDraft(selectedDraft.email, false)} className="bunker-button bunker-button-secondary">Colocar na fila</button>
                  <button type="button" onClick={() => handleApproveDraft(selectedDraft.email, true)} className="bunker-button bunker-button-primary"><Send size={14} aria-hidden="true" /> Enviar agora</button>
                </div>
              </footer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
