// Mirrors belair_quote_form.json — single source of truth for rendering
// Field types: 'select' | 'text' | 'radio' | 'email' | 'number' | 'date'

const YEARS = Array.from({ length: 37 }, (_, i) => String(2026 - i))

const KM_RANGES = [
  'Less than 5,000 km',
  '5,000 – 10,000 km',
  '10,001 – 15,000 km',
  '15,001 – 20,000 km',
  '20,001 – 25,000 km',
  'More than 25,000 km',
]

export const FORM_SCHEMA = [
  {
    step: 1,
    title: 'Vehicle Information',
    description: 'Tell us about your vehicle to get started.',
    fields: [
      {
        id: 'vehicle_year',
        label: 'Year',
        type: 'select',
        options: YEARS,
        placeholder: 'Select year',
        tooltip: 'Select the year your vehicle was manufactured.',
      },
      {
        id: 'vehicle_make',
        label: 'Make',
        type: 'text',
        placeholder: 'e.g. Toyota',
        tooltip: 'Enter the make (brand) of your vehicle.',
      },
      {
        id: 'vehicle_model',
        label: 'Model',
        type: 'text',
        placeholder: 'e.g. RAV4',
        tooltip: 'Enter the model of your vehicle. You can also provide the VIN for a quick and precise quote.',
      },
    ],
  },
  {
    step: 2,
    title: 'Vehicle Details',
    description: 'This information helps us customize your coverage.',
    fields: [
      {
        id: 'commute_to_work_school',
        label: 'Do you use your vehicle to commute to work or school?',
        type: 'radio',
        options: ['No', 'Yes'],
      },
      {
        id: 'yearly_kilometres',
        label: 'Yearly kilometres',
        type: 'select',
        options: KM_RANGES,
        placeholder: 'Select range',
        tooltip: 'Estimated total kilometres you drive per year.',
      },
      {
        id: 'car_condition',
        label: 'Condition of the car when you got it',
        type: 'radio',
        options: ['New', 'Used', 'Demo'],
      },
      {
        id: 'anti_theft_system',
        label: 'Anti-theft system?',
        type: 'radio',
        options: ['No', 'Yes'],
        tooltip: 'You could save more if your car has an anti-theft system.',
      },
    ],
  },
  {
    step: 3,
    title: 'Driver Information',
    description: 'Your age could unlock a discount! Enter the details of the registered owner.',
    fields: [
      {
        id: 'first_name',
        label: 'First name',
        type: 'text',
        placeholder: 'As it appears on your driver\'s licence',
        required: true,
      },
      {
        id: 'last_name',
        label: 'Last name',
        type: 'text',
        placeholder: 'As it appears on your driver\'s licence',
        required: true,
      },
      {
        id: 'gender_identity',
        label: 'Gender identity',
        type: 'radio',
        options: ['Male', 'Female', 'X'],
        tooltip: 'As it appears on your driver\'s licence. Gender X acknowledges all identities including but not limited to trans, non-binary, two-spirit, and binary people.',
      },
      {
        id: 'date_of_birth',
        label: 'Date of birth',
        type: 'date',
        tooltip: 'Your date of birth is used to calculate your age and determine applicable discounts.',
      },
      {
        id: 'age_first_licence',
        label: 'Age when you got your first driver\'s licence',
        type: 'number',
        placeholder: 'e.g. 17',
        tooltip: 'Can\'t remember exactly? An approximate age will do.',
      },
    ],
  },
  {
    step: 4,
    title: 'Quote & Confirmation',
    description: 'A few more questions to finalize your personalized quote.',
    fields: [
      {
        id: 'accidents_tickets',
        label: 'Any at-fault accidents or tickets in the past 6 years?',
        type: 'radio',
        options: ['None', 'Yes'],
        tooltip: 'Your driving history affects your insurance premium.',
      },
      {
        id: 'lapse_in_coverage',
        label: 'Have you had a lapse in coverage?',
        type: 'radio',
        options: ['No', 'Yes'],
        tooltip: 'If you were not covered by a car insurance policy for six months or more, this is considered a lapse in coverage.',
      },
      {
        id: 'education_discount',
        label: 'Do you have a university degree?',
        type: 'radio',
        options: ['No', 'Yes'],
        tooltip: 'Unlock a discount if you have a bachelor\'s, master\'s or doctorate degree. Group membership may be verified.',
      },
      {
        id: 'soft_credit_check',
        label: 'Do you consent to a soft credit check?',
        type: 'radio',
        options: ['No', 'Yes'],
        tooltip: 'A soft credit check does not impact your score and could save you up to 25% on your car insurance.',
      },
      {
        id: 'email',
        label: 'Email address',
        type: 'email',
        placeholder: 'To save or send you a copy of your quote',
        tooltip: 'We will only use your email address to save or send you a copy of your quote.',
      },
      {
        id: 'business_use',
        label: 'Do you use your vehicle for business purposes?',
        type: 'radio',
        options: ['No', 'Yes'],
      },
      {
        id: 'safe_driving_program',
        label: 'Would you like to enroll in a safe driving program?',
        type: 'radio',
        options: ['No', 'Yes'],
        tooltip: 'A safe driving program tracks your habits and can unlock discounts based on good driving behaviour.',
      },
      {
        id: 'home_insurance_bundle',
        label: 'Add home insurance for a bundle discount?',
        type: 'radio',
        options: ['No', 'Yes'],
        tooltip: 'Bundling car and home insurance with belairdirect can give you a combined discount on both policies.',
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

// Given current answers, return the next unanswered field id
export function getNextFieldId(answers) {
  for (const step of FORM_SCHEMA) {
    for (const field of step.fields) {
      if (!answers[field.id]) return field.id
    }
  }
  return null
}

// Given current answers, return the active step number
export function getActiveStep(answers) {
  for (const step of FORM_SCHEMA) {
    const allFilled = step.fields.every((f) => answers[f.id])
    if (!allFilled) return step.step
  }
  return FORM_SCHEMA.length
}
