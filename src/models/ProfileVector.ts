import mongoose, { Schema, type Model } from "mongoose"

/**
 * One piece of one person's My AI Profile with the vector Gemini wrote for its meaning: this is the
 * profile's vector database, searched with `$vectorSearch` on `embedding` (index `profile_vectors_index`),
 * **always filtered to the one person** (`ownerId`, the account's own id), so one person's profile can
 * never turn up in another's search.
 *
 * A piece comes from one entry (`sourceId` is the entry's id) or from the Profile Info text
 * (`sourceId` is "profile-info"); a long one is cut into pieces (`piece`). `contentHash` is the
 * fingerprint of the text, the model and the length it was written with, so a change to any of them is
 * noticed and the piece written again.
 */
export interface IProfileVector {
  ownerId: string
  sourceId: string
  // The section the piece came from, or "profile-info"
  section: string
  piece: number
  text: string
  embedding: number[]
  model: string
  dimensions: number
  contentHash: string
  createdAt: Date
  updatedAt: Date
}

const ProfileVectorSchema = new Schema<IProfileVector>(
  {
    ownerId: { type: String, required: true },
    sourceId: { type: String, required: true },
    section: { type: String, required: true },
    piece: { type: Number, default: 0 },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    model: { type: String, required: true },
    dimensions: { type: Number, required: true },
    contentHash: { type: String, required: true },
  },
  { timestamps: true, collection: "profile_vectors" }
)
// Everything is replaced and deleted one source at a time, and an account's go with it
ProfileVectorSchema.index({ ownerId: 1, sourceId: 1, contentHash: 1 })

export const ProfileVectorModel =
  (mongoose.models.ProfileVector as Model<IProfileVector> | undefined) ?? mongoose.model<IProfileVector>("ProfileVector", ProfileVectorSchema)
