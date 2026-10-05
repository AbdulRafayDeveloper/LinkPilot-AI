import { z } from "zod"
import { AUTH_MESSAGES, EMAIL_MAX_LENGTH, NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/constants/auth"
import { CHILDREN_MESSAGES } from "@/constants/children"
import { MAX_FEATURE_IDS } from "@/constants/featureAccess"

/**
 * What a parent may send about a child account. The email and password rules are the same ones
 * sign-up uses, so a child's credentials are held to exactly the standard every account is.
 */

const Email = z
  .string({ error: AUTH_MESSAGES.badEmail })
  .trim()
  .max(EMAIL_MAX_LENGTH, AUTH_MESSAGES.badEmail)
  .pipe(z.email({ error: AUTH_MESSAGES.badEmail }))

const Password = z
  .string({ error: AUTH_MESSAGES.passwordTooShort })
  .min(PASSWORD_MIN_LENGTH, AUTH_MESSAGES.passwordTooShort)
  .max(PASSWORD_MAX_LENGTH, AUTH_MESSAGES.passwordTooLong)

export const ChildSchema = z.object({
  name: z.string({ error: AUTH_MESSAGES.missingName }).trim().min(1, AUTH_MESSAGES.missingName).max(NAME_MAX_LENGTH, CHILDREN_MESSAGES.nameTooLong),
  email: Email,
  password: Password,
})

export const ChildPasswordSchema = z.object({ password: Password })

/**
 * A change to what one child may open names only the tools it touches, never a whole list, so two
 * changes made at the same moment never undo each other. The same shape the admin panels use.
 */
export const ChildToolsSchema = z.object({
  tools: z.array(z.string().min(1).max(60)).min(1).max(MAX_FEATURE_IDS),
  on: z.boolean(),
})
