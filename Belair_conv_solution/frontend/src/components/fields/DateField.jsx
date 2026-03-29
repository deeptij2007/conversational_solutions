import { useState, useEffect } from 'react'
import useFormStore from '../../store/useFormStore'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
const YEARS = Array.from({ length: 100 }, (_, i) => String(2008 - i))

function parseDOB(val) {
  if (!val) return { m: '', d: '', y: '' }
  const parts = val.split('/')
  return { m: parts[0] ?? '', d: parts[1] ?? '', y: parts[2] ?? '' }
}

export default function DateField({ field, disabled }) {
  const answers = useFormStore((s) => s.answers)
  const highlightedField = useFormStore((s) => s.highlightedField)
  const setAnswer = useFormStore((s) => s.setAnswer)

  const stored = answers[field.id] ?? ''
  const [parts, setParts] = useState(parseDOB(stored))
  const isHighlighted = highlightedField === field.id

  // Sync if agent updates externally
  useEffect(() => {
    if (stored) setParts(parseDOB(stored))
  }, [stored])

  const update = (key, val) => {
    const next = { ...parts, [key]: val }
    setParts(next)
    if (next.m && next.d && next.y) {
      setAnswer(field.id, `${next.m}/${next.d}/${next.y}`, 'user')
    }
  }

  return (
    <div className={`date-group ${isHighlighted ? 'field-highlighted' : ''}`}>
      <select
        className="select-input date-part"
        value={parts.m}
        disabled={disabled}
        onChange={(e) => update('m', e.target.value)}
      >
        <option value="" disabled>Month</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
        ))}
      </select>

      <select
        className="select-input date-part"
        value={parts.d}
        disabled={disabled}
        onChange={(e) => update('d', e.target.value)}
      >
        <option value="" disabled>Day</option>
        {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>

      <select
        className="select-input date-part"
        value={parts.y}
        disabled={disabled}
        onChange={(e) => update('y', e.target.value)}
      >
        <option value="" disabled>Year</option>
        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}
