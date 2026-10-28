import { DEFAULT_REINVEST_PERCENT, expenseCategoryLabel } from "@/constants/budget"
import type {
  BudgetExpense,
  BudgetMonth,
  BudgetMonthSummary,
  BudgetParticipant,
  BudgetPayment,
  BudgetSettings,
} from "@/types/budget"

/**
 * Every number Budget Management shows is worked out here, from what the person typed and nothing
 * else, so the month page, the report, the exports and the tests can never disagree. No database
 * and no React: the page and the server both call it.
 *
 * The rule for a month, in the order the owner described it:
 *   profit      = what came in - what went out
 *   fixed       = each participant's fixed amount for the month (paid even in a loss month)
 *   remainder   = profit - fixed
 *   additional  = when the remainder is above nothing, the share of it that is not reinvested
 *                 (half by default), split between the participants by their shares; nothing otherwise
 *   reinvested  = remainder - additional (negative when the month cost the business money)
 *   new balance = previous balance + reinvested
 */

const round = (value: number) => Math.round(value * 100) / 100

/** The amount in the base currency, or null when it is in another one and has no rate yet. */
export function inBase(entry: Pick<BudgetPayment, "amount" | "currency" | "rate">, baseCurrency: string): number | null {
  if (entry.currency === baseCurrency) return entry.amount
  if (!entry.rate || entry.rate <= 0) return null
  return round(entry.amount * entry.rate)
}

const sumInBase = (entries: Pick<BudgetPayment, "amount" | "currency" | "rate">[], baseCurrency: string) => {
  let counted = 0
  let uncounted = 0
  for (const entry of entries) {
    const value = inBase(entry, baseCurrency)
    if (value === null) uncounted += entry.amount
    else counted += value
  }
  return { counted: round(counted), uncounted: round(uncounted) }
}

const total = (values: Record<string, number>) => round(Object.values(values).reduce((sum, value) => sum + (value || 0), 0))

/**
 * The additional distribution worked out from what is left: the participants' part of a positive
 * remainder, split by their shares and rounded to whole units, so what is sent is a number someone
 * can actually transfer. What rounding leaves over stays in the business.
 */
export function autoAdditional(remainder: number, participants: BudgetParticipant[], reinvestPercent: number): Record<string, number> {
  const active = participants.filter((participant) => participant.active)
  const result: Record<string, number> = {}
  for (const participant of active) result[participant.id] = 0
  if (remainder <= 0 || active.length === 0) return result
  const pool = (remainder * (100 - reinvestPercent)) / 100
  const shares = active.reduce((sum, participant) => sum + Math.max(0, participant.share), 0)
  for (const participant of active) {
    const weight = shares > 0 ? Math.max(0, participant.share) / shares : 1 / active.length
    result[participant.id] = Math.floor(pool * weight)
  }
  return result
}

/** The fixed amounts a month starts with when it is first recorded: each active participant's own. */
export function defaultFixed(participants: BudgetParticipant[]): Record<string, number> {
  return Object.fromEntries(participants.filter((participant) => participant.active).map((participant) => [participant.id, participant.fixedAmount]))
}

