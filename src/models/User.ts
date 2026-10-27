import mongoose, { Schema, type Model } from "mongoose"
import { USER_ROLES, type UserRole } from "@/constants/auth"
import { COLOR_SCHEME_IDS, DEFAULT_COLOR_SCHEME, type ColorScheme } from "@/constants/colorScheme"

/**
 * One account. The password is only ever stored as a scrypt hash (lib/passwords.ts). Raising
 * `sessionVersion` ends every sign-in the account has, since a session names the version it was made with.
 */
export interface IUser {
  email: string
  name: string
  // The person's own profile photo, the file's name under their folder in storage (lib/accountPhoto.ts);
  // null when they have none, which is every account until it sets one, and then it shows its initials
  photoFile: string | null
  // The timezone this person sees every time in (an IANA name, "Asia/Karachi"); null follows their browser
  timeZone: string | null
  // This person's own Profile Info (My AI Profile): their background, projects and numbers, the facts
  // every tool that writes as them quotes from. Empty until they write it; never another account's
  profileInfo: string
  profileInfoUpdatedAt: Date | null
  // Why Profile Info could not be saved for search the last time it was tried (services/myProfile/vectors.ts); null once it is
  profileInfoSearchError: string | null
  // How the app looks for this person: "system" (follows the device, the default), "light" or "dark"
  colorScheme: ColorScheme
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
  // Client Voices: run a batch without writing anything down
  clientVoicesTemporary: boolean
  /**
   * What each page is filtered on, one entry per page (`constants/savedFilters.ts`), so every list
   * opens the way its user left it: after a reload, after signing out and in, and on any machine.
   *
   * It is **the person's own**, like the Client Voices choice above. It is `unknown` here and read
   * through `cleanFilters`, which is the rule for anything nested in this repo: a page is only ever
   * handed the keys it really has.
   */
  viewFilters: unknown
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
    photoFile: { type: String, default: null },
    timeZone: { type: String, default: null },
    profileInfo: { type: String, default: "" },
    profileInfoUpdatedAt: { type: Date, default: null },
    profileInfoSearchError: { type: String, default: null },
    colorScheme: { type: String, enum: COLOR_SCHEME_IDS, default: DEFAULT_COLOR_SCHEME },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true, default: "user" },
    sessionVersion: { type: Number, required: true, default: 1 },
    disabledTools: { type: [String], default: [] },
    enabledTools: { type: [String], default: [] },
    clientVoicesClientId: { type: String, default: null },
    // Whether Client Voices runs a batch without keeping it; a choice, so it stays until it is changed
    clientVoicesTemporary: { type: Boolean, default: false },
    // One entry per page; what may be in each is decided by lib/savedFilters.ts, not by the schema
    viewFilters: { type: Schema.Types.Mixed, default: {} },
    failedLogins: { type: Number, required: true, default: 0 },
    loginCount: { type: Number, required: true, default: 0 },
    failedLoginCount: { type: Number, required: true, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "users" }
)

export const UserModel = (mongoose.models.User as Model<IUser> | undefined) ?? mongoose.model<IUser>("User", UserSchema)
