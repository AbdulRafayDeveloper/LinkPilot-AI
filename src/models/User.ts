import mongoose, { Schema, type Model } from "mongoose"
import { USER_ROLES, type UserRole } from "@/constants/auth"

/**
 * One account. The password is only ever stored as a scrypt hash (lib/passwords.ts). Raising
 * `sessionVersion` ends every sign-in the account has, since a session names the version it was made with.
 */
export interface IUser {
  // The account this one belongs to, when it is a child account (services/children.ts). A child reads
  // and writes its parent's records, so the parent's id is what scopes its data; null on a primary account
  parentId: string | null
  email: string
  name: string
  passwordHash: string
  role: UserRole
  sessionVersion: number
  // This account's own choices, on top of the settings for every user (models/FeatureSettings.ts):
  // the tools turned off for it alone, and the tools turned on for it although they are off for
  // everyone. Only a difference from everyone is stored, and both are empty by default
  disabledTools: string[]
  enabledTools: string[]
  // The client last chosen on Client Voices, so the page opens on it again on any browser; null for none
  clientVoicesClientId: string | null
  /**
   * What Daily Tasks is narrowed to, kept on the account so the list opens the same way on any
   * browser and after signing out and in. Each is "" when it is not being narrowed on, so a new
   * account, and every account from before this, reads as nothing narrowed.
   *
   * It is **the person's own**, like the Client Voices choice above and unlike the work itself: a
   * child account looking at one priority never narrows its parent's list.
   */
  dailyTaskFilters: { priority: string; doer: string; blocked: string; done: string }
  // Wrong passwords in a row, for the lockout; reset by a good sign-in
  failedLogins: number
  lockedUntil: Date | null
  // Every successful sign-in (sign-up counts as the first) and every wrong password, ever
  loginCount: number
  failedLoginCount: number
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    // Stored lowercased, so the same address typed with capitals is the same account
    parentId: { type: String, default: null, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true, default: "user" },
    sessionVersion: { type: Number, required: true, default: 1 },
    disabledTools: { type: [String], default: [] },
    enabledTools: { type: [String], default: [] },
    clientVoicesClientId: { type: String, default: null },
    // Four plain strings, so the document always holds the shape the page reads
    dailyTaskFilters: {
      priority: { type: String, default: "" },
      doer: { type: String, default: "" },
      blocked: { type: String, default: "" },
      done: { type: String, default: "" },
    },
    failedLogins: { type: Number, required: true, default: 0 },
    loginCount: { type: Number, required: true, default: 0 },
    failedLoginCount: { type: Number, required: true, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "users" }
)

export const UserModel = (mongoose.models.User as Model<IUser> | undefined) ?? mongoose.model<IUser>("User", UserSchema)
