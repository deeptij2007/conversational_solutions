import useFormStore from '../../store/useFormStore'

export default function RadioField({ field, disabled }) {
  const answers = useFormStore((s) => s.answers)
  const highlightedField = useFormStore((s) => s.highlightedField)
  const setAnswer = useFormStore((s) => s.setAnswer)

  const value = answers[field.id] ?? ''
  const isHighlighted = highlightedField === field.id

  return (
    <div className={`radio-group ${isHighlighted ? 'field-highlighted' : ''}`}>
      {field.options.map((opt) => (
        <label
          key={opt}
          className={`radio-option ${value === opt ? 'radio-option--selected' : ''} ${disabled ? 'radio-option--disabled' : ''}`}
        >
          <input
            type="radio"
            name={field.id}
            value={opt}
            checked={value === opt}
            disabled={disabled}
            onChange={() => !disabled && setAnswer(field.id, opt, 'user')}
          />
          {opt}
        </label>
      ))}
    </div>
  )
}
