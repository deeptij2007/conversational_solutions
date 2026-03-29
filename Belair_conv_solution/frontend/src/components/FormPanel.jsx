import useFormStore from '../store/useFormStore'
import { FORM_SCHEMA, FIELD_MAP } from '../constants/schema'
import RadioField from './fields/RadioField'
import TextField from './fields/TextField'
import SelectField from './fields/SelectField'
import DateField from './fields/DateField'

function FieldRenderer({ field, disabled }) {
  switch (field.type) {
    case 'radio':  return <RadioField  field={field} disabled={disabled} />
    case 'select': return <SelectField field={field} disabled={disabled} />
    case 'date':   return <DateField   field={field} disabled={disabled} />
    default:       return <TextField   field={field} disabled={disabled} />
  }
}

function Tooltip({ text }) {
  if (!text) return null
  return (
    <div className="tooltip-wrap">
      <button className="tooltip-trigger" title={text}>?</button>
      <div className="tooltip-box">{text}</div>
    </div>
  )
}

function StepCard({ stepDef }) {
  const answers = useFormStore((s) => s.answers)
  const activeStep = useFormStore((s) => s.activeStep)
  const activeFieldId = useFormStore((s) => s.activeFieldId)

  const filled = stepDef.fields.filter((f) => answers[f.id]).length
  const total = stepDef.fields.length
  const complete = filled === total
  const isActive = stepDef.step === activeStep
  const isLocked = stepDef.step > activeStep && !complete

  let cardClass = 'step-card'
  if (complete) cardClass += ' step-card--complete'
  else if (isActive) cardClass += ' step-card--active'
  else if (isLocked) cardClass += ' step-card--locked'

  return (
    <div className={cardClass}>
      {/* Step header */}
      <div className="step-header">
        <div className={`step-badge ${complete ? 'step-badge--done' : isActive ? 'step-badge--active' : ''}`}>
          {complete ? '✓' : stepDef.step}
        </div>
        <div className="step-header-text">
          <div className="step-title">{stepDef.title}</div>
          <div className="step-desc">
            {complete
              ? `All ${total} questions answered`
              : isActive
              ? `${filled} of ${total} answered`
              : 'Complete previous step to unlock'}
          </div>
        </div>
        {complete && <span className="step-complete-tag">Complete</span>}
      </div>

      {/* Step body — visible when active or complete */}
      {(isActive || complete) && (
        <div className="step-body">
          {stepDef.fields.map((field) => {
            const isCurrentField = field.id === activeFieldId
            const isAnswered = Boolean(answers[field.id])

            return (
              <div
                key={field.id}
                className={`field-row ${isCurrentField ? 'field-row--current' : ''} ${isAnswered ? 'field-row--answered' : ''}`}
              >
                <div className="field-label-row">
                  <label className="field-label">
                    {isCurrentField && <span className="field-pulse" />}
                    {field.label}
                  </label>
                  <Tooltip text={field.tooltip} />
                </div>
                <FieldRenderer field={field} disabled={isLocked} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function FormPanel() {
  const answers = useFormStore((s) => s.answers)
  const total = FORM_SCHEMA.reduce((n, s) => n + s.fields.length, 0)
  const filled = Object.keys(answers).length
  const pct = Math.round((filled / total) * 100)

  return (
    <aside className="form-panel">
      {/* Progress bar */}
      <div className="progress-wrap">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-label">{pct}% complete</span>
      </div>

      <div className="steps-list">
        {FORM_SCHEMA.map((step) => (
          <StepCard key={step.step} stepDef={step} />
        ))}
      </div>
    </aside>
  )
}
