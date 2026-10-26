import type { UserRole } from "@/constants/auth"

/** The signed-in account, as the server and the page both see it. Never carries the password hash. */
export interface Viewer {
  id: string
  email: string
  name: string
  // Where to show this person's profile photo (`/api/account/photo/<account>/<file>`), or null when
  // they have none. It is the person's own, so a child account has its own rather than its parent's
  photo: string | null
  /**
   * The timezone this person chose in Account Settings (an IANA name such as "Asia/Karachi"), which
   * every time in the app is shown in; null until they choose one, when their browser's own is used.
   * It is the person's own, so a child account keeps its own rather than its parent's
   */
  timeZone: string | null
  role: UserRole
  // The tools this account may not use. Always empty for an admin, who keeps every tool
  disabledTools: string[]
  // The account this one belongs to, for a child account; null on a primary account
  parentId: string | null
  /**
   * Whose records this account works with: its parent's for a child, its own otherwise. **Every read
   * and every write is scoped by this, never by `id`**, so a child sees exactly what its parent sees
   * in every module and what it makes shows up for the parent too. `id` stays the account itself, for
   * signing in, the audit trail and anything personal to the person rather than to the work.
   */
  dataOwnerId: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface SignupInput extends LoginInput {
  name: string
}
