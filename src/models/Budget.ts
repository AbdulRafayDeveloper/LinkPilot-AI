import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * Budget Management's two collections, both the person's own (`ownerId` is their account):
 * `budget_settings`, one per account (the base currency, the opening balance, how what is left is
 * split, and the participants), and `budget_months`, one per account and month holding only what
 * the person typed and decided. Every total is worked out from these (lib/budget.ts) and never stored.
 *
 * The rows are Mixed, typed `unknown`, and validated with Zod on the way in and out
 * (lib/validation/budget.ts), the repo's rule for nested data.
 */
export interface IBudgetSettings {
  ownerId: string | null
  baseCurrency: string
  openingBalance: number
  reinvestPercent: number
  participants: unknown
  createdAt: Date
  updatedAt: Date
}

const BudgetSettingsSchema = new Schema<IBudgetSettings>(
  {
    ownerId: OWNER_ID,
    baseCurrency: { type: String, required: true, default: "PKR" },
    openingBalance: { type: Number, required: true, default: 0 },
    reinvestPercent: { type: Number, required: true, default: 50 },
    participants: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true, collection: "budget_settings" }
)
BudgetSettingsSchema.index({ ownerId: 1 }, { unique: true })

export interface IBudgetMonth {
  ownerId: string | null
  // YYYY-MM
  month: string
  payments: unknown
  expenses: unknown
  fixed: unknown
  additional: unknown
  confirmedAt: Date | null
  // Set on months a script brought in from a spreadsheet, so the script can take back only its own
  importedFrom: string | null
  createdAt: Date
  updatedAt: Date
}

const BudgetMonthSchema = new Schema<IBudgetMonth>(
  {
    ownerId: OWNER_ID,
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    payments: { type: Schema.Types.Mixed, default: [] },
    expenses: { type: Schema.Types.Mixed, default: [] },
    fixed: { type: Schema.Types.Mixed, default: {} },
    additional: { type: Schema.Types.Mixed, default: null },
    confirmedAt: { type: Date, default: null },
    importedFrom: { type: String, default: null },
  },
  { timestamps: true, collection: "budget_months", minimize: false }
)
// One record per account and month, read oldest first
BudgetMonthSchema.index({ ownerId: 1, month: 1 }, { unique: true })

export const BudgetSettingsModel =
  (mongoose.models.BudgetSettings as Model<IBudgetSettings> | undefined) ??
  mongoose.model<IBudgetSettings>("BudgetSettings", BudgetSettingsSchema)

export const BudgetMonthModel =
  (mongoose.models.BudgetMonth as Model<IBudgetMonth> | undefined) ?? mongoose.model<IBudgetMonth>("BudgetMonth", BudgetMonthSchema)
