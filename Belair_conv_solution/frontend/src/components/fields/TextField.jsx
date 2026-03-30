import { useEffect, useState } from 'react'
import useFormStore from '../../store/useFormStore'

export default function TextField({ field, disabled }) {
  const storeVal = useFormStore((s) => s.answers[field.id] ?? '')
  const isHighlighted = useFormStore((s) => s.highlightedField === field.id)
  const setAnswer = useFormStore((s) => s.setAnswer)

  const [localVal, setLocalVal] = useState(storeVal)

  // Sync local display whenever the store value changes (agent fill, session restore, etc.)
  useEffect(() => {
    setLocalVal(storeVal)
  }, [storeVal])

  const commit = () => {
    const trimmed = localVal.trim()
    if (trimmed !== storeVal) {
      setAnswer(field.id, trimmed, 'user')
    }
  }

  return (
    <input
      type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
      className={`text-input ${isHighlighted ? 'field-highlighted' : ''}`}
      value={localVal}
      placeholder={field.placeholder ?? ''}
      disabled={disabled}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      min={field.type === 'number' ? 14 : undefined}
      max={field.type === 'number' ? 25 : undefined}
    />
  )
}
