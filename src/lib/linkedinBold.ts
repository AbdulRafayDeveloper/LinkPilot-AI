/**
 * LinkedIn shows posts, comments and messages as plain text, so real formatting doesn't survive
 * a paste. "Bold" on LinkedIn is done with Unicode Mathematical Sans-Serif Bold letters (𝗕𝗼𝗹𝗱),
 * which are ordinary characters and look bold everywhere. Only A-Z, a-z and 0-9 have bold forms;
 * everything else stays as it is. Links, #hashtags and @mentions are never converted, since bold
 * letters would stop them working on LinkedIn.
 */
const BOLD_UPPER_A = 0x1d5d4
const BOLD_LOWER_A = 0x1d5ee
const BOLD_DIGIT_0 = 0x1d7ec
const PROTECTED = /(https?:\/\/\S+|www\.\S+|[#@][\p{L}\p{N}_.-]+)/u

function toBoldChar(char: string): string {
  const code = char.codePointAt(0) ?? 0
  if (code >= 65 && code <= 90) return String.fromCodePoint(BOLD_UPPER_A + code - 65)
  if (code >= 97 && code <= 122) return String.fromCodePoint(BOLD_LOWER_A + code - 97)
  if (code >= 48 && code <= 57) return String.fromCodePoint(BOLD_DIGIT_0 + code - 48)
  return char
}

function toPlainChar(char: string): string {
  const code = char.codePointAt(0) ?? 0
  if (code >= BOLD_UPPER_A && code < BOLD_UPPER_A + 26) return String.fromCharCode(65 + code - BOLD_UPPER_A)
  if (code >= BOLD_LOWER_A && code < BOLD_LOWER_A + 26) return String.fromCharCode(97 + code - BOLD_LOWER_A)
  if (code >= BOLD_DIGIT_0 && code < BOLD_DIGIT_0 + 10) return String.fromCharCode(48 + code - BOLD_DIGIT_0)
  return char
}

const isBoldChar = (char: string) => toPlainChar(char) !== char
const isPlainLetter = (char: string) => /^[A-Za-z0-9]$/.test(char)

// Converts every plain part of the text, leaving links, hashtags and mentions untouched
const mapUnprotected = (text: string, convert: (char: string) => string) =>
  text
    .split(PROTECTED)
    .map((part, index) => (index % 2 === 1 ? part : [...part].map(convert).join("")))
    .join("")

export const toLinkedInBold = (text: string) => mapUnprotected(text, (char) => toBoldChar(toPlainChar(char)))
export const fromLinkedInBold = (text: string) => [...text].map(toPlainChar).join("")
export const containsLinkedInBold = (text: string) => [...text].some(isBoldChar)

/**
 * Bold on, or off when the selection is already all bold, like a Bold button in any editor.
 */
export function toggleLinkedInBold(text: string): string {
  const letters = [...text.split(PROTECTED).filter((_, index) => index % 2 === 0).join("")].filter(
    (char) => isPlainLetter(char) || isBoldChar(char)
  )
  const isAllBold = letters.length > 0 && letters.every(isBoldChar)
  return isAllBold ? fromLinkedInBold(text) : toLinkedInBold(text)
}