export function summarizeMonth(month: BudgetMonth | null, monthId: string, settings: BudgetSettings, previousBalance: number): BudgetMonthSummary {
  if (!month) {
    return {
      month: monthId,
      isRecorded: false,
      earning: 0,
      expense: 0,
      profit: 0,
      fixed: {},
      fixedTotal: 0,
      remainder: 0,
      additional: {},
      additionalTotal: 0,
      isAdditionalManual: false,
      transfers: {},
      distributed: 0,
      reinvested: 0,
      previousBalance,
      newBalance: previousBalance,
      uncounted: 0,
      confirmedAt: null,
    }
  }
  const earning = sumInBase(month.payments, settings.baseCurrency)
  const expense = sumInBase(month.expenses, settings.baseCurrency)
  const profit = round(earning.counted - expense.counted)
  const fixedTotal = total(month.fixed)
  const remainder = round(profit - fixedTotal)
  const isAdditionalManual = month.additional !== null
  const additional = month.additional ?? autoAdditional(remainder, settings.participants, settings.reinvestPercent ?? DEFAULT_REINVEST_PERCENT)
  const additionalTotal = total(additional)
  const transfers: Record<string, number> = {}
  for (const id of new Set([...Object.keys(month.fixed), ...Object.keys(additional)])) {
    transfers[id] = round((month.fixed[id] ?? 0) + (additional[id] ?? 0))
  }
  const reinvested = round(remainder - additionalTotal)
  return {
    month: monthId,
    isRecorded: true,
    earning: earning.counted,
    expense: expense.counted,
    profit,
    fixed: month.fixed,
    fixedTotal,
    remainder,
    additional,
    additionalTotal,
    isAdditionalManual,
    transfers,
    distributed: round(fixedTotal + additionalTotal),
    reinvested,
    previousBalance,
    newBalance: round(previousBalance + reinvested),
    uncounted: round(earning.uncounted + expense.uncounted),
    confirmedAt: month.confirmedAt,
  }
}

// ------------------------------------------------------------------ months

export const monthOfDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

