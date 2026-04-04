import { Fragment, useState } from 'react'
import useFormStore from '../store/useFormStore'
import { FORM_SCHEMA } from '../constants/schema'
import RadioField   from './fields/RadioField'
import TextField    from './fields/TextField'
import SelectField  from './fields/SelectField'
import DateField    from './fields/DateField'

const TOTAL_STEPS = FORM_SCHEMA.length

const COVERAGES = [
  { label: 'Third party property damage protection', pct: 0.26 },
  { label: 'Accident and collision protection',      pct: 0.44 },
  { label: 'Extra damage protection',                pct: 0.10 },
  { label: 'Extra medical fund',                     pct: 0.08 },
  { label: 'Accidental death benefits insurance',    pct: 0.07 },
  { label: 'Unexpected expenses',                    pct: 0.05 },
]

// ── Field renderers ───────────────────────────────────────────────────────────

function AgreementField({ field }) {
  const answers   = useFormStore((s) => s.answers)
  const setAnswer = useFormStore((s) => s.setAnswer)
  const checked   = answers[field.id] === 'Yes, I agree'

  return (
    <div className="agreement-box">
      {field.tooltip && (
        <div className="agreement-question">Do you consent to a {field.label.toLowerCase()}?</div>
      )}
      <p className="agreement-text">{field.agreementText}</p>
      <label className="agreement-check-row">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setAnswer(field.id, e.target.checked ? 'Yes, I agree' : '', 'user')}
        />
        <span className="agreement-check-label">Yes, I agree</span>
      </label>
    </div>
  )
}

function FieldRenderer({ field }) {
  if (field.type === 'agreement') return <AgreementField field={field} />
  if (field.type === 'radio')     return <RadioField     field={field} />
  if (field.type === 'select')    return <SelectField    field={field} />
  if (field.type === 'date')      return <DateField      field={field} />
  return <TextField field={field} />
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

// ── Profile card (shown on step 4) ───────────────────────────────────────────

function ProfileCard() {
  const answers   = useFormStore((s) => s.answers)
  const firstName = answers['first_name'] || ''
  const lastName  = answers['last_name']  || ''
  const dob       = answers['date_of_birth'] || ''
  if (!firstName) return null

  const initials = (firstName[0] || '') + (lastName[0] || '')
  return (
    <div className="profile-card">
      <div className="profile-avatar">{initials.toUpperCase()}</div>
      <div className="profile-info">
        <div className="profile-name">{firstName} {lastName}</div>
        {dob && <div className="profile-dob">{dob}</div>}
      </div>
      <span className="profile-tag">Policy holder</span>
    </div>
  )
}

// ── Quote result page ─────────────────────────────────────────────────────────

function QuoteResult() {
  const answers    = useFormStore((s) => s.answers)
  const quotePrice = useFormStore((s) => s.quotePrice)
  const [billing, setBilling]     = useState('Monthly')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })

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
      {/* ── Top: greeting + price ── */}
      <div className="quote-result-top">
        {/* Left */}
        <div className="quote-greet">
          <div className="quote-car-icon">🚗</div>
          <h2>{firstName}, let's get you insured!</h2>

          <label className="quote-date-label">Policy start date</label>
          <input
            type="date"
            className="quote-date-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <button className="quote-continue-btn">Continue</button>
          <a href="tel:18332733903" className="quote-phone">1 833 273-3903</a>
        </div>

        {/* Right — price card */}
        <div className="quote-price-card">
          <div className="quote-original">${originalPrice}.00</div>
          <div className="quote-amount">
            ${quotePrice}<span className="quote-cents">.00</span>
          </div>
          <div className="quote-discount-badge">{discount}% discount applied (up to 25%)</div>

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
            <div className="quote-billing-note">${yearlyPrice}/year</div>
          )}
          <button className="quote-copy-btn">✉ Get a copy of your quote</button>
        </div>
      </div>

      {/* ── Coverage ── */}
      <div className="quote-coverage">
        <h3>Your coverage</h3>
        <p className="quote-coverage-desc">Personalized coverage tailored to your driving profile.</p>
        <div className="quote-coverage-grid">
          {COVERAGES.map((c) => {
            const amt = Math.round(quotePrice * c.pct)
            return (
              <div key={c.label} className="coverage-item">
                <span className="coverage-check">✓</span>
                <div>
                  <div className="coverage-label">{c.label}</div>
                  <div className="coverage-price">${amt}.00</div>
                </div>
              </div>
            )
          })}
        </div>
        <button className="customize-link">Customize →</button>
      </div>

      {/* ── Footer ── */}
      <div className="quote-footer">
        <span className="quote-footer-note">
          Your information is protected. <a href="https://www.belairdirect.com/en/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a> · <a href="https://www.belairdirect.com/en/terms-of-use.html" target="_blank" rel="noopener noreferrer">Terms of Service</a>
        </span>
        <button className="new-quote-btn" onClick={handleNewQuote}>Start a New Quote</button>
      </div>
    </div>
  )
}

