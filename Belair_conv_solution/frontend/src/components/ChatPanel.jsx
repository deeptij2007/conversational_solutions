import { useRef, useEffect, useState } from 'react'
import useFormStore from '../store/useFormStore'

function TypingIndicator() {
  return (
    <div className="msg msg--assistant">
      <div className="msg-avatar">B</div>
      <div className="msg-bubble msg-bubble--typing">
        <span /><span /><span />
      </div>
    </div>
  )
}

/** Parse markdown [text](url) links into <a> elements. */
function renderContent(text) {
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
  const parts = []
  let last = 0, match
  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(
      <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer" className="chat-link">
        {match[1]}
      </a>
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : text
}

function Message({ msg }) {
  const isUser   = msg.role === 'user'
  const isSystem = msg.role === 'system'

  if (isSystem) {
    return <div className="msg-system">{msg.content}</div>
  }

  return (
    <div className={`msg ${isUser ? 'msg--user' : 'msg--assistant'}`}>
      {!isUser && <div className="msg-avatar">B</div>}
      <div className={`msg-bubble ${isUser ? 'msg-bubble--user' : 'msg-bubble--assistant'}`}>
        {isUser ? msg.content : renderContent(msg.content)}
      </div>
      {isUser && <div className="msg-avatar msg-avatar--user">Me</div>}
    </div>
  )
}

function ConnectionBadge({ status }) {
  const labels = {
    connected:    { text: 'Connected',     cls: 'badge--green'  },
    connecting:   { text: 'Connecting…',   cls: 'badge--yellow' },
    disconnected: { text: 'Reconnecting…', cls: 'badge--red'    },
    error:        { text: 'Error',          cls: 'badge--red'    },
  }
  const { text, cls } = labels[status] ?? labels.disconnected
  return <span className={`connection-badge ${cls}`}>{text}</span>
}

export default function ChatPanel() {
  const messages  = useFormStore((s) => s.messages)
  const isTyping  = useFormStore((s) => s.isTyping)
  const wsStatus  = useFormStore((s) => s.wsStatus)
  const sendMessage = useFormStore((s) => s.sendMessage)

  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const submit = () => {
    const text = input.trim()
    if (!text || wsStatus !== 'connected') return
    sendMessage(text)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const onInput = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const disabled = wsStatus !== 'connected'

  return (
    <section className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-avatar-lg">B</div>
        <div>
          <div className="chat-agent-name">Belair Assistant</div>
          <div className="chat-agent-role">Your quote guide · Quebec auto insurance</div>
        </div>
        <ConnectionBadge status={wsStatus} />
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <p>Starting your quote session…</p>
          </div>
        )}
        {messages.map((msg) => (
          <Message key={msg.id} msg={msg} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          rows={1}
          value={input}
          placeholder={disabled ? 'Connecting…' : 'Type your answer or ask a question…'}
          disabled={disabled}
          onChange={onInput}
          onKeyDown={onKeyDown}
        />
        <button
          className="send-btn"
          disabled={disabled || !input.trim()}
          onClick={submit}
          title="Send (Enter)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </section>
  )
}