export function shiftMonth(month: string, by: number): string {
  const [year, number] = month.split("-").map(Number)
  const index = year * 12 + (number - 1) + by
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`
}

/** "October 2026", read as a calendar month and never shifted by a timezone. */
export function monthLabel(month: string, style: "long" | "short" = "long"): string {
  const [year, number] = month.split("-").map(Number)
  return new Date(Date.UTC(year, number - 1, 1)).toLocaleDateString("en-GB", { month: style, year: "numeric", timeZone: "UTC" })
}

/**
 * Every month the ledger covers, oldest first: from the first month recorded to whichever is later of
 * this month and the last month recorded, with any month in between that has nothing in it yet. So
 * the list grows on its own as the months go by.
 */
export function ledgerMonths(recorded: string[], currentMonth: string): string[] {
  if (recorded.length === 0) return [currentMonth]
  const sorted = [...recorded].sort()
  const last = sorted[sorted.length - 1] > currentMonth ? sorted[sorted.length - 1] : currentMonth
  const months: string[] = []
  for (let month = sorted[0]; month <= last; month = shiftMonth(month, 1)) months.push(month)
  return months
}

/** The whole ledger, oldest first, each month carrying the balance the one before it ended on. */
export function buildLedger(months: BudgetMonth[], settings: BudgetSettings, currentMonth: string): BudgetMonthSummary[] {
  const byMonth = new Map(months.map((month) => [month.month, month]))
  let balance = settings.openingBalance
  return ledgerMonths([...byMonth.keys()], currentMonth).map((monthId) => {
    const summary = summarizeMonth(byMonth.get(monthId) ?? null, monthId, settings, balance)
    balance = summary.newBalance
    return summary
  })
}

// ------------------------------------------------------------------ report

export interface BudgetTotals {
  earning: number
  expense: number
  profit: number
  fixed: number
  additional: number
  distributed: number
  reinvested: number
  balance: number
  perParticipant: Record<string, number>
  months: number
}

export function totalsOf(ledger: BudgetMonthSummary[], openingBalance: number): BudgetTotals {
  const recorded = ledger.filter((month) => month.isRecorded)
  const perParticipant: Record<string, number> = {}
  for (const month of recorded) {
    for (const [id, amount] of Object.entries(month.transfers)) perParticipant[id] = round((perParticipant[id] ?? 0) + amount)
  }
  const sum = (pick: (month: BudgetMonthSummary) => number) => round(recorded.reduce((value, month) => value + pick(month), 0))
  return {
    earning: sum((month) => month.earning),
    expense: sum((month) => month.expense),
    profit: sum((month) => month.profit),
    fixed: sum((month) => month.fixedTotal),
    additional: sum((month) => month.additionalTotal),
    distributed: sum((month) => month.distributed),
    reinvested: sum((month) => month.reinvested),
    balance: ledger.length > 0 ? ledger[ledger.length - 1].newBalance : openingBalance,
    perParticipant,
    months: recorded.length,
  }
}

export interface BreakdownRow {
  label: string
  amount: number
  count: number
}

const addTo = (rows: Map<string, BreakdownRow>, label: string, amount: number) => {
  const key = label.trim() || "Not given"
  const row = rows.get(key.toLowerCase()) ?? { label: key, amount: 0, count: 0 }
  row.amount = round(row.amount + amount)
  row.count += 1
  rows.set(key.toLowerCase(), row)
}

const sorted = (rows: Map<string, BreakdownRow>) => [...rows.values()].sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))

/** Each part of a payment, in the base currency: a split payment counts each part, one that is not counts whole. */
export function paymentParts(payment: BudgetPayment, baseCurrency: string): { clientName: string; projectName: string; amount: number }[] {
  const whole = inBase(payment, baseCurrency)
  if (whole === null) return []
  if (payment.parts.length === 0) return [{ clientName: payment.clientName, projectName: payment.projectName, amount: whole }]
  const factor = payment.amount > 0 ? whole / payment.amount : 0
  return payment.parts.map((part) => ({ clientName: part.clientName, projectName: part.projectName, amount: round(part.amount * factor) }))
}

export interface BudgetBreakdowns {
  clients: BreakdownRow[]
  projects: BreakdownRow[]
  sources: BreakdownRow[]
  methods: BreakdownRow[]
  through: BreakdownRow[]
  categories: BreakdownRow[]
  expenses: BreakdownRow[]
}

export function breakdownsOf(months: BudgetMonth[], baseCurrency: string): BudgetBreakdowns {
  const clients = new Map<string, BreakdownRow>()
  const projects = new Map<string, BreakdownRow>()
  const sources = new Map<string, BreakdownRow>()
  const methods = new Map<string, BreakdownRow>()
  const through = new Map<string, BreakdownRow>()
  const categories = new Map<string, BreakdownRow>()
  const expenses = new Map<string, BreakdownRow>()
  for (const month of months) {
    for (const payment of month.payments) {
      const value = inBase(payment, baseCurrency)
      if (value === null) continue
      for (const part of paymentParts(payment, baseCurrency)) {
        addTo(clients, part.clientName, part.amount)
        addTo(projects, part.projectName, part.amount)
      }
      addTo(sources, payment.clientSource, value)
      addTo(methods, payment.method, value)
      addTo(through, payment.receivedThrough, value)
    }
    for (const expense of month.expenses) {
      const value = inBase(expense, baseCurrency)
      if (value === null) continue
      addTo(categories, expenseCategoryLabel(expense.category), value)
      addTo(expenses, expense.name, value)
    }
  }
  return {
    clients: sorted(clients),
    projects: sorted(projects),
    sources: sorted(sources),
    methods: sorted(methods),
    through: sorted(through),
    categories: sorted(categories),
    expenses: sorted(expenses),
  }
}

/** The words a month's own fields were filled with before, offered as suggestions so spellings stay the same. */
export function suggestionsOf(months: BudgetMonth[]) {
  const collect = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const payments = months.flatMap((month) => month.payments)
  return {
    clients: collect(payments.flatMap((payment) => [payment.clientName, ...payment.parts.map((part) => part.clientName)])),
    projects: collect(payments.flatMap((payment) => [payment.projectName, ...payment.parts.map((part) => part.projectName)])),
    sources: collect(payments.map((payment) => payment.clientSource)),
    through: collect(payments.map((payment) => payment.receivedThrough)),
    methods: collect(payments.map((payment) => payment.method)),
    descriptions: collect(payments.map((payment) => payment.description)),
    expenses: collect(months.flatMap((month) => month.expenses.map((expense) => expense.name))),
  }
}

// ------------------------------------------------------------------ money and exports

export function formatMoney(amount: number, currency: string): string {
  const value = Math.round(amount * 100) / 100
  const text = Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 2 })
  return `${value < 0 ? "-" : ""}${currency} ${text}`
}

const csvCell = (value: string | number) => {
  const text = String(value ?? "")
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
export const toCsv = (rows: (string | number)[][]) => rows.map((row) => row.map(csvCell).join(",")).join("\r\n")

const nameOf = (participants: BudgetParticipant[], id: string) => participants.find((participant) => participant.id === id)?.name ?? "Removed participant"

/** Every participant a set of months names, in the order of the settings, then any no longer listed. */
export function participantIdsOf(summaries: BudgetMonthSummary[], participants: BudgetParticipant[]): string[] {
  const named = new Set(summaries.flatMap((summary) => Object.keys(summary.transfers)))
  const ordered = participants.filter((participant) => participant.active || named.has(participant.id)).map((participant) => participant.id)
  return [...ordered, ...[...named].filter((id) => !ordered.includes(id))]
}

/** The month-by-month summary as a spreadsheet: one row a month, with each participant's transfer. */
export function ledgerCsv(ledger: BudgetMonthSummary[], settings: BudgetSettings): string {
  const ids = participantIdsOf(ledger, settings.participants)
  const header = ["Month", "Earning", "Expenses", "Profit", "Fixed distribution", "Additional distribution", ...ids.map((id) => `${nameOf(settings.participants, id)} receives`), "Reinvested", "Previous balance", "New balance", "Status"]
  const rows = ledger
    .filter((month) => month.isRecorded)
    .map((month) => [
      monthLabel(month.month),
      month.earning,
      month.expense,
      month.profit,
      month.fixedTotal,
      month.additionalTotal,
      ...ids.map((id) => month.transfers[id] ?? 0),
      month.reinvested,
      month.previousBalance,
      month.newBalance,
      month.confirmedAt ? "Confirmed" : "Open",
    ])
  return toCsv([[`Amounts in ${settings.baseCurrency}`], header, ...rows])
}

/** Every payment and expense of the months given, as one spreadsheet. */
export function entriesCsv(months: BudgetMonth[], baseCurrency: string): string {
  const rows: (string | number)[][] = [
    ["Month", "Type", "Date", "Client", "Project", "Name / description", "Amount", "Currency", "Rate", `Amount in ${baseCurrency}`, "Client source", "Received through", "Method", "Category"],
  ]
  for (const month of [...months].sort((a, b) => a.month.localeCompare(b.month))) {
    for (const payment of month.payments) {
      rows.push([monthLabel(month.month), "Payment", payment.date, payment.clientName, payment.projectName, payment.description, payment.amount, payment.currency, payment.rate ?? "", inBase(payment, baseCurrency) ?? "", payment.clientSource, payment.receivedThrough, payment.method, ""])
    }
    for (const expense of month.expenses) {
      rows.push([monthLabel(month.month), "Expense", "", "", "", expense.name + (expense.note ? ` (${expense.note})` : ""), expense.amount, expense.currency, expense.rate ?? "", inBase(expense, baseCurrency) ?? "", "", "", "", expenseCategoryLabel(expense.category)])
    }
  }
  return toCsv(rows)
}

export const emptyPayment = (id: string, currency: string, date: string): BudgetPayment => ({
  id,
  clientName: "",
  projectName: "",
  amount: 0,
  currency,
  rate: null,
  clientSource: "",
  receivedThrough: "",
  method: "",
  description: "",
  date,
  parts: [],
})

export const emptyExpense = (id: string, currency: string): BudgetExpense => ({ id, name: "", amount: 0, currency, rate: null, category: "other", note: "" })

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
