// Public export uses an explicitly configured external discovery service.
export async function getScraperStatus() { return {status: 'external', logs: []}; }
export function startScraperServer() { return {success: false, message: 'Configure an external service; managed installation is not included.'}; }
export function stopScraperServer() { return {success: false, message: 'External services are managed separately.'}; }
export function downloadScraper() { return startScraperServer(); }
export function installDependencies() { return startScraperServer(); }
