/**
 * Accounts, sign-in and roles. An account is a `user` or an `admin`: a user works with their own
 * records only, an admin sees every record and the admin-only features (Dummy Data).
 */

export const USER_ROLES = ["user", "admin"] as const
export type UserRole = (typeof USER_ROLES)[number]

export const LOGIN_PATH = "/login"
// Where the app opens: the root, a sign-in with nowhere else to go back to, the logo and the installed
// app all land here. Connection Note, at the owner's request (it used to be the first tool, Trending
// Topics). A plain path rather than a lookup in the tool list, so the sign-in gate can read it without
// loading every tool; tests/homePath.test.mjs checks that it names a tool that exists
export const HOME_PATH = "/connection-note"
// Somewhere every signed-in account can always open, for an account with every tool turned off
export const ALWAYS_OPEN_PATH = "/global-prompts"
export const SIGNUP_PATH = "/signup"
// Where the person changes their own name, photo and password (constants/account.ts)
export const ACCOUNT_SETTINGS_PATH = "/account"
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

/**
 * **The year starts again every time the app is used.** A session that only counted down from the
 * sign-in would end a year later in the middle of someone's work, however much they had used it, and
 * a browser carrying a cookie issued when a session was shorter would still end on that older date.
 * So the cookie is signed again whenever it is more than a day old (`refreshSession`, called by
 * `/api/auth/me`, which every page load asks), and anyone who opens the app at all keeps a full year
 * ahead of them. A day is the rhythm because one write per browser per day costs nothing.
 */
export const SESSION_REFRESH_DAYS = 1

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
// The method beside it, so the activity log can tell an action from a read without each route saying so
export const REQUEST_METHOD_HEADER = "x-linkpilot-method"

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
