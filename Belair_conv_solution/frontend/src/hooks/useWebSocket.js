import { useEffect, useRef } from 'react'
import useFormStore from '../store/useFormStore'
import { getActiveStep } from '../constants/schema'

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
  const { setWs, setWsStatus, addMessage, setTyping, applyFormState, setAnswer, setViewStep } =
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

        switch (data.type) {
          case 'init':
            // Session restored — sync form and jump to the right step page
            setTyping(false)
            addMessage({ role: 'assistant', content: data.message.content })
            applyFormState(data.form_state)
            setViewStep(getActiveStep(data.form_state?.answers || {}))
            break

          case 'message':
            // Agent responded — show chat bubble + sync form
            setTyping(false)
            addMessage({ role: 'assistant', content: data.message.content })
            applyFormState(data.form_state)
            break

          case 'state_update':
            // Silent form sync after a direct field edit — no chat bubble
            applyFormState(data.form_state)
            break

          // Agent explicitly pushed a single field update (e.g. via tool)
          case 'form_update':
            setAnswer(data.field_id, data.value, 'agent')
            break

          case 'error':
            setTyping(false)
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
