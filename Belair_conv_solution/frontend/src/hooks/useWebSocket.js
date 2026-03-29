import { useEffect, useRef } from 'react'
import useFormStore from '../store/useFormStore'

/**
 * Manages the WebSocket lifecycle for a given sessionId.
 * Handles:
 *   - Initial greeting on connect
 *   - Incoming message routing (chat messages + form state updates)
 *   - Auto-reconnect on disconnect
 */
export function useWebSocket(sessionId) {
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const { setWs, setWsStatus, addMessage, setTyping, applyFormState, setAnswer } =
    useFormStore.getState()

  useEffect(() => {
    if (!sessionId) return

    function connect() {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const url = `${proto}://${window.location.host}/ws/${sessionId}`
      const ws = new WebSocket(url)
      wsRef.current = ws
      setWs(ws)
      setWsStatus('connecting')

      ws.onopen = () => {
        setWsStatus('connected')
        clearTimeout(reconnectTimer.current)
      }

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data)
        setTyping(false)

        switch (data.type) {
          case 'init':
          case 'message':
            addMessage({ role: 'assistant', content: data.message.content })
            applyFormState(data.form_state)
            break

          // Agent explicitly pushed a single field update
          case 'form_update':
            setAnswer(data.field_id, data.value, 'agent')
            break

          case 'error':
            addMessage({ role: 'system', content: `⚠️ ${data.detail}` })
            break

          default:
            break
        }
      }

      ws.onerror = () => setWsStatus('error')

      ws.onclose = () => {
        setWsStatus('disconnected')
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps
}
