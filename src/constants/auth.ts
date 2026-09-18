/**
 * Accounts, sign-in and roles. An account is a `user` or an `admin`: a user works with their own
 * records only, an admin sees every record and the admin-only features (Dummy Data).
 */

export const USER_ROLES = ["user", "admin"] as const
export type UserRole = (typeof USER_ROLES)[number]

export const LOGIN_PATH = "/login"
export const SIGNUP_PATH = "/signup"
export const AUTH_ENDPOINTS = {
  login: "/api/auth/login",
  signup: "/api/auth/signup",
  logout: "/api/auth/logout",
  me: "/api/auth/me",
} as const

// A sign-in lasts this long: sign in once and stay signed in for a year. Signing out, or a password
// reset, ends it sooner. A year is under the 400 days browsers allow a cookie to live, so it is kept
// whole rather than cut short by the browser
export const SESSION_DAYS = 365

export const NAME_MAX_LENGTH = 80
export const EMAIL_MAX_LENGTH = 254
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

// Wrong passwords in a row before an account stops accepting sign-ins for a while
export const MAX_FAILED_LOGINS = 5
export const LOGIN_LOCK_MINUTES = 15

// Sent with every "sign in first" answer, so the browser can tell it from any other 401
// The path the request came in on, put there by the proxy so a route guard can tell which tool it is
export const REQUEST_PATH_HEADER = "x-linkpilot-path"

export const AUTH_REQUIRED_HEADER = "x-linkpilot-auth"

export const AUTH_MESSAGES = {
  signInRequired: "Please sign in to continue.",
  adminOnly: "Only an admin can do that.",
  badCredentials: "That email and password don't match an account.",
  locked: `Too many wrong passwords. This account can sign in again in ${LOGIN_LOCK_MINUTES} minutes.`,
  missingName: "Add your name.",
  nameTooLong: `Keep your name under ${NAME_MAX_LENGTH} characters.`,
  badEmail: "Enter a valid email address.",
  passwordTooShort: `Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`,
  passwordTooLong: `Keep your password under ${PASSWORD_MAX_LENGTH} characters.`,
  missingConfirmPassword: "Type your password again to confirm it.",
  passwordsDontMatch: "The two passwords don't match.",
  passwordsMatch: "Passwords match.",
  emailTaken: "An account with this email already exists. Sign in instead.",
  signupClosed: "New accounts can't be created here. Ask an admin for one.",
  signInFailed: "Couldn't sign you in. Please try again.",
  signupFailed: "Couldn't create your account. Please try again.",
} as const

export const ROLE_LABELS: Record<UserRole, string> = { user: "User", admin: "Admin" }