// ── Main FormPanel ────────────────────────────────────────────────────────────

export default function FormPanel() {
  const answers          = useFormStore((s) => s.answers)
  const viewStep         = useFormStore((s) => s.viewStep)
  const activeStep       = useFormStore((s) => s.activeStep)
  const activeFieldId    = useFormStore((s) => s.activeFieldId)
  const highlightedField = useFormStore((s) => s.highlightedField)
  const setViewStep      = useFormStore((s) => s.setViewStep)
  const setQuotePrice    = useFormStore((s) => s.setQuotePrice)
  const ws               = useFormStore((s) => s.ws)
  const setTyping        = useFormStore((s) => s.setTyping)

  const total  = FORM_SCHEMA.reduce((n, s) => n + s.fields.filter((f) => f.required !== false).length, 0)
  const filled = FORM_SCHEMA.reduce((n, s) => n + s.fields.filter((f) => f.required !== false && answers[f.id]).length, 0)
  const pct    = Math.round((filled / total) * 100)

  const isQuotePage    = viewStep > TOTAL_STEPS
  const currentStepDef = isQuotePage ? null : FORM_SCHEMA.find((s) => s.step === viewStep)
  const isLastStep     = viewStep === TOTAL_STEPS

  // Step complete = all required fields answered
  const stepComplete = currentStepDef?.fields
    .filter((f) => f.required !== false)
    .every((f) => answers[f.id])

  function handleContinue() {
    if (isLastStep) {
      setQuotePrice(Math.floor(Math.random() * 101) + 200)
      setViewStep(TOTAL_STEPS + 1)
    } else {
      const nextStep = viewStep + 1
      setViewStep(nextStep)
      if (ws?.readyState === WebSocket.OPEN) {
        setTyping(true)
        ws.send(JSON.stringify({ type: 'step_advance', step: nextStep }))
      }
    }
  }

  const continueBtnLabel = isLastStep
    ? 'Get Your Price →'
    : `Continue to Step ${viewStep + 1} →`

  return (
    <aside className="form-panel">
      {/* Progress */}
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
          {/* Stepper */}
          <div className="step-stepper">
            {FORM_SCHEMA.map((s, i) => {
              const stepFilled = s.fields.filter((f) => f.required !== false).every((f) => answers[f.id])
              const isView     = s.step === viewStep
              const canAccess  = s.step <= activeStep

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

          {/* Step page */}
          <div className="step-page">
            {/* Step header */}
            <div className={`step-page-header${currentStepDef?.header ? ' step-page-header--hero' : ''}`}>
              {currentStepDef?.header ? (
                <>
                  <h2 className="step-hero-title">{currentStepDef.header}</h2>
                  <p className="step-hero-desc">{currentStepDef.description}</p>
                  {currentStepDef.showProfileCard && <ProfileCard />}
                </>
              ) : (
                <>
                  <h2 className="step-page-title">Step {viewStep} — {currentStepDef?.title}</h2>
                  {currentStepDef?.description && (
                    <p className="step-page-desc">{currentStepDef.description}</p>
                  )}
                </>
              )}
            </div>

            {/* Fields */}
            <div className="step-fields">
              {currentStepDef?.fields.map((field) => {
                const isAnswered     = Boolean(answers[field.id])
                const isCurrentField = field.id === activeFieldId && viewStep === activeStep
                const isHighlighted  = field.id === highlightedField
                const isAgreement    = field.type === 'agreement'

                if (isAgreement) {
                  return (
                    <div key={field.id} className={`field-row field-row--agreement${isHighlighted ? ' field-highlighted' : ''}`}>
                      <FieldRenderer field={field} />
                    </div>
                  )
                }

                return (
                  <div
                    key={field.id}
                    className={[
                      'field-row',
                      isCurrentField ? 'field-row--current'  : '',
                      isAnswered     ? 'field-row--answered'  : '',
                      isHighlighted  ? 'field-highlighted'    : '',
                      field.required === false ? 'field-row--optional' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="field-label-row">
                      <label className="field-label">
                        {isCurrentField && <span className="field-pulse" />}
                        {field.label}
                        {field.required === false && (
                          <span className="field-optional-tag">optional</span>
                        )}
                      </label>
                      <Tooltip text={field.tooltip} />
                    </div>
                    <FieldRenderer field={field} />
                  </div>
                )
              })}
            </div>

            {/* Footer / Continue */}
            <div className="step-footer">
              <button
                className={`continue-btn${isLastStep ? ' continue-btn--submit' : ''}`}
                disabled={!stepComplete}
                onClick={handleContinue}
              >
                {continueBtnLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
