import { z } from "zod"
import { AUTH_MESSAGES, EMAIL_MAX_LENGTH, NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/constants/auth"

const Email = z
  .string({ error: AUTH_MESSAGES.badEmail })
  .trim()
  .max(EMAIL_MAX_LENGTH, AUTH_MESSAGES.badEmail)
  .pipe(z.email({ error: AUTH_MESSAGES.badEmail }))

export const LoginSchema = z.object({
  email: Email,
  // Only the length is checked here: a wrong password is a failed sign-in, not a form error
  password: z.string({ error: AUTH_MESSAGES.badCredentials }).min(1, AUTH_MESSAGES.badCredentials).max(PASSWORD_MAX_LENGTH, AUTH_MESSAGES.badCredentials),
})

// The confirmation is checked here as well as in the form, so a request sent without the page
// can't create an account whose password was never typed the same way twice
export const SignupSchema = z
  .object({
    name: z.string({ error: AUTH_MESSAGES.missingName }).trim().min(1, AUTH_MESSAGES.missingName).max(NAME_MAX_LENGTH, AUTH_MESSAGES.nameTooLong),
    email: Email,
    password: z
      .string({ error: AUTH_MESSAGES.passwordTooShort })
      .min(PASSWORD_MIN_LENGTH, AUTH_MESSAGES.passwordTooShort)
      .max(PASSWORD_MAX_LENGTH, AUTH_MESSAGES.passwordTooLong),
    confirmPassword: z
      .string({ error: AUTH_MESSAGES.missingConfirmPassword })
      .min(1, AUTH_MESSAGES.missingConfirmPassword)
      .max(PASSWORD_MAX_LENGTH, AUTH_MESSAGES.passwordsDontMatch),
  })
  .refine((input) => input.password === input.confirmPassword, { message: AUTH_MESSAGES.passwordsDontMatch, path: ["confirmPassword"] })
