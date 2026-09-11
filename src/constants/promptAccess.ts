export const PROMPT_ACCESS_ENDPOINT = "/api/prompt-access"
// Wrong passwords allowed before this browser is locked out of prompt editing
export const PROMPT_ACCESS_MAX_ATTEMPTS = 3
export const PROMPT_ACCESS_LOCK_HOURS = 24
// After a correct password, no tool asks again in this browser for this long
export const PROMPT_ACCESS_SESSION_HOURS = 48
export const PROMPT_PASSWORD_MAX_LENGTH = 200

export const PROMPT_ACCESS_MESSAGES = {
  required: "Enter the prompt password to view or change prompts.",
  sessionExpired:
    "Your prompt editing session has expired. Close this window and open Update Prompt again to enter the password.",
  locked: `Too many incorrect attempts. Prompt editing is locked in this browser for ${PROMPT_ACCESS_LOCK_HOURS} hours.`,
  disabled: "Prompt editing is turned off because no prompt password is configured (PROMPT_EDITOR_PASSWORD).",
  granted: `Prompt editing unlocked in this browser for ${PROMPT_ACCESS_SESSION_HOURS} hours.`,
  missingPassword: "Please enter the password.",
} as const
