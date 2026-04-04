import { useEffect, useState } from 'react'
import useFormStore from './store/useFormStore'
import { useWebSocket } from './hooks/useWebSocket'
import FormPanel from './components/FormPanel'
import ChatPanel from './components/ChatPanel'

export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const initSession = useFormStore((s) => s.initSession)

  useEffect(() => {
    async function bootstrap() {
      // Always start a fresh session — no memory carried over from previous visits
      const res = await fetch('/api/session/new')
      const data = await res.json()
      initSession(data.session_id)
      setSessionId(data.session_id)
    }
    bootstrap()
  }, [])

  // Connect WebSocket once we have a session ID
  useWebSocket(sessionId)

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-logo">
          <span className="logo-dot" />
          belairdirect
        </div>
        <span className="header-tag">Car Insurance Quote · Quebec · 1 car / 1 driver</span>
        <a
          href="tel:18332733903"
          className="header-phone"
          title="Talk to an agent"
        >
          1 833 273-3903
        </a>
      </header>

      <main className="app-body">
        <FormPanel />
        <ChatPanel />
      </main>
    </div>
  )
}
