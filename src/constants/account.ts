import { NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./auth"

/**
 * Account Settings: the one page for what belongs to the **person** rather than to the workspace —
 * their name, their photo and their password. Every other page is about the work.
 *
 * It is not a tool, so it is not in `APP_TOOLS` and no switch can take it away: an account that
 * cannot change its own password would have nowhere to go. It is reached from the account menu in
 * the header, which is where the name, the email and the role are already shown.
 */

export const ACCOUNT_PATH = "/account"

export const ACCOUNT_ENDPOINTS = {
  // The name, and anything else about the person that is one small write
  profile: "/api/account",
  password: "/api/account/password",
  // POST the bytes to store one, DELETE to take it off; GET /<account>/<file> shows it
  photo: "/api/account/photo",
} as const

/**
 * A photo goes through the app in one request, like every other image here (the bucket's CORS rule
 * refuses a browser upload from the live site), so it stays under the 4.5 MB body a function takes.
 */
export const ACCOUNT_PHOTO_MAX_BYTES = 4 * 1024 * 1024
export const ACCOUNT_PHOTO_MAX_MB = Math.round(ACCOUNT_PHOTO_MAX_BYTES / (1024 * 1024))

// What the browser's file picker offers; the type is read from the bytes either way
export const ACCOUNT_PHOTO_ACCEPT = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"

/**
 * The page's three tabs, in order. The open one is kept in the address (`/account#tab=preferences`),
 * so a tab can be linked to and a reload stays on it.
 */
export const ACCOUNT_TABS = [
  { id: "profile", label: "Profile", hint: "Name, photo and account" },
  { id: "preferences", label: "Preferences", hint: "Appearance and time zone" },
  { id: "security", label: "Security", hint: "Password and sign-in" },
] as const
export type AccountTabId = (typeof ACCOUNT_TABS)[number]["id"]

export const ACCOUNT_MESSAGES = {
  // The page
  title: "Account Settings",
  subtitle: "Your profile, your time zone and how you sign in.",
  profileTitle: "Your profile",
  profileHint: "The name and photo shown in the header and in the account menu.",
  passwordTitle: "Change password",
  passwordHint: "Type the password you sign in with now, then the new one twice.",
  signedInTitle: "Signed in as",
  detailsTitle: "Account details",
  detailsHint: "Who this account is. The email and the role are set by an admin.",
  signInTitle: "Sign-in",
  signInHint: "How long this browser stays signed in.",
  staysSignedIn: "This browser stays signed in for a year, and the year starts again every time you use the app.",

  // The timezone every time in the app is shown in
  timeZoneTitle: "Time zone",
  timeZoneHint: "Every time in the app (when something was saved, a meeting, a task ticked off) is shown in this zone.",
  timeZoneBrowser: (zone: string) => `Use this browser's time zone (${zone})`,
  timeZoneSearch: "Search a city, country or zone",
  timeZoneNoMatch: "No time zone matches that search.",
  timeZoneSaved: "Your time zone is saved. Every time in the app now follows it.",
  timeZoneFailed: "Couldn't save your time zone. Please try again.",
  timeZoneUnknown: "That isn't a time zone this app knows.",
  timeZoneNow: (zone: string) => `Every time across the app is shown in ${zone}.`,
  nothingToSave: "There is nothing to save.",

  // Saving
  nameSaved: "Your name is saved.",
  nameFailed: "Couldn't save your name. Please try again.",
  passwordChanged: "Your password is changed. You are still signed in here; anywhere else signed in to this account has been signed out.",
  passwordFailed: "Couldn't change your password. Please try again.",
  wrongPassword: "That isn't the password you sign in with now.",
  samePassword: "That is the password you already have. Choose a different one.",
  gone: "This account no longer exists.",

  // The photo
  photoTitle: "Profile photo",
  photoHint: `PNG, JPG or WEBP, up to ${ACCOUNT_PHOTO_MAX_MB} MB.`,
  photoAdd: "Upload a photo",
  photoChange: "Change photo",
  photoRemove: "Remove photo",
  photoSaved: "Your photo is saved.",
  photoRemoved: "Your photo is removed.",
  photoUnsupported: "That file isn't a PNG, JPG or WEBP image.",
  photoTooLarge: `Keep the photo under ${ACCOUNT_PHOTO_MAX_MB} MB.`,
  photoStorageUnavailable: "File storage isn't set up here, so a photo can't be saved.",
  photoUploadFailed: "Couldn't save that photo. Please try again.",
  photoNotFound: "That photo isn't there any more.",

  // The form's own rules, so the page says the same thing the server would
  nameRequired: "Add your name.",
  nameTooLong: `Keep your name under ${NAME_MAX_LENGTH} characters.`,
  currentRequired: "Type the password you sign in with now.",
  newTooShort: `Use at least ${PASSWORD_MIN_LENGTH} characters for the new password.`,
  newTooLong: `Keep the new password under ${PASSWORD_MAX_LENGTH} characters.`,
  confirmRequired: "Type the new password again to confirm it.",
  confirmMismatch: "The two new passwords don't match.",
} as const
