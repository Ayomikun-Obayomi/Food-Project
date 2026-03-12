import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

function showError(msg) {
  const el = document.getElementById('root') || document.body
  el.innerHTML = `<div style="padding:24px;color:#f87171;font-family:sans-serif;background:#0a0a0a;min-height:100vh">${msg}</div>`
}

try {
  const root = document.getElementById('root')
  if (!root) {
    showError('Error: #root element not found')
  } else {
    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    )
  }
} catch (err) {
  console.error('Failed to start app:', err)
  showError(`Failed to start: ${err?.message || String(err)}`)
}
