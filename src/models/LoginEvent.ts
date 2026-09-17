import mongoose, { Schema, type Model } from "mongoose"
import { LOGIN_EVENT_IDS, type LoginEventType } from "@/constants/admin"

/**
 * One sign-in, sign-up, sign-out or refused attempt, as Audit Management lists it. Never holds a
 * password or a session: only who (the account, or just the email typed when no account matched),
 * what happened, when, and the device it came from. Kept forever, like the other histories.
 */
export interface ILoginEvent {
  // Null when the email typed matches no account
  userId: string | null
  email: string
  name: string | null
  event: LoginEventType
  browser: string
  os: string
  device: string
  userAgent: string
  ipAddress: string | null
  // For an event an admin caused (an account deleted), the admin's email; null for the account's own events
  performedBy: string | null
  createdAt: Date
  updatedAt: Date
}

const LoginEventSchema = new Schema<ILoginEvent>(
  {
    userId: { type: String, default: null },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, default: null },
    event: { type: String, enum: LOGIN_EVENT_IDS, required: true },
    browser: { type: String, required: true },
    os: { type: String, required: true },
    device: { type: String, required: true },
    userAgent: { type: String, default: "" },
    ipAddress: { type: String, default: null },
    performedBy: { type: String, default: null },
  },
  { timestamps: true, collection: "login_events" }
)
// Newest first for the log, one account's events for its detail view, one kind of event for the filter
LoginEventSchema.index({ createdAt: -1, _id: -1 })
LoginEventSchema.index({ userId: 1, createdAt: -1 })
LoginEventSchema.index({ event: 1, createdAt: -1 })

export const LoginEventModel =
  (mongoose.models.LoginEvent as Model<ILoginEvent> | undefined) ?? mongoose.model<ILoginEvent>("LoginEvent", LoginEventSchema)
