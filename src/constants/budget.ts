import { Calculator, type LucideIcon } from "lucide-react"

/**
 * Budget Management: one person's business money, month by month. They type what came in (the
 * payments) and what went out (the expenses); everything else is worked out (lib/budget.ts): the
 * month's earning, expense and profit, the fixed distribution to each participant, what is left
 * after it split between the business (reinvested) and an additional distribution, the balance the
 * month starts from and the one it ends on, and the report over every month.
 *
 * It replaced the spreadsheet the owner kept one tab per month, and each account keeps its own.
 */

export const BUDGET_HREF = "/finance/budget-management"
export const BUDGET_ENDPOINT = "/api/budget"
export const BUDGET_SETTINGS_ENDPOINT = "/api/budget/settings"
export const budgetMonthEndpoint = (month: string) => `/api/budget/months/${month}`
export const budgetMonthHref = (month: string) => `${BUDGET_HREF}/${month}`

// The module's sidebar entry, under Finance
export const BUDGET_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "finance"
} = {
  // The id it had while it was coming soon, so each account's tool choices still apply to it
  id: "finance-budget-management",
  title: "Budget Management",
  description: "Your business money, month by month",
  icon: Calculator,
  href: BUDGET_HREF,
  group: "finance",
}

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const DEFAULT_CURRENCY = "PKR"
/**
 * The currencies offered first in a picker. Any ISO code is accepted (three capital letters), so a
 * currency not listed here can still be typed; these are the ones a freelancer here is paid in.
 */
export const COMMON_CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "INR", "KWD", "QAR", "OMR", "BHD", "TRY", "MYR", "SGD", "CNY", "JPY", "CHF", "NZD"] as const
export const CURRENCY_PATTERN = /^[A-Z]{3}$/

/**
 * What an expense is, so the report can say where the money goes. The name of an expense is the
 * person's own and changes from month to month; the category is the steady part.
 */
export const BUDGET_EXPENSE_CATEGORIES = [
  { id: "salaries", label: "Salaries & pay" },
  { id: "tools", label: "Tools & software" },
  { id: "platform", label: "Platforms & fees" },
  { id: "marketing", label: "Marketing & ads" },
  { id: "food", label: "Food & parties" },
  { id: "eid", label: "Eid & festivals" },
  { id: "charity", label: "Charity" },
  { id: "travel", label: "Travel" },
  { id: "other", label: "Other" },
] as const
export type BudgetExpenseCategoryId = (typeof BUDGET_EXPENSE_CATEGORIES)[number]["id"]
export const BUDGET_EXPENSE_CATEGORY_IDS = BUDGET_EXPENSE_CATEGORIES.map((category) => category.id) as [
  BudgetExpenseCategoryId,
  ...BudgetExpenseCategoryId[],
]
export const DEFAULT_EXPENSE_CATEGORY: BudgetExpenseCategoryId = "other"
export const expenseCategoryLabel = (id: string) =>
  BUDGET_EXPENSE_CATEGORIES.find((category) => category.id === id)?.label ?? "Other"

// How what is left after the fixed distribution is split: this share stays in the business
export const DEFAULT_REINVEST_PERCENT = 50

export const BUDGET_LIMITS = {
  text: 200,
  description: 500,
  payments: 300,
  expenses: 300,
  parts: 10,
  participants: 10,
  amount: 1_000_000_000_000,
} as const

// How long the month page waits after typing settles before it saves
export const BUDGET_AUTOSAVE_DELAY_MS = 800

export const BUDGET_MESSAGES = {
  loadFailed: "Couldn't load your budget. Please try again.",
  saveFailed: "Couldn't save. Your changes are still here, so try again.",
  settingsSaved: "Settings saved.",
  settingsFailed: "Couldn't save the settings. Please try again.",
  invalidMonth: "That month can't be shown.",
  invalid: "Something in this month can't be saved. Check the amounts and dates.",
  partsDontAdd: "A split payment's parts must add up to the payment.",
  participantMissing: "Give every participant a name.",
  participantInUse: "This person has amounts in some months, so they are kept and switched off instead of being removed.",
  needsRate: (currency: string, base: string) => `Add the rate from ${currency} to ${base}, or this amount is not counted.`,
  monthCleared: "The month was cleared.",
  confirmed: "Distribution confirmed.",
  reopened: "The month is open again.",
  noData: "Nothing has been recorded yet. Open a month and add what came in and what went out.",
  emptyMonth: "Nothing recorded for this month yet.",
} as const
