import mongoose, { Schema, type Model } from "mongoose"
import { USER_ROLES, type UserRole } from "@/constants/auth"

/**
 * One account. The password is only ever stored as a scrypt hash (lib/passwords.ts). Raising
 * `sessionVersion` ends every sign-in the account has, since a session names the version it was made with.
 */
export interface IUser {
  email: string
  name: string
  passwordHash: string
  role: UserRole
  sessionVersion: number
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
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true, default: "user" },
    sessionVersion: { type: Number, required: true, default: 1 },
    failedLogins: { type: Number, required: true, default: 0 },
    loginCount: { type: Number, required: true, default: 0 },
    failedLoginCount: { type: Number, required: true, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "users" }
)

export const UserModel = (mongoose.models.User as Model<IUser> | undefined) ?? mongoose.model<IUser>("User", UserSchema)
