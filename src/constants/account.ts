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

export const ACCOUNT_MESSAGES = {
  // The page
  title: "Account Settings",
  subtitle: "Your name, your photo and your password.",
  profileTitle: "Your profile",
  profileHint: "The name and photo shown in the header and in the account menu.",
  passwordTitle: "Change password",
  passwordHint: "Type the password you sign in with now, then the new one twice.",
  signedInTitle: "Signed in as",
  // Whose records this account works with, for a child account
  childWorkspace: "You work in the workspace of the account that made yours, so what you save is saved there too.",
  staysSignedIn: "This browser stays signed in for a year, and the year starts again every time you use the app.",

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
