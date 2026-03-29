import useFormStore from '../../store/useFormStore'

export default function SelectField({ field, disabled }) {
  const answers = useFormStore((s) => s.answers)
  const highlightedField = useFormStore((s) => s.highlightedField)
  const setAnswer = useFormStore((s) => s.setAnswer)

  const value = answers[field.id] ?? ''
  const isHighlighted = highlightedField === field.id

  return (
    <select
      className={`select-input ${isHighlighted ? 'field-highlighted' : ''}`}
      value={value}
      disabled={disabled}
      onChange={(e) => setAnswer(field.id, e.target.value, 'user')}
    >
      <option value="" disabled>
        {field.placeholder ?? 'Select…'}
      </option>
      {field.options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  )
}
