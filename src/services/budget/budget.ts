import { connectDatabase } from "@/lib/db"
import { BudgetMonthModel, BudgetSettingsModel } from "@/models/Budget"
import { DEFAULT_CURRENCY, DEFAULT_REINVEST_PERCENT } from "@/constants/budget"
import { defaultFixed } from "@/lib/budget"
import {
  StoredExpensesSchema,
  StoredParticipantsSchema,
  StoredPaymentsSchema,
  StoredPerParticipantSchema,
} from "@/lib/validation/budget"
import type { BudgetLedgerPage, BudgetMonth, BudgetSettings } from "@/types/budget"
import type { Viewer } from "@/types/auth"

/**
 * Reads and writes one person's budget. **Everything is scoped by the account asking** (`mine`, the
 * account's own id and nothing else): a budget is the person's own money, so not even an admin reads
 * another account's, and no record saved before accounts existed is ever counted in one.
 * Nothing worked out is stored; the page and the exports work it out from this (lib/budget.ts).
 */

const mine = (viewer: Viewer) => ({ ownerId: viewer.id })

type StoredSettings = { baseCurrency?: string; openingBalance?: number; reinvestPercent?: number; participants?: unknown }
type StoredMonth = {
  month: string
  payments?: unknown
  expenses?: unknown
  fixed?: unknown
  additional?: unknown
  confirmedAt?: Date | null
  updatedAt?: Date
}

const toSettings = (record: StoredSettings | null): BudgetSettings => ({
  baseCurrency: record?.baseCurrency || DEFAULT_CURRENCY,
  openingBalance: record?.openingBalance ?? 0,
  reinvestPercent: record?.reinvestPercent ?? DEFAULT_REINVEST_PERCENT,
  participants: StoredParticipantsSchema.parse(record?.participants ?? []),
})

const toMonth = (record: StoredMonth): BudgetMonth => ({
  month: record.month,
  payments: StoredPaymentsSchema.parse(record.payments ?? []),
  expenses: StoredExpensesSchema.parse(record.expenses ?? []),
  fixed: StoredPerParticipantSchema.parse(record.fixed ?? {}),
  additional: record.additional === null || record.additional === undefined ? null : StoredPerParticipantSchema.parse(record.additional),
  confirmedAt: record.confirmedAt ? record.confirmedAt.toISOString() : null,
  updatedAt: record.updatedAt ? record.updatedAt.toISOString() : null,
})

export async function getSettings(viewer: Viewer): Promise<BudgetSettings> {
  await connectDatabase()
  return toSettings((await BudgetSettingsModel.findOne(mine(viewer)).lean()) as StoredSettings | null)
}

/** Settings and every month the person has recorded, oldest first: the whole ledger is small. */
export async function getLedger(viewer: Viewer): Promise<BudgetLedgerPage> {
  await connectDatabase()
  const [settings, months] = await Promise.all([
    BudgetSettingsModel.findOne(mine(viewer)).lean(),
    BudgetMonthModel.find(mine(viewer)).sort({ month: 1 }).lean(),
  ])
  return { settings: toSettings(settings as StoredSettings | null), months: (months as unknown as StoredMonth[]).map(toMonth) }
}

export async function saveSettings(viewer: Viewer, settings: BudgetSettings): Promise<BudgetSettings> {
  await connectDatabase()
  const record = await BudgetSettingsModel.findOneAndUpdate(
    mine(viewer),
    { $set: settings, $setOnInsert: { ownerId: viewer.id } },
    { upsert: true, new: true, lean: true }
  )
  return toSettings(record as StoredSettings | null)
}

export interface MonthWrite {
  payments: BudgetMonth["payments"]
  expenses: BudgetMonth["expenses"]
  fixed: BudgetMonth["fixed"]
  additional: BudgetMonth["additional"]
  confirmed?: boolean
}

/**
 * Writes one month whole: the page holds the month and sends it as it stands. Confirming stamps when
 * the distribution was reviewed, reopening clears it, and a write that says neither keeps whatever
 * the month had.
 */
export async function saveMonth(viewer: Viewer, month: string, write: MonthWrite): Promise<BudgetMonth> {
  await connectDatabase()
  const set: Record<string, unknown> = {
    payments: write.payments,
    expenses: write.expenses,
    fixed: write.fixed,
    additional: write.additional,
  }
  if (write.confirmed === true) set.confirmedAt = new Date()
  if (write.confirmed === false) set.confirmedAt = null
  const record = await BudgetMonthModel.findOneAndUpdate(
    { ...mine(viewer), month },
    { $set: set, $setOnInsert: { ownerId: viewer.id, month, importedFrom: null } },
    { upsert: true, new: true, lean: true }
  )
  return toMonth(record as unknown as StoredMonth)
}

/**
 * The month as the page should start it: what is stored, or, for a month nothing has been recorded
 * in yet, an empty month whose fixed distribution starts from each participant's own amount.
 */
export async function getMonth(viewer: Viewer, month: string): Promise<{ month: BudgetMonth; isRecorded: boolean }> {
  await connectDatabase()
  const record = (await BudgetMonthModel.findOne({ ...mine(viewer), month }).lean()) as unknown as StoredMonth | null
  if (record) return { month: toMonth(record), isRecorded: true }
  const settings = await getSettings(viewer)
  return {
    month: { month, payments: [], expenses: [], fixed: defaultFixed(settings.participants), additional: null, confirmedAt: null, updatedAt: null },
    isRecorded: false,
  }
}

/** Clears a month: it goes back to having nothing recorded, and the balances after it follow. */
export async function deleteMonth(viewer: Viewer, month: string): Promise<boolean> {
  await connectDatabase()
  const { deletedCount } = await BudgetMonthModel.deleteOne({ ...mine(viewer), month })
  return deletedCount > 0
}
