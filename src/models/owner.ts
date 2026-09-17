/**
 * The account a record belongs to, as the user's id. Records saved before accounts existed have
 * none, and only an admin sees those.
 */
export const OWNER_ID = { type: String, default: null, index: true }

export interface Owned {
  ownerId: string | null
}
