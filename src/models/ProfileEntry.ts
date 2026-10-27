import mongoose, { Schema, type Model } from "mongoose"

/**
 * One entry of one person's My AI Profile: a role, a project, a skill, a service, a school, a
 * certificate or a review (constants/profileSections.ts says which fields each holds).
 *
 * **It belongs to the person**: `ownerId` is the account's own id (`viewer.id`), the way Profile Info
 * and the account photo are, and every read, edit and delete is filtered on it.
 *
 * `fields` is kept as one flat object (Mixed), checked against the section's schema on the way in.
 * `searchHash` is the fingerprint of the text its vectors were written from; while it differs from the
 * entry's text now (or the vectors failed), the entry is waiting to be saved for search again.
 */
export interface IProfileEntry {
  ownerId: string
  section: string
  fields: unknown
  // The entry's place in its section, smallest first; a new entry goes on top
  position: number
  // Saved for search: "ready" once its vectors are written, "pending" until then, "failed" with why
  searchStatus: "pending" | "ready" | "failed"
  searchError: string | null
  searchHash: string | null
  searchedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const ProfileEntrySchema = new Schema<IProfileEntry>(
  {
    ownerId: { type: String, required: true },
    section: { type: String, required: true },
    fields: { type: Schema.Types.Mixed, default: {} },
    position: { type: Number, default: 0 },
    searchStatus: { type: String, enum: ["pending", "ready", "failed"], default: "pending" },
    searchError: { type: String, default: null },
    searchHash: { type: String, default: null },
    searchedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "profile_entries", minimize: false }
)
// A section is always read one person at a time, in its order
ProfileEntrySchema.index({ ownerId: 1, section: 1, position: 1, createdAt: -1 })
// What is still waiting to be saved for search
ProfileEntrySchema.index({ ownerId: 1, searchStatus: 1 })

export const ProfileEntryModel =
  (mongoose.models.ProfileEntry as Model<IProfileEntry> | undefined) ?? mongoose.model<IProfileEntry>("ProfileEntry", ProfileEntrySchema)
