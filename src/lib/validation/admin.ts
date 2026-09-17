import { z } from "zod"
import { ADMIN_MESSAGES, LOGIN_EVENT_IDS } from "@/constants/admin"
import { EMAIL_MAX_LENGTH, USER_ROLES } from "@/constants/auth"
import { DATE_ORDER_ISSUE, blankToEmpty, choiceParam, cursorParam, dayBoundParam, inDateOrder, searchParam } from "./listFilters"

export const AuditQuerySchema = z
  .object({
    cursor: cursorParam,
    search: searchParam,
    event: choiceParam(LOGIN_EVENT_IDS),
    // One account's events, from User Management's "see all sign-ins"
    userId: z.preprocess(blankToEmpty, z.union([z.literal(""), z.string().regex(/^[0-9a-f]{24}$/)])),
    from: dayBoundParam,
    to: dayBoundParam,
  })
  .refine(inDateOrder, DATE_ORDER_ISSUE)

export const UsersQuerySchema = z.object({
  cursor: cursorParam,
  search: searchParam,
  role: choiceParam(USER_ROLES),
})

/**
 * Deleting an account: the admin types the account's email in the confirmation dialog, and the
 * route checks it again, so a stray request can't delete an account nobody named.
 */
export const DeleteAccountSchema = z.object({
  confirmEmail: z.string({ error: ADMIN_MESSAGES.confirmEmailMismatch }).trim().min(1, ADMIN_MESSAGES.confirmEmailMismatch).max(EMAIL_MAX_LENGTH, ADMIN_MESSAGES.confirmEmailMismatch),
})
