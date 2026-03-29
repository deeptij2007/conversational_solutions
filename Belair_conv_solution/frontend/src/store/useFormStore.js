import { create } from 'zustand'
import { getActiveStep, getNextFieldId } from '../constants/schema'

/**
 * Central Zustand store — single source of truth for both panels.
 *
 * Bidirectional sync:
 *   form → agent : setAnswer(id, val, 'user')  → sends form_edit over WS
 *   agent → form : setAnswer(id, val, 'agent') → updates field + triggers highlight
 */
const useFormStore = create((set, get) => ({
  // ── Connection ──────────────────────────────────────────────────────────────
  sessionId: null,
  wsStatus: 'disconnected', // 'connecting' | 'connected' | 'disconnected' | 'error'
  ws: null,

  // ── Form state ──────────────────────────────────────────────────────────────
  answers: {},
  activeStep: 1,          // step currently being worked on
  activeFieldId: null,    // field the agent is currently asking about
  highlightedField: null, // field just updated by agent (briefly highlighted)

  // ── Chat state ──────────────────────────────────────────────────────────────
  messages: [],
  isTyping: false,

  // ── Actions ─────────────────────────────────────────────────────────────────

  initSession: (sessionId) => set({ sessionId }),

  setWs: (ws) => set({ ws }),
  setWsStatus: (wsStatus) => set({ wsStatus }),

  /**
   * Update a single form field answer.
   * source = 'user'  → came from direct form interaction → send to agent via WS
   * source = 'agent' → came from agent tool call       → just update UI + highlight
   */
  setAnswer: (fieldId, value, source = 'user') => {
    const { ws, answers } = get()
    const next = { ...answers, [fieldId]: value }

    set({
      answers: next,
      activeStep: getActiveStep(next),
      activeFieldId: getNextFieldId(next),
      // Highlight the field briefly when agent updates it
      highlightedField: source === 'agent' ? fieldId : get().highlightedField,
    })

    // Clear highlight after animation duration
    if (source === 'agent') {
      setTimeout(() => set({ highlightedField: null }), 1800)
    }

    // Send to agent if user edited directly
    if (source === 'user' && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'form_edit', field_id: fieldId, value }))
    }
  },

  /**
   * Apply a full form_state snapshot from the server (after every agent response).
   */
  applyFormState: (formState) => {
    if (!formState) return
    const answers = formState.answers || {}
    set({
      answers,
      activeStep: getActiveStep(answers),
      activeFieldId: getNextFieldId(answers),
    })
  },

  // ── Chat actions ─────────────────────────────────────────────────────────────

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, { ...msg, id: Date.now() + Math.random() }] })),

  setTyping: (isTyping) => set({ isTyping }),

  /**
   * Send a chat message over WebSocket and optimistically add it to the log.
   */
  sendMessage: (content) => {
    const { ws } = get()
    if (!content.trim() || ws?.readyState !== WebSocket.OPEN) return
    // Show typing indicator only for chat messages (not silent form edits)
    get().addMessage({ role: 'user', content })
    set({ isTyping: true })
    ws.send(JSON.stringify({ type: 'message', content }))
  },
}))

export default useFormStore
