/** One person a month's profit is distributed to. */
export interface BudgetParticipant {
  id: string
  name: string
  // The fixed amount a new month starts with for them; each month keeps its own and may change it
  fixedAmount: number
  // Their weight in the additional distribution (equal shares by default)
  share: number
  // Switched off: no longer given a share, still named in the months they had amounts in
  active: boolean
}

export interface BudgetSettings {
  baseCurrency: string
  // The business balance before the first month recorded
  openingBalance: number
  // What stays in the business of what is left after the fixed distribution
  reinvestPercent: number
  participants: BudgetParticipant[]
}

/** Part of one payment, when a single transfer paid for several clients or projects. */
export interface BudgetPaymentPart {
  id: string
  clientName: string
  projectName: string
  amount: number
}

export interface BudgetPayment {
  id: string
  clientName: string
  projectName: string
  amount: number
  currency: string
  // How many base-currency units one unit of `currency` is worth; null when it is the base currency
  rate: number | null
  // How the client was found (Upwork, LinkedIn, a referral...)
  clientSource: string
  // Whose account the money came through (own account, a partner's profile...)
  receivedThrough: string
  // How it arrived (bank transfer, Remitly, Wise, JazzCash...)
  method: string
  description: string
  // YYYY-MM-DD, or "" when not known
  date: string
  parts: BudgetPaymentPart[]
}

export interface BudgetExpense {
  id: string
  name: string
  amount: number
  currency: string
  rate: number | null
  category: string
  note: string
}

/** A month as it is stored: only what the person typed and decided. */
export interface BudgetMonth {
  month: string
  payments: BudgetPayment[]
  expenses: BudgetExpense[]
  // Per participant id
  fixed: Record<string, number>
  // Per participant id, or null to work it out from what is left
  additional: Record<string, number> | null
  // When the distribution was reviewed and confirmed; null while the month is open
  confirmedAt: string | null
  updatedAt: string | null
}

export interface BudgetLedgerPage {
  settings: BudgetSettings
  months: BudgetMonth[]
}

/** Everything worked out for one month. */
export interface BudgetMonthSummary {
  month: string
  isRecorded: boolean
  earning: number
  expense: number
  // Negative is a loss
  profit: number
  fixed: Record<string, number>
  fixedTotal: number
  // Profit after the fixed distribution
  remainder: number
  additional: Record<string, number>
  additionalTotal: number
  isAdditionalManual: boolean
  // What each participant should be sent this month (fixed + additional)
  transfers: Record<string, number>
  distributed: number
  reinvested: number
  previousBalance: number
  newBalance: number
  // Amounts in another currency with no rate: shown but not counted
  uncounted: number
  confirmedAt: string | null
}
