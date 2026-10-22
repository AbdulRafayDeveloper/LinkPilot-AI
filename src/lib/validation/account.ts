import { z } from "zod"
import { NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/constants/auth"
import { ACCOUNT_MESSAGES } from "@/constants/account"

/**
 * What Account Settings accepts. The confirmation is checked here as well as in the form, so a
 * request sent without the page can't set a password that was never typed the same way twice.
 */

export const AccountProfileSchema = z.object({
  name: z
    .string({ error: ACCOUNT_MESSAGES.nameRequired })
    .trim()
    .min(1, ACCOUNT_MESSAGES.nameRequired)
    .max(NAME_MAX_LENGTH, ACCOUNT_MESSAGES.nameTooLong),
})

export const ChangePasswordSchema = z
  .object({
    // Only the length is checked: a wrong password here is a refused change, not a form error
    currentPassword: z
      .string({ error: ACCOUNT_MESSAGES.currentRequired })
      .min(1, ACCOUNT_MESSAGES.currentRequired)
      .max(PASSWORD_MAX_LENGTH, ACCOUNT_MESSAGES.wrongPassword),
    newPassword: z
      .string({ error: ACCOUNT_MESSAGES.newTooShort })
      .min(PASSWORD_MIN_LENGTH, ACCOUNT_MESSAGES.newTooShort)
      .max(PASSWORD_MAX_LENGTH, ACCOUNT_MESSAGES.newTooLong),
    confirmPassword: z
      .string({ error: ACCOUNT_MESSAGES.confirmRequired })
      .min(1, ACCOUNT_MESSAGES.confirmRequired)
      .max(PASSWORD_MAX_LENGTH, ACCOUNT_MESSAGES.confirmMismatch),
  })
  .refine((input) => input.newPassword === input.confirmPassword, { message: ACCOUNT_MESSAGES.confirmMismatch, path: ["confirmPassword"] })
  .refine((input) => input.newPassword !== input.currentPassword, { message: ACCOUNT_MESSAGES.samePassword, path: ["newPassword"] })

export type AccountProfileInput = z.infer<typeof AccountProfileSchema>
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>
