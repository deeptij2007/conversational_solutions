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
      const TOTAL_FIELDS = 20  // 3+4+5+8 across all steps
      // Restore or create session
      let sid = localStorage.getItem('belair_session_id')
      if (sid) {
        // Verify session still exists on server
        const res = await fetch(`/api/state/${sid}`)
        if (!res.ok) {
          sid = null
        } else {
          const state = await res.json()
          // If the form was fully completed, start a fresh quote on refresh
          if (Object.keys(state.answers || {}).length >= TOTAL_FIELDS) {
            localStorage.removeItem('belair_session_id')
            sid = null
          }
        }
      }
      if (!sid) {
        const res = await fetch('/api/session/new')
        const data = await res.json()
        sid = data.session_id
        localStorage.setItem('belair_session_id', sid)
      }
      initSession(sid)
      setSessionId(sid)
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
