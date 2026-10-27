import { accountPhotoPath } from "@/lib/accountPhoto"
import type { IUser } from "@/models/User"
import { effectiveDisabledTools } from "@/lib/featureAccess"
import { DEFAULT_COLOR_SCHEME, isColorScheme } from "@/constants/colorScheme"
import type { Viewer } from "@/types/auth"

/**
 * One account turned into the `Viewer` everything below reads, used both at sign-in and on every
 * request, so the two can never disagree about what an account may see or do.
 */

export const ACCOUNT_FIELDS = {
  email: 1,
  name: 1,
  photoFile: 1,
  timeZone: 1,
  colorScheme: 1,
  role: 1,
  sessionVersion: 1,
  disabledTools: 1,
  enabledTools: 1,
} as const

export type Account = Pick<IUser, "email" | "name" | "role"> &
  Partial<Pick<IUser, "disabledTools" | "enabledTools" | "photoFile" | "timeZone" | "colorScheme">> & { _id: unknown }

export async function viewerOf(user: Account, defaults: readonly string[]): Promise<Viewer> {
  const id = String(user._id)
  return {
    id,
    email: user.email,
    name: user.name,
    photo: user.photoFile ? accountPhotoPath({ ownerId: id, file: user.photoFile }) : null,
    timeZone: user.timeZone ?? null,
    // An account from before schemes, or a value the app no longer has, is System
    colorScheme: isColorScheme(user.colorScheme) ? user.colorScheme : DEFAULT_COLOR_SCHEME,
    role: user.role,
    // What is off for everyone, with this account's own choices on top; an admin keeps every tool
    disabledTools: effectiveDisabledTools(user.role, defaults, user),
  }
}
