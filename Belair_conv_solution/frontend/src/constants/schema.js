// Mirrors belair_quote_form.json for rendering.
// Steps 4-6 add contact/legal fields handled by the frontend only.
// Field types: 'select' | 'text' | 'radio' | 'email' | 'number' | 'date' | 'agreement'

const YEARS      = Array.from({ length: 37 }, (_, i) => String(2026 - i))
const KM_RANGES  = [
  'Less than 5,000 km', '5,000 – 10,000 km', '10,001 – 15,000 km',
  '15,001 – 20,000 km', '20,001 – 25,000 km', 'More than 25,000 km',
]
const YEARS_AT_ADDRESS = [
  'Less than 1 year', '1 – 2 years', '3 – 5 years', '6 – 10 years', 'More than 10 years',
]

export const FORM_SCHEMA = [
  // ── Step 1 ───────────────────────────────────────────────────────────────────
  {
    step: 1,
    title: 'Vehicle Information',
    description: 'Tell us about your vehicle to get started.',
    fields: [
      { id: 'vehicle_year',  label: 'Year',  type: 'select', options: YEARS, placeholder: 'Select year', tooltip: 'Select the year your vehicle was manufactured.' },
      { id: 'vehicle_make',  label: 'Make',  type: 'text',   placeholder: 'e.g. Toyota', tooltip: 'Enter the make (brand) of your vehicle.' },
      { id: 'vehicle_model', label: 'Model', type: 'text',   placeholder: 'e.g. RAV4', tooltip: 'Enter the model of your vehicle. You can also provide the VIN for a quick and precise quote.' },
    ],
  },

  // ── Step 2 ───────────────────────────────────────────────────────────────────
  {
    step: 2,
    title: 'Vehicle Details',
    description: 'This information helps us customize your coverage.',
    fields: [
      { id: 'commute_to_work_school', label: 'Do you use your vehicle to commute to work or school?', type: 'radio', options: ['No', 'Yes'] },
      { id: 'yearly_kilometres',      label: 'Yearly kilometres',  type: 'select', options: KM_RANGES, placeholder: 'Select range', tooltip: 'Estimated total kilometres you drive per year.' },
      { id: 'car_condition',          label: 'Condition of the car when you got it', type: 'radio', options: ['New', 'Used', 'Demo'] },
      { id: 'anti_theft_system',      label: 'Anti-theft system?', type: 'radio', options: ['No', 'Yes'], tooltip: 'You could save more if your car has an anti-theft system.' },
    ],
  },

  // ── Step 3 ───────────────────────────────────────────────────────────────────
  {
    step: 3,
    title: 'Driver Information',
    description: 'Your age could unlock a discount! Enter the details of the registered owner.',
    fields: [
      { id: 'first_name',        label: 'First name',  type: 'text',   placeholder: "As it appears on your driver's licence", required: true },
      { id: 'last_name',         label: 'Last name',   type: 'text',   placeholder: "As it appears on your driver's licence", required: true },
      { id: 'gender_identity',   label: 'Gender identity', type: 'radio', options: ['Male', 'Female', 'X'], tooltip: "As it appears on your driver's licence. Gender X acknowledges all identities including but not limited to trans, non-binary, two-spirit, and binary people." },
      { id: 'date_of_birth',     label: 'Date of birth', type: 'date', tooltip: 'Your date of birth is used to calculate your age and determine applicable discounts.' },
      { id: 'age_first_licence', label: "Age when you got your first driver's licence", type: 'number', placeholder: 'e.g. 17', tooltip: "Can't remember exactly? An approximate age will do." },
    ],
  },

  // ── Step 4 — "Last step before your price!" ───────────────────────────────
  {
    step: 4,
    title: 'Contact Details',
    header: 'Last step before your price!',
    description: 'Only a few more details could help you save and get a more accurate quote. Your information is safe with us.',
    showProfileCard: true,
    fields: [
      { id: 'email',            label: 'Email address', type: 'email',  placeholder: 'name@domain.com', tooltip: 'We will only use your email to save or send you a copy of your quote.' },
      { id: 'phone_type',       label: 'Phone type',    type: 'select', options: ['Mobile', 'Home', 'Work'], placeholder: 'Select type' },
      { id: 'phone_number',     label: 'Phone number',  type: 'text',   placeholder: '555-000-0000' },
      { id: 'postal_code',      label: 'Postal code',   type: 'text',   placeholder: 'A1A 1A1', tooltip: 'Your postal code helps us calculate your rate accurately.' },
      { id: 'years_at_address', label: 'Number of years living at this address', type: 'select', options: YEARS_AT_ADDRESS, placeholder: 'Select' },
    ],
  },

  // ── Step 5 — "Exclusive Discounts & Perks" ───────────────────────────────
  {
    step: 5,
    title: 'Discounts & Perks',
    header: 'Exclusive discounts and perks',
    description: 'Answer a few questions to unlock the best rate available for you.',
    fields: [
      { id: 'accidents_tickets',    label: 'Any at-fault accidents or tickets in the past 6 years?', type: 'radio',  options: ['None', 'Yes'], tooltip: 'Your driving history affects your insurance premium.' },
      { id: 'lapse_in_coverage',    label: 'Have you had a lapse in coverage of 6 months or more?', type: 'radio',  options: ['No', 'Yes'], tooltip: 'If you were not covered by a car insurance policy for six months or more, this is considered a lapse in coverage.' },
      { id: 'education_discount',   label: 'Are you a university graduate?', type: 'radio', options: ['No', 'Yes'], tooltip: "Unlock a discount if you have a bachelor's, master's or doctorate degree." },
      { id: 'business_use',         label: 'Do you use your vehicle for business purposes?', type: 'radio', options: ['No', 'Yes'] },
      { id: 'safe_driving_program', label: 'Enroll in safe driving program (automerit)?', type: 'radio', options: ['No', 'Yes'], tooltip: 'A safe driving program tracks your habits and can unlock discounts based on good driving behaviour.' },
      { id: 'home_insurance_bundle',label: 'Add home insurance for a bundle discount?', type: 'radio', options: ['No', 'Yes'], tooltip: 'Bundling car and home insurance with belairdirect can give you a combined discount on both policies.' },
      { id: 'group_member',         label: 'Are you a member of an eligible employee group, alumni, or other association?', type: 'text', placeholder: 'Enter your employer, school, etc.', required: false, tooltip: 'Group membership may be verified.' },
    ],
  },

  // ── Step 6 — "Review & Submit" ───────────────────────────────────────────
  {
    step: 6,
    title: 'Review & Submit',
    header: 'Almost there!',
    description: 'Please review the agreements below and click Get Your Price.',
    fields: [
      {
        id: 'terms_agreement',
        label: 'Terms of Use',
        type: 'agreement',
        agreementText: 'I have read and agree to the Terms of Use and use of personal information. I understand that the total estimated price provided is not a guaranteed amount.',
      },
      {
        id: 'contact_permission',
        label: 'Contact permission',
        type: 'agreement',
        agreementText: 'I give belairdirect permission to contact me about its products and services by email, by phone or via other means. I am aware that I may withdraw my consent at any time.',
      },
      {
        id: 'soft_credit_check',
        label: 'Soft credit check consent',
        type: 'agreement',
        agreementText: "Save up to 25% on all eligible products without affecting your credit score in any way. Stay in control knowing you can opt out at any time. Don't worry, we'll check your score periodically to help ensure you receive the best price.",
        tooltip: 'A soft credit check does not impact your score and could save you up to 25% on your car insurance.',
      },
    ],
  },
]

// Flat lookup map: field_id → { field, step }
export const FIELD_MAP = {}
FORM_SCHEMA.forEach((step) => {
  step.fields.forEach((field) => {
    FIELD_MAP[field.id] = { ...field, step: step.step }
  })
})

// Given current answers, return the next unanswered required field id
export function getNextFieldId(answers) {
  for (const step of FORM_SCHEMA) {
    for (const field of step.fields) {
      if (field.required === false) continue   // optional fields don't block
      if (!answers[field.id]) return field.id
    }
  }
  return null
}

// Given current answers, return the active step number
export function getActiveStep(answers) {
  for (const step of FORM_SCHEMA) {
    const allFilled = step.fields
      .filter((f) => f.required !== false)
      .every((f) => answers[f.id])
    if (!allFilled) return step.step
  }
  return FORM_SCHEMA.length
}
