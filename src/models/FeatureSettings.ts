import mongoose, { Schema, type Model } from "mongoose"

/**
 * Which tools are turned off for every user at once, set by an admin from User Management. There is
 * one document, found by its fixed `scope`, and it belongs to no account: it is the admins' setting,
 * and records who changed it last. With no document, every tool is on for everyone.
 *
 * Only the tools that are off are stored, so a tool added to the app later is on for everyone
 * without anyone touching this. One account's own choices (`disabledTools` and `enabledTools` on
 * the user) are kept on the account and win over this for that account alone.
 */
export interface IFeatureSettings {
  scope: string
  disabledTools: string[]
  updatedBy: string
  createdAt: Date
  updatedAt: Date
}

// The one scope there is today: every user
export const FEATURE_SETTINGS_SCOPE = "all-users"

const FeatureSettingsSchema = new Schema<IFeatureSettings>(
  {
    scope: { type: String, required: true, unique: true },
    disabledTools: { type: [String], default: [] },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true, collection: "feature_settings" }
)

export const FeatureSettingsModel =
  (mongoose.models.FeatureSettings as Model<IFeatureSettings> | undefined) ??
  mongoose.model<IFeatureSettings>("FeatureSettings", FeatureSettingsSchema)
