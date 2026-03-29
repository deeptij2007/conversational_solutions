import { useState } from 'react'
import useFormStore from '../../store/useFormStore'

export default function TextField({ field, disabled }) {
  const answers = useFormStore((s) => s.answers)
  const highlightedField = useFormStore((s) => s.highlightedField)
  const setAnswer = useFormStore((s) => s.setAnswer)

  const [localVal, setLocalVal] = useState(answers[field.id] ?? '')
  const isHighlighted = highlightedField === field.id

  // Sync if agent updates the value externally
  const storeVal = answers[field.id] ?? ''
  if (storeVal !== localVal && isHighlighted) {
    setLocalVal(storeVal)
  }

  const commit = () => {
    const trimmed = localVal.trim()
    if (trimmed && trimmed !== answers[field.id]) {
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
