import type { UserRole } from "@/constants/auth"
import type { ColorScheme } from "@/constants/colorScheme"

/** The signed-in account, as the server and the page both see it. Never carries the password hash. */
export interface Viewer {
  // The account itself. Every record it makes is stamped with this as its `ownerId`
  id: string
  email: string
  name: string
  // Where to show this person's profile photo (`/api/account/photo/<account>/<file>`), or null when they have none
  photo: string | null
  /**
   * The timezone this person chose in Account Settings (an IANA name such as "Asia/Karachi"), which
   * every time in the app is shown in; null until they choose one, when their browser's own is used.
   */
  timeZone: string | null
  // How the app looks for this person (Account Settings → Preferences); "system" follows the device
  colorScheme: ColorScheme
  role: UserRole
  // The tools this account may not use. Always empty for an admin, who keeps every tool
  disabledTools: string[]
}

export interface LoginInput {
  email: string
  password: string
}

export interface SignupInput extends LoginInput {
  name: string
}
