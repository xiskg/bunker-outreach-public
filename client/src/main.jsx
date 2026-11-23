import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import WaitlistScreen from './WaitlistScreen.jsx'
import CharityPage from './CharityPage.jsx'

const isWaitlist = window.location.pathname === '/waitlist';
const isCharityPage = ['/apoie', '/instituicoes'].includes(window.location.pathname);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isWaitlist ? <WaitlistScreen apiBase="" /> : isCharityPage ? <CharityPage apiBase="" /> : <App />}
  </StrictMode>,
)
