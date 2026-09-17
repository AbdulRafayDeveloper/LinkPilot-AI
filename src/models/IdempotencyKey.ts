import mongoose, { Schema, type Model } from "mongoose"

/**
 * One request that was sent with an idempotency key (services/idempotency.ts): which account sent
 * it to which route, whether it is still running, and the answer it got, so a retry of the same
 * request is answered from here instead of running again. Kept for a day, then removed by MongoDB.
 */
export interface IIdempotencyKey {
  // The account that sent it; a key never answers anyone else
  ownerId: string
  route: string
  key: string
  state: "pending" | "done"
  // The stored answer, set once the request succeeded; null body when it was too large to keep
  status: number | null
  body: string | null
  createdAt: Date
  updatedAt: Date
}

// A retry comes seconds after the first attempt; a day is far longer than any of them needs
export const IDEMPOTENCY_KEY_TTL_SECONDS = 24 * 60 * 60

const IdempotencyKeySchema = new Schema<IIdempotencyKey>(
  {
    ownerId: { type: String, required: true },
    route: { type: String, required: true },
    key: { type: String, required: true },
    state: { type: String, enum: ["pending", "done"], required: true },
    status: { type: Number, default: null },
    body: { type: String, default: null },
  },
  { timestamps: true, collection: "idempotency_keys" }
)
// One record per key per account per route, which is what makes two attempts unable to both run
IdempotencyKeySchema.index({ ownerId: 1, route: 1, key: 1 }, { unique: true })
IdempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: IDEMPOTENCY_KEY_TTL_SECONDS })

export const IdempotencyKey =
  (mongoose.models.IdempotencyKey as Model<IIdempotencyKey> | undefined) ??
  mongoose.model<IIdempotencyKey>("IdempotencyKey", IdempotencyKeySchema)
