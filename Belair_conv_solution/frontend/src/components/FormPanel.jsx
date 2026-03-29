import { Fragment, useState } from 'react'
import useFormStore from '../store/useFormStore'
import { FORM_SCHEMA } from '../constants/schema'
import RadioField from './fields/RadioField'
import TextField from './fields/TextField'
import SelectField from './fields/SelectField'
import DateField from './fields/DateField'

const TOTAL_STEPS = FORM_SCHEMA.length

const COVERAGES = [
  'Third party property damage protection',
  'Accident and collision protection',
  'Extra damage protection',
  'Extra medical fund',
  'Accidental death benefits insurance',
  'Unexpected expenses',
]

function FieldRenderer({ field }) {
  switch (field.type) {
    case 'radio':  return <RadioField  field={field} />
    case 'select': return <SelectField field={field} />
    case 'date':   return <DateField   field={field} />
    default:       return <TextField   field={field} />
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

function QuoteResult() {
  const answers    = useFormStore((s) => s.answers)
  const quotePrice = useFormStore((s) => s.quotePrice)
  const [billing, setBilling] = useState('Monthly')

  const firstName    = answers['first_name'] || 'there'
  const originalPrice = Math.round(quotePrice * 1.08)
  const discount      = Math.round((1 - quotePrice / originalPrice) * 100)
  const yearlyPrice   = Math.round(quotePrice * 12 * 0.92)

  function handleNewQuote() {
    localStorage.removeItem('belair_session_id')
    window.location.reload()
  }

  return (
    <div className="quote-result">
      {/* Top — greeting + price card */}
      <div className="quote-result-top">
        <div className="quote-greet">
          <div className="quote-car-icon">🚗</div>
          <h2>{firstName}, let's get you insured!</h2>
          <p className="quote-tagline">Your personalized quote is ready.</p>
          <a href="tel:18332733903" className="quote-phone">📞 1 833 273-3903</a>
        </div>

        <div className="quote-price-card">
          <div className="quote-original">${originalPrice}.00</div>
          <div className="quote-amount">
            ${quotePrice}<span className="quote-cents">.00</span>
          </div>
          <div className="quote-period">/ month</div>
          <div className="quote-discount-badge">{discount}% discount applied</div>

          <div className="quote-billing-toggle">
            {['Monthly', 'Yearly'].map((b) => (
              <button
                key={b}
                className={`billing-btn${billing === b ? ' billing-btn--active' : ''}`}
                onClick={() => setBilling(b)}
              >
                {b}
              </button>
            ))}
          </div>
          {billing === 'Yearly' && (
            <div className="quote-billing-note">${yearlyPrice}/year (save 8%)</div>
          )}

          <button className="quote-copy-btn">📋 Get a copy of your quote</button>
        </div>
      </div>

      {/* Coverage */}
      <div className="quote-coverage">
        <h3>Your coverage</h3>
        <p className="quote-coverage-desc">
          Personalized coverage tailored to your driving profile.
        </p>
        <div className="quote-coverage-grid">
          {COVERAGES.map((c) => (
            <div key={c} className="coverage-item">
              <span className="coverage-check">✓</span>
              {c}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="quote-footer">
        <span className="quote-customize">⚙ Customize coverage</span>
        <button className="new-quote-btn" onClick={handleNewQuote}>
          Start a New Quote
        </button>
      </div>
    </div>
  )
}

export default function FormPanel() {
  const answers        = useFormStore((s) => s.answers)
  const viewStep       = useFormStore((s) => s.viewStep)
  const activeStep     = useFormStore((s) => s.activeStep)
  const activeFieldId  = useFormStore((s) => s.activeFieldId)
  const highlightedField = useFormStore((s) => s.highlightedField)
  const setViewStep    = useFormStore((s) => s.setViewStep)
  const setQuotePrice  = useFormStore((s) => s.setQuotePrice)

  const total  = FORM_SCHEMA.reduce((n, s) => n + s.fields.length, 0)
  const filled = Object.keys(answers).length
  const pct    = Math.round((filled / total) * 100)

  const isQuotePage    = viewStep > TOTAL_STEPS
  const currentStepDef = isQuotePage ? null : FORM_SCHEMA.find((s) => s.step === viewStep)
  const stepComplete   = currentStepDef?.fields.every((f) => answers[f.id])
  const isLastStep     = viewStep === TOTAL_STEPS

  function handleContinue() {
    if (isLastStep) {
      setQuotePrice(Math.floor(Math.random() * 101) + 200) // $200–$300
      setViewStep(TOTAL_STEPS + 1)
    } else {
      setViewStep(viewStep + 1)
    }
  }

  return (
    <aside className="form-panel">
      {/* Progress bar */}
      <div className="progress-wrap">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-label">{pct}% complete</span>
      </div>

      {isQuotePage ? (
        <QuoteResult />
      ) : (
        <>
          {/* Step stepper */}
          <div className="step-stepper">
            {FORM_SCHEMA.map((s, i) => {
              const stepFilled  = s.fields.every((f) => answers[f.id])
              const isView      = s.step === viewStep
              const canAccess   = s.step <= activeStep

              return (
                <Fragment key={s.step}>
                  <button
                    className={[
                      'stepper-dot',
                      isView     ? 'stepper-dot--active' : '',
                      stepFilled ? 'stepper-dot--done'   : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => canAccess && setViewStep(s.step)}
                    disabled={!canAccess}
                    title={s.title}
                  >
                    {stepFilled && !isView ? '✓' : s.step}
                  </button>
                  {i < FORM_SCHEMA.length - 1 && (
                    <div className={`stepper-connector${stepFilled ? ' stepper-connector--done' : ''}`} />
                  )}
                </Fragment>
              )
            })}
          </div>

          {/* Step page card */}
          <div className="step-page">
            <div className="step-page-header">
              <h2 className="step-page-title">
                Step {viewStep} — {currentStepDef?.title}
              </h2>
              {currentStepDef?.description && (
                <p className="step-page-desc">{currentStepDef.description}</p>
              )}
            </div>

            <div className="step-fields">
              {currentStepDef?.fields.map((field) => {
                const isAnswered    = Boolean(answers[field.id])
                const isCurrentField = field.id === activeFieldId && viewStep === activeStep
                const isHighlighted = field.id === highlightedField

                return (
                  <div
                    key={field.id}
                    className={[
                      'field-row',
                      isCurrentField ? 'field-row--current'  : '',
                      isAnswered     ? 'field-row--answered'  : '',
                      isHighlighted  ? 'field-highlighted'    : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="field-label-row">
                      <label className="field-label">
                        {isCurrentField && <span className="field-pulse" />}
                        {field.label}
                      </label>
                      <Tooltip text={field.tooltip} />
                    </div>
                    <FieldRenderer field={field} />
                  </div>
                )
              })}
            </div>

            <div className="step-footer">
              <button
                className="continue-btn"
                disabled={!stepComplete}
                onClick={handleContinue}
              >
                {isLastStep ? 'Get My Quote →' : `Continue to Step ${viewStep + 1} →`}
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
