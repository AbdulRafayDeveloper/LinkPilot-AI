import { z } from "zod"
import { BUDGET_EXPENSE_CATEGORY_IDS, BUDGET_LIMITS, BUDGET_MESSAGES, CURRENCY_PATTERN, DATE_PATTERN, DEFAULT_CURRENCY, MONTH_PATTERN } from "@/constants/budget"

/**
 * What Budget Management accepts, on the way in from the page and on the way out of the database,
 * so a stored month is always the shape the calculations expect. Text is trimmed and capped; an
 * amount is a number within reason; anything a row does not carry falls back to empty.
 */
const text = (max: number = BUDGET_LIMITS.text) => z.string().trim().max(max).catch("")
const amount = z.coerce.number().finite().min(0).max(BUDGET_LIMITS.amount).catch(0)
const signedAmount = z.coerce.number().finite().min(-BUDGET_LIMITS.amount).max(BUDGET_LIMITS.amount).catch(0)
const id = z.string().trim().min(1).max(64)
const currency = z.string().trim().toUpperCase().regex(CURRENCY_PATTERN).catch(DEFAULT_CURRENCY)
const rate = z.coerce.number().finite().positive().max(1_000_000).nullable().catch(null)

export const MonthIdSchema = z.string().regex(MONTH_PATTERN, BUDGET_MESSAGES.invalidMonth)

const PartSchema = z.object({ id, clientName: text(), projectName: text(), amount })

export const PaymentSchema = z.object({
  id,
  clientName: text(),
  projectName: text(),
  amount,
  currency,
  rate,
  clientSource: text(),
  receivedThrough: text(),
  method: text(),
  description: text(BUDGET_LIMITS.description),
  date: z.string().regex(DATE_PATTERN).or(z.literal("")).catch(""),
  parts: z.array(PartSchema).max(BUDGET_LIMITS.parts).catch([]),
})

export const ExpenseSchema = z.object({
  id,
  name: text(),
  amount,
  currency,
  rate,
  category: z.enum(BUDGET_EXPENSE_CATEGORY_IDS).catch("other"),
  note: text(BUDGET_LIMITS.description),
})

const PerParticipant = z.record(id, amount)

export const MonthBodySchema = z
  .object({
    payments: z.array(PaymentSchema).max(BUDGET_LIMITS.payments),
    expenses: z.array(ExpenseSchema).max(BUDGET_LIMITS.expenses),
    fixed: PerParticipant,
    additional: PerParticipant.nullable(),
    // true confirms the distribution now, false opens the month again, left out keeps it as it is
    confirmed: z.boolean().optional(),
  })
  .superRefine((body, context) => {
    // A split payment must be split exactly, or the report would count money twice or not at all
    body.payments.forEach((payment, index) => {
      if (payment.parts.length === 0) return
      const parts = payment.parts.reduce((sum, part) => sum + part.amount, 0)
      if (Math.abs(parts - payment.amount) > 0.009) context.addIssue({ code: "custom", message: BUDGET_MESSAGES.partsDontAdd, path: ["payments", index, "parts"] })
    })
  })

export const ParticipantSchema = z.object({
  id,
  name: z.string().trim().min(1, BUDGET_MESSAGES.participantMissing).max(80),
  fixedAmount: amount,
  share: z.coerce.number().finite().min(0).max(1000).catch(1),
  active: z.boolean().catch(true),
})

export const SettingsSchema = z.object({
  baseCurrency: currency,
  openingBalance: signedAmount,
  reinvestPercent: z.coerce.number().finite().min(0).max(100).catch(50),
  participants: z.array(ParticipantSchema).max(BUDGET_LIMITS.participants),
})

// Reading a stored month back: whatever is unreadable falls back rather than failing the page
export const StoredPaymentsSchema = z.array(PaymentSchema).catch([])
export const StoredExpensesSchema = z.array(ExpenseSchema).catch([])
export const StoredPerParticipantSchema = PerParticipant.catch({})
export const StoredParticipantsSchema = z.array(ParticipantSchema).catch([])
