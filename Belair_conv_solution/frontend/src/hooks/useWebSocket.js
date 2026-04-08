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
  const pingTimer = useRef(null)
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
        // Send a ping every 30 s to prevent Fly proxy from dropping idle connections
        clearInterval(pingTimer.current)
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
        }, 30_000)
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
            // Agent responded — show chat bubble + sync form answers
            setTyping(false)
            addMessage({ role: 'assistant', content: data.message.content })
            applyFormState(data.form_state)
            // Only refresh quote price when a premium-relevant field was actually updated
            if (useFormStore.getState().quotePrice !== null && data.price_relevant_changed) {
              const newPrice = Math.floor(Math.random() * 101) + 200
              useFormStore.getState().setQuotePrice(newPrice)
              const currentWs = useFormStore.getState().ws
              if (currentWs?.readyState === WebSocket.OPEN) {
                useFormStore.getState().setTyping(true)
                currentWs.send(JSON.stringify({ type: 'quote_shown', price: newPrice, is_refresh: true }))
              }
            }
            break

          case 'price_confirmed':
            // Bot confirmed the quote price — show bubble only, no further price refresh
            setTyping(false)
            addMessage({ role: 'assistant', content: data.message.content })
            break

          case 'state_update':
            // Silent form sync after a direct field edit
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
        clearInterval(pingTimer.current)
        setWsStatus('disconnected')
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer.current)
      clearInterval(pingTimer.current)
      wsRef.current?.close()
    }
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps
}
