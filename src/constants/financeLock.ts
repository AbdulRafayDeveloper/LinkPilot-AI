import { APP_TOOLS } from "@/constants/linkedinTools"

/**
 * The Finance lock: the whole Finance area (every tool under it on the sidebar) opens only after the
 * person enters a password of its own, set the first time they come and asked for again on every
 * visit. It is a second door in front of the person's money, separate from the password they sign
 * in with, so a laptop left signed in does not show the budget to whoever sits down at it.
 *
 * An unlock belongs to **one browser and one sign-in**: a random token in a cookie, recorded on the
 * server (`finance_unlocks`) against that sign-in, so a new device, a new browser, or anyone signing
 * in again on the same browser has to enter the password before Finance opens. It ends when the
 * browser closes, after `FINANCE_IDLE_MINUTES` unused, after `FINANCE_MAX_HOURS` however much it is
 * used, on Lock, on signing out, and everywhere at once when the password changes or "Lock on every
 * device" is pressed. The server checks the record on every Finance request, so a copied cookie
 * stops working the moment its unlock is ended.
 */

export const FINANCE_LOCK_ENDPOINT = "/api/finance-lock"
export const FINANCE_LOCK_COOKIE = "lp_finance"
// What a refused Finance request carries, so the page shows the lock screen rather than an error
export const FINANCE_LOCKED_HEADER = "x-linkpilot-finance"
export const FINANCE_LOCKED_EVENT = "linkpilot:finance-locked"

export const FINANCE_IDLE_MINUTES = 30
// However much it is used, an unlock ends this long after the password was entered
export const FINANCE_MAX_HOURS = 8
export const FINANCE_PASSWORD_MIN_LENGTH = 8
export const FINANCE_PASSWORD_MAX_LENGTH = 128
export const FINANCE_MAX_FAILED = 5
/**
 * The first lockout lasts this long and every lockout after it, without a right password in between,
 * twice as long (15 minutes, 30, an hour...) up to `FINANCE_LOCK_MAX_MINUTES`, so guessing gets
 * slower and slower instead of five tries every quarter of an hour for ever.
 */
export const FINANCE_LOCK_MINUTES = 15
export const FINANCE_LOCK_MAX_MINUTES = 24 * 60
// How often an unlock's "last used" is written: often enough for the idle window, not on every request
export const FINANCE_TOUCH_SECONDS = 60

/** How long the next lockout lasts, after `lockouts` before it in a row. */
export const lockoutMinutes = (lockouts: number) => Math.min(FINANCE_LOCK_MAX_MINUTES, FINANCE_LOCK_MINUTES * 2 ** Math.max(0, lockouts))

/** Every tool under Finance on the sidebar, read from the one navigation list, so a new one is locked too. */
export const FINANCE_TOOL_IDS: readonly string[] = APP_TOOLS.filter((tool) => tool.group === "finance").map((tool) => tool.id)

export const FINANCE_LOCK_ACTIONS = ["set", "unlock", "change", "reset", "lock", "lock-all"] as const
export type FinanceLockAction = (typeof FINANCE_LOCK_ACTIONS)[number]

export const FINANCE_LOCK_MESSAGES = {
  setTitle: "Set your Finance password",
  setIntro: "Finance holds your own money, so it has a password of its own. Choose one now; you will enter it each time you open Finance.",
  unlockTitle: "Finance is locked",
  unlockIntro: "Enter your Finance password to open it.",
  locked: "Finance is locked. Enter your Finance password to open it.",
  wrong: "That Finance password is not right.",
  tooMany: (minutes: number) => {
    const hours = Math.round(minutes / 60)
    return `Too many wrong Finance passwords. Try again in ${minutes >= 60 ? `${hours} ${hours === 1 ? "hour" : "hours"}` : `${Math.max(1, minutes)} minutes`}.`
  },
  tooShort: `Use at least ${FINANCE_PASSWORD_MIN_LENGTH} characters.`,
  tooLong: `Keep it under ${FINANCE_PASSWORD_MAX_LENGTH} characters.`,
  mismatch: "The two passwords are not the same.",
  alreadySet: "A Finance password is already set. Enter it to open Finance.",
  notSet: "No Finance password is set yet.",
  sameAsBefore: "Choose a password different from the one you have now.",
  accountPasswordWrong: "That is not the password you sign in with.",
  set: "Finance password set. Finance is open.",
  unlocked: "Finance is open.",
  changed: "Finance password changed.",
  reset: "Finance password reset. Finance is open.",
  lockedNow: "Finance is locked.",
  lockedEverywhere: "Finance is locked on every device. Each one needs the password again.",
  failed: "Couldn't do that. Please try again.",
  forgotHint: "Forgot it? Reset it with the password you sign in with.",
  stays: `It opens on this device only, and closes when you close the browser, lock it, sign out, leave it unused for ${FINANCE_IDLE_MINUTES} minutes, or after ${FINANCE_MAX_HOURS} hours.`,
} as const
