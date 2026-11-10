import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ANIME_COVER_CACHE } from './lib/animeCoverCache'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'

const preloadRecoveryKey = 'todo-preload-recovery-at'
const preloadClearedKey = 'todo-preload-cache-cleared'
const preloadRecoveryWindow = 30_000

async function clearStaleAppCache() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== ANIME_COVER_CACHE).map((key) => caches.delete(key)))
    }
  } catch {
    // Cache cleanup can fail in private windows; reloading still helps.
  }
}

if (import.meta.env.DEV) {
  void clearStaleAppCache()
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const now = Date.now()
  const lastRecovery = Number(sessionStorage.getItem(preloadRecoveryKey) ?? 0)

  if (now - lastRecovery < preloadRecoveryWindow) {
    if (sessionStorage.getItem(preloadClearedKey)) return
    sessionStorage.setItem(preloadClearedKey, '1')
    void clearStaleAppCache().then(() => window.location.reload())
    return
  }

  sessionStorage.setItem(preloadRecoveryKey, String(now))
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
