import {
  AlertTriangle,
  CheckCircle,
  Globe,
  Loader2,
  MapPin,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Square
} from 'lucide-react';

const COUNTRIES = [
  { value: 'BR', label: 'Brasil', flag: '🇧🇷' },
  { value: 'CA', label: 'Canadá', flag: '🇨🇦' },
  { value: 'US', label: 'Estados Unidos', flag: '🇺🇸' },
  { value: 'UK', label: 'Reino Unido', flag: '🇬🇧' },
  { value: 'PT', label: 'Portugal', flag: '🇵🇹' }
];

const getCountryName = (countryCode) =>
  COUNTRIES.find((country) => country.value === countryCode)?.label || countryCode;

export default function CampaignWorkspace({
  scraperStatus,
  searchJob,
  scraperQuery,
  setScraperQuery,
  scraperCountry,
  handleCountryChange,
  popularCitiesByCountry,
  selectedCities,
  handleCityCheckbox,
  customCity,
  setCustomCity,
  handleAddCustomCity,
  searchMode,
  setSearchMode,
  searchGoal,
  setSearchGoal,
  scraperMaxResults,
  setScraperMaxResults,
  dailyQuota,
  fetchScraperStatus,
  handleStartSearch,
  handleStopSearch,
  isLoading,
  scraperLogEndRef,
  triggerNotification
}) {
  const dailyLimit = Math.max(Number(dailyQuota.dailyLimit) || 50, 1);
  const usedToday = Math.max(Number(dailyQuota.usedToday) || 0, 0);
  const remainingToday = Math.max(Number(dailyQuota.remainingToday) || 0, 0);
  const quotaPercent = Math.min(100, (usedToday / dailyLimit) * 100);
  const isRunning = searchJob.status === 'running';
  const cities = popularCitiesByCountry[scraperCountry] || [];

  const handleGoalChange = (event) => {
    const value = Number.parseInt(event.target.value, 10) || 0;
    if (value > 50) {
      triggerNotification('O máximo permitido é de 50 leads por campanha.', 'warning');
      setSearchGoal(50);
      return;
    }
    setSearchGoal(Math.max(value, 1));
  };

  return (
    <div className="bunker-campaign-workspace">
      <section className="bunker-service-strip" aria-live="polite">
        <div className="bunker-service-status">
          <span className={`bunker-service-icon ${scraperStatus.status === 'running' ? 'is-ready' : 'is-waiting'}`}>
            {scraperStatus.status === 'running' ? <CheckCircle size={20} aria-hidden="true" /> : <AlertTriangle size={20} aria-hidden="true" />}
          </span>
          <div>
            <div className="bunker-service-title">
              <strong>Busca de empresas</strong>
              <span className={`bunker-status ${scraperStatus.status === 'running' ? 'bunker-status-success' : 'bunker-status-warning'}`}>
                <span className="bunker-status-dot" aria-hidden="true" />
                {scraperStatus.status === 'running' ? 'Pronta para usar' : 'Verificando conexão'}
              </span>
            </div>
            <p>
              {scraperStatus.status === 'running'
                ? 'A busca está conectada. Defina o público abaixo para começar.'
                : 'A busca está em segundo plano. Verifique a conexão antes de começar.'}
            </p>
          </div>
        </div>
        <button type="button" onClick={fetchScraperStatus} disabled={isLoading} className="bunker-button bunker-button-quiet">
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
          Verificar conexão
        </button>
      </section>

      <div className="bunker-campaign-layout">
        <form
          className="bunker-panel bunker-campaign-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleStartSearch();
          }}
        >
          <div className="bunker-panel-heading">
            <div>
              <p className="bunker-kicker">Passo 1</p>
              <h2>Defina o público</h2>
              <p className="bunker-panel-subtitle">Comece pequeno. Você poderá revisar os leads antes de escrever.</p>
            </div>
            <MapPin size={20} aria-hidden="true" />
          </div>

          <fieldset className="bunker-choice-fieldset">
            <legend>Onde procurar?</legend>
            <div className="bunker-choice-grid">
              <button
                type="button"
                className={`bunker-choice-card ${searchMode === 'city' ? 'is-selected' : ''}`}
                aria-pressed={searchMode === 'city'}
                onClick={() => setSearchMode('city')}
              >
                <MapPin size={18} aria-hidden="true" />
                <span>
                  <strong>Cidades selecionadas</strong>
                  <small>Controle preciso da região</small>
                </span>
              </button>
              <button
                type="button"
                className={`bunker-choice-card ${searchMode === 'country' ? 'is-selected' : ''}`}
                aria-pressed={searchMode === 'country'}
                onClick={() => setSearchMode('country')}
              >
                <Globe size={18} aria-hidden="true" />
                <span>
                  <strong>País inteiro</strong>
                  <small>O sistema percorre as cidades</small>
                </span>
              </button>
            </div>
          </fieldset>

          <div className="bunker-form-field">
            <label htmlFor="campaign-query">O que você procura?</label>
            <input
              id="campaign-query"
              type="text"
              value={scraperQuery}
              onChange={(event) => setScraperQuery(event.target.value)}
              placeholder="Ex.: agência de marketing, padaria"
              className="glass-input"
            />
          </div>

          <div className="bunker-form-grid">
            <div className="bunker-form-field">
              <label htmlFor="campaign-country">País</label>
              <select id="campaign-country" value={scraperCountry} onChange={(event) => handleCountryChange(event.target.value)} className="glass-input">
                {COUNTRIES.map((country) => (
                  <option key={country.value} value={country.value}>{country.flag} {country.label}</option>
                ))}
              </select>
            </div>

            <div className="bunker-usage-meter" aria-label={`${usedToday} de ${dailyLimit} leads usados hoje`}>
              <div className="bunker-usage-meter-heading">
                <span><Shield size={14} aria-hidden="true" /> Cota de hoje</span>
                <strong>{usedToday}/{dailyLimit}</strong>
              </div>
              <div className="bunker-usage-meter-track" aria-hidden="true">
                <span style={{ width: `${quotaPercent}%` }} />
              </div>
              <small>{remainingToday > 0 ? `${remainingToday} leads disponíveis` : 'Cota esgotada hoje'}</small>
            </div>
          </div>

          {searchMode === 'city' ? (
            <fieldset className="bunker-city-fieldset">
              <legend>Cidades</legend>
              <p className="bunker-field-help">Selecione uma ou mais cidades em {getCountryName(scraperCountry)}.</p>
              <div className="bunker-city-list">
                {cities.map((city) => (
                  <label key={city} className={`bunker-city-option ${selectedCities.includes(city) ? 'is-selected' : ''}`}>
                    <input type="checkbox" checked={selectedCities.includes(city)} onChange={() => handleCityCheckbox(city)} />
                    <span>{city}</span>
                  </label>
                ))}
              </div>
              <div className="bunker-custom-city">
                <label htmlFor="campaign-custom-city" className="sr-only">Adicionar outra cidade</label>
                <input
                  id="campaign-custom-city"
                  type="text"
                  value={customCity}
                  onChange={(event) => setCustomCity(event.target.value)}
                  placeholder="Adicionar outra cidade"
                  className="glass-input"
                />
                <button type="button" onClick={handleAddCustomCity} className="bunker-button bunker-button-quiet">
                  <Plus size={15} aria-hidden="true" /> Adicionar
                </button>
              </div>
              <div className="bunker-selected-count" aria-live="polite">
                {selectedCities.length > 0 ? `${selectedCities.length} ${selectedCities.length === 1 ? 'cidade selecionada' : 'cidades selecionadas'}` : 'Selecione pelo menos uma cidade'}
              </div>
            </fieldset>
          ) : (
            <div className="bunker-national-note">
              <Globe size={18} aria-hidden="true" />
              <div>
                <strong>Busca nacional em {getCountryName(scraperCountry)}</strong>
                <p>A plataforma vai percorrer as cidades disponíveis até alcançar a meta definida.</p>
              </div>
              <div className="bunker-form-field bunker-goal-field">
                <label htmlFor="campaign-goal">Meta de leads</label>
                <div className="bunker-goal-input">
                  <input id="campaign-goal" type="number" min="1" max="50" step="5" value={searchGoal} onChange={handleGoalChange} className="glass-input" />
                  <span>leads</span>
                </div>
                <div className="bunker-preset-row" aria-label="Metas rápidas">
                  {[15, 30, 50].map((preset) => (
                    <button key={preset} type="button" className={searchGoal === preset ? 'is-selected' : ''} onClick={() => setSearchGoal(preset)}>
                      {preset === 50 ? '50 máx.' : preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <details className="bunker-advanced-details">
            <summary>Mais opções de busca</summary>
            <div className="bunker-form-field">
              <div className="bunker-field-row">
                <label htmlFor="campaign-depth">Profundidade por cidade</label>
                <strong>{scraperMaxResults} leads</strong>
              </div>
              <input id="campaign-depth" type="range" min="5" max="50" step="5" value={scraperMaxResults} onChange={(event) => setScraperMaxResults(Math.min(Number.parseInt(event.target.value, 10) || 5, 50))} />
              <span className="bunker-field-help">Máximo de contatos que serão procurados em cada cidade.</span>
            </div>
          </details>

          <div className="bunker-campaign-submit">
            {isRunning ? (
              <button type="button" onClick={handleStopSearch} className="bunker-button bunker-button-danger">
                <Square size={14} aria-hidden="true" /> Cancelar campanha
              </button>
            ) : remainingToday === 0 ? (
              <button type="button" disabled className="bunker-button bunker-button-disabled">
                <Shield size={14} aria-hidden="true" /> Cota de hoje esgotada
              </button>
            ) : (
              <button type="submit" className="bunker-button bunker-button-primary">
                <Play size={15} aria-hidden="true" /> Iniciar campanha
              </button>
            )}
          </div>
        </form>

        <section className="bunker-panel bunker-campaign-progress" aria-live="polite">
          <div className="bunker-panel-heading">
            <div>
              <p className="bunker-kicker">Passo 2</p>
              <h2>Acompanhe a busca</h2>
              <p className="bunker-panel-subtitle">Quando terminar, seus leads aparecem na próxima etapa: revisão.</p>
            </div>
            {isRunning && <Loader2 size={20} className="animate-spin" aria-label="Campanha em andamento" />}
          </div>

          {searchJob.status !== 'idle' && (
            <div className="bunker-progress-summary">
              <div className="bunker-field-row">
                <span>{searchJob.status === 'running' ? 'Buscando agora' : 'Campanha finalizada'}</span>
                <strong>{searchJob.progress || 0}%</strong>
              </div>
              <div className="bunker-progress-track"><span style={{ width: `${Math.min(100, searchJob.progress || 0)}%` }} /></div>
              <small>
                {searchJob.targetGoal > 0 ? `${searchJob.leadsFound || 0} de ${searchJob.targetGoal} leads encontrados` : 'Leads encontrados durante a busca'}
                {searchJob.currentCity ? ` · ${searchJob.currentCity}` : ''}
              </small>
            </div>
          )}

          <div className="bunker-activity-log" aria-label="Atividade da campanha">
            {searchJob.logs.length === 0 ? (
              <div className="bunker-log-empty">
                <MapPin size={28} aria-hidden="true" />
                <strong>Nenhuma campanha iniciada</strong>
                <p>Defina o público ao lado para começar a encontrar empresas.</p>
              </div>
            ) : (
              searchJob.logs.map((log, index) => <div key={`${log}-${index}`}>{log}</div>)
            )}
            <div ref={scraperLogEndRef} />
          </div>
        </section>
      </div>
    </div>
  );
}
