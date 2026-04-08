// Mirrors belair_quote_form.json for rendering.
// Field types: 'select' | 'text' | 'radio' | 'email' | 'number' | 'date' | 'agreement'
// visibleWhen: { field, value } — field is only shown/required when the condition is true
// section: string — renders a section header before the first field with that label

const YEARS           = Array.from({ length: 37 }, (_, i) => String(2026 - i))
const KM_RANGES       = [
  'Less than 5,000 km', '5,000 to 10,000 km', '10,000 to 15,000 km',
  '15,000 to 20,000 km', '20,000 to 25,000 km', 'More than 25,000 km',
]
const YEARS_RANGE     = [
  'Less than 1 year', '1 – 2 years', '3 – 5 years', '6 – 10 years', 'More than 10 years',
]

export const FORM_SCHEMA = [
  // ── Step 1 — Vehicle Information ─────────────────────────────────────────────
  {
    step: 1,
    title: 'Vehicle Information',
    description: "What would you do without your car? Let us protect it! Quote for residents of the province of Quebec.",
    fields: [
      {
        id: 'vehicle_year',
        label: 'Year',
        type: 'select',
        options: YEARS,
        placeholder: 'Select year',
        tooltip: 'Select the year your vehicle was manufactured. You can find this on your vehicle ownership documents or proof of insurance card.',
      },
      {
        id: 'vehicle_make',
        label: 'Make',
        type: 'text',
        placeholder: 'e.g. Toyota',
        tooltip: 'You can find the vehicle make on the rear exterior of most cars, on your proof of insurance card (pink slip), or in your vehicle ownership documents. Or, simply provide your VIN instead.',
      },
      {
        id: 'vehicle_model',
        label: 'Model',
        type: 'text',
        placeholder: 'e.g. RAV4',
        tooltip: 'Select the model of your vehicle. You can also find your vehicle using the VIN (Vehicle Identification Number) for a quick and precise quote.',
      },
    ],
  },

  // ── Step 2 — Vehicle Details ──────────────────────────────────────────────────
  {
    step: 2,
    title: 'Vehicle Details',
    description: 'This information will help us customize your coverage.',
    fields: [
      {
        id: 'commute_to_work_school',
        label: 'Do you use your vehicle to commute to work or school?',
        type: 'radio',
        options: ['No', 'Yes'],
        tooltip: 'Accurate commute details are required to help us better understand your daily driving habits. This information is secure and will not be shared with any third party.',
      },
      {
        id: 'yearly_kilometres',
        label: 'Yearly kilometres',
        type: 'select',
        options: KM_RANGES,
        placeholder: 'Select range',
        tooltip: 'Enter the kilometres you drive yearly, including your daily commute and road trips for vacation. You don\'t have to be exact. Just an approximation will do.',
      },
      {
        id: 'car_condition',
        label: 'Condition of the car when you got it',
        type: 'radio',
        options: ['New', 'Used', 'Demo'],
        tooltip: 'A dealership uses a demo car for test drives or to showcase its features to customers. They have fewer kilometres on the odometer and are less expensive than buying a brand new car.',
      },
      {
        id: 'anti_theft_system',
        label: 'Anti-theft system?',
        type: 'radio',
        options: ['No', 'Yes'],
        tooltip: 'You could save more if your car has an anti-theft system.\n\nEngraved parts: A unique code is engraved on main vehicle parts after purchase to easily identify the car if it has been stolen.\n\nSatellite monitoring system: This system is connected to a central surveillance station and helps track a stolen car using GPS or mobile networks.',
      },
    ],
  },

  // ── Step 3 — Driver Information ───────────────────────────────────────────────
  {
    step: 3,
    title: 'Driver Information',
    header: 'Over 800,000 Canadians trust us',
    description: 'Your age could unlock a discount! Start by entering the details of the registered owner of the vehicle.',
    fields: [
      {
        id: 'first_name',
        label: 'First name',
        type: 'text',
        placeholder: "As it appears on your driver's licence",
        required: true,
        tooltip: "Enter your first name exactly as it appears on your driver's licence.",
      },
      {
        id: 'last_name',
        label: 'Last name',
        type: 'text',
        placeholder: "As it appears on your driver's licence",
        required: true,
        tooltip: "Enter your last name exactly as it appears on your driver's licence.",
      },
      {
        id: 'gender_identity',
        label: 'Gender identity',
        type: 'radio',
        options: ['Male', 'Female', 'X'],
        tooltip: "In order to provide an accurate quote, we need to know the gender identity of the individual being insured — as it appears under the Sex listed on their driver's licence.\n\nGender X acknowledges all identities including but not limited to trans, non-binary, two-spirit, and binary people.\n\nWe're committed to ensuring people of all genders and identities feel safe, welcome, and respected.",
      },
      {
        id: 'date_of_birth',
        label: 'Date of birth',
        type: 'date',
        tooltip: 'Your date of birth is used to calculate your age and determine applicable discounts and pricing.',
      },
      {
        id: 'age_first_licence',
        label: "Age when you got your first driver's licence",
        type: 'number',
        placeholder: 'e.g. 17',
        tooltip: "Can't remember how old you were when you got your first driver's licence? Don't worry! An approximate age will do.",
      },
      {
        id: 'years_with_insurer',
        label: 'Number of years with current insurer',
        type: 'select',
        options: YEARS_RANGE,
        placeholder: 'Select',
        tooltip: 'If you were not covered by a car insurance policy for six months or more, this is considered a lapse in coverage.',
        savingsMessage: 'Exclusive savings: In celebration of your insurance history, you could be eligible to unlock a lower price.',
      },
    ],
  },

  // ── Step 4 — Contact Details ─────────────────────────────────────────────────
  {
    step: 4,
    title: 'Contact Details',
    header: 'Last step before your price!',
    description: 'A few contact details to save and send your quote.',
    showProfileCard: true,
    fields: [
      {
        id: 'email',
        label: 'Email address',
        type: 'email',
        placeholder: 'name@domain.com',
        tooltip: 'We will only use your email address to save or send you a copy of your quote.',
      },
      {
        id: 'phone_type',
        label: 'Phone type',
        type: 'select',
        options: ['Mobile', 'Home', 'Work'],
        placeholder: 'Select type',
      },
      {
        id: 'phone_number',
        label: 'Phone number',
        type: 'text',
        placeholder: '555-000-0000',
      },
      {
        id: 'postal_code',
        label: 'Postal code',
        type: 'text',
        placeholder: 'A1A 1A1',
        tooltip: 'Your postal code is used to calculate location-based risk factors for your premium.',
      },
      {
        id: 'years_at_address',
        label: 'Number of years living at this address',
        type: 'select',
        options: YEARS_RANGE,
        placeholder: 'Select',
      },
      {
        id: 'group_member',
        label: 'Are you a member of an eligible employee group, alumni association, or other organization?',
        type: 'text',
        placeholder: 'Enter your employer or association',
        required: false,
        section: 'Exclusive discounts and perks',
        tooltip: 'If you are an employee or alumni of a partner organization, you may qualify for an additional group discount.',
      },
      {
        id: 'education_discount',
        label: 'Are you a university graduate?',
        type: 'radio',
        options: ['No', 'Yes'],
        section: 'Exclusive discounts and perks',
        tooltip: "Unlock a discount if you have a bachelor's, master's or doctorate degree.",
      },
    ],
  },

  // ── Step 5 — Review & Submit ─────────────────────────────────────────────────
  {
    step: 5,
    title: 'Review & Submit',
    header: 'Almost there!',
    description: 'Please review and agree to the following before getting your price.',
    fields: [
      {
        id: 'terms_agreement',
        label: 'Terms of Use',
        type: 'agreement',
        agreementText: 'I have read and agree to the Terms of Use and use of personal information as per the Privacy Promise. I understand that the total estimated price provided is not a guaranteed amount.',
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
        agreementText: "Save up to 25% on all eligible products, without affecting your credit score in any way. Stay in control knowing you can opt out at any time. Don't worry, we'll check your score periodically to help ensure you receive the best price.",
        tooltip: 'A soft credit check provides a basic overview of your credit report without impacting your score. With this information, your price will reflect our best offer and you could save up to 25% on your car insurance.',
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

// Returns true if a field should be visible given current answers
export function isFieldVisible(field, answers) {
  if (!field.visibleWhen) return true
  return answers[field.visibleWhen.field] === field.visibleWhen.value
}

// Given current answers, return the next unanswered required field id
export function getNextFieldId(answers) {
  for (const step of FORM_SCHEMA) {
    for (const field of step.fields) {
      if (field.required === false) continue
      if (!isFieldVisible(field, answers)) continue
      if (!answers[field.id]) return field.id
    }
  }
  return null
}

// Given current answers, return the active step number
export function getActiveStep(answers) {
  for (const step of FORM_SCHEMA) {
    const allFilled = step.fields
      .filter((f) => f.required !== false && isFieldVisible(f, answers))
      .every((f) => answers[f.id])
    if (!allFilled) return step.step
  }
  return FORM_SCHEMA.length
}
