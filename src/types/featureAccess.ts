import type { UserRole } from "@/constants/auth"

/** The tools turned off for every user, as the admin's page reads them. */
export interface FeatureDefaults {
  disabledTools: string[]
  // How many accounts have choices of their own, which win over these
  customisedUsers: number
}

/**
 * What one account may use, as its page in User Management reads it: what everyone gets, this
 * account's own choices on top, and the result. An admin's `effective` list is always empty.
 */
export interface FeatureAccess {
  userId: string
  email: string
  name: string
  role: UserRole
  // Off for every user
  defaults: string[]
  // This account's own choices: off for it alone, and on for it although off for everyone
  disabledTools: string[]
  enabledTools: string[]
  // What it may not use, all told
  effective: string[]
}
