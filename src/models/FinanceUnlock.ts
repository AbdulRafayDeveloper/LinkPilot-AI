import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * One device's open Finance (constants/financeLock.ts): made when the Finance password is entered,
 * and checked on every Finance request. The browser holds only a random token; this keeps its
 * SHA-256, never the token itself, so a copy of the database cannot open anyone's Finance.
 *
 * It is tied to the one sign-in it was made in (`sessionId`, the session cookie's `sid`) and to the
 * account's session and Finance password versions, so signing in again, signing out everywhere or
 * changing either password ends it. `revokedAt` ends it at once (Lock, Lock on every device, sign out).
 */
export interface IFinanceUnlock {
  ownerId: string | null
  tokenHash: string
  sessionId: string
  sessionVersion: number
  passwordVersion: number
  // When it stops working unused (moved on as it is used), and when it stops working whatever happens
  idleUntil: Date
  expiresAt: Date
  lastUsedAt: Date
  revokedAt: Date | null
  // Which browser and system it was opened on, read from the User-Agent, for the record only
  device: string
  createdAt: Date
  updatedAt: Date
}

const FinanceUnlockSchema = new Schema<IFinanceUnlock>(
  {
    ownerId: OWNER_ID,
    tokenHash: { type: String, required: true },
    sessionId: { type: String, required: true },
    sessionVersion: { type: Number, required: true },
    passwordVersion: { type: Number, required: true },
    idleUntil: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    device: { type: String, default: "" },
  },
  { timestamps: true, collection: "finance_unlocks" }
)
FinanceUnlockSchema.index({ tokenHash: 1 }, { unique: true })
// Ending every device at once
FinanceUnlockSchema.index({ ownerId: 1, revokedAt: 1 })
// An unlock past its last moment is no use to anyone, so the database clears it
FinanceUnlockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const FinanceUnlockModel =
  (mongoose.models.FinanceUnlock as Model<IFinanceUnlock> | undefined) ??
  mongoose.model<IFinanceUnlock>("FinanceUnlock", FinanceUnlockSchema)
