/**
 * The last guard on every generated text: marks and words that make copy read as AI-written
 * (em and en dashes used as pauses, colons, semicolons, "seamless", "robust"...) are rewritten
 * the way a person would type them. Every prompt already forbids them; this catches what
 * slips through. Links, hashtags, @mentions, times (10:30), ratios (3:1), hyphenated words and
 * number ranges are left as they are.
 */

// Only words with a plain swap that keeps the sentence grammatical; the prompts forbid the rest
const WORD_SWAPS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bseamlessly\b/gi, "smoothly"],
  [/\bseamless\b/gi, "smooth"],
  [/\brobust\b/gi, "solid"],
  [/\butilizing\b/gi, "using"],
  [/\butilized\b/gi, "used"],
  [/\butilizes\b/gi, "uses"],
  [/\butilize\b/gi, "use"],
  [/\bdelving\b/gi, "digging"],
  [/\bdelved\b/gi, "dug"],
  [/\bdelves\b/gi, "digs"],
  [/\bdelve\b/gi, "dig"],
]

// AI-sounding words with no safe automatic swap: a rewrite that brings one in is sent back
const AI_WORDS =
  /\b(?:leverag(?:e|es|ed|ing)|elevat(?:e|es|ed|ing)|unlock(?:s|ed|ing)?|empower(?:s|ed|ing)?|streamlin(?:e|es|ed|ing)|game[- ]changer|cutting[- ]edge|revolutioniz(?:e|es|ed|ing)|synergy|tapestry|realm|fast[- ]paced)\b/gi

export function findAiWords(text: string): string[] {
  return [...new Set((text.match(AI_WORDS) ?? []).map((word) => word.toLowerCase()))]
}

// Never rewritten: links, hashtags and @mentions
const PROTECTED = /(https?:\/\/\S+|www\.\S+|[#@][\p{L}\p{N}_.-]+)/u
// A range or a joined word: a dash between two numbers ("2–3 weeks") or an en dash between two letters ("pre–seed")
const JOINING_DASH = /(?<=\p{N})[–—](?=\p{N})|(?<=\p{L})–(?=\p{L})/gu
// A dash used as a pause: any other em or en dash, or a spaced hyphen between two words
const PAUSE_DASH = /[ \t]*[—–][ \t]*|(?<=\p{L}) - (?=\p{L})/gu
// A colon or semicolon that ends a clause: followed by a space or the end of a line, so
// "10:30", "3:1" and ";)" are left alone
const CLAUSE_BREAK = /[ \t]*[:;](?=\s|$)/gm
// Marks where a clause break became a new sentence, so only that next letter is capitalized
const NEW_SENTENCE = "\u0001"

const matchCase = (original: string, replacement: string) =>
  original[0] === original[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement

interface StyleOptions {
  singleLine: boolean
  // A pause dash becomes a space instead of ", " so the text doesn't grow
  compact: boolean
}

function restyle(segment: string, { singleLine, compact }: StyleOptions): string {
  let result = segment
  for (const [pattern, replacement] of WORD_SWAPS) {
    result = result.replace(pattern, (word) => matchCase(word, replacement))
  }
  return result
    .replace(JOINING_DASH, "-")
    .replace(PAUSE_DASH, (dash: string, offset: number, whole: string) => {
      const before = whole.slice(0, offset)
      const after = whole.slice(offset + dash.length)
      // A dash opening a line reads as a list marker; one closing a line just goes
      if (before === "" || before.endsWith("\n")) return after ? "- " : ""
      if (after === "" || after.startsWith("\n")) return ""
      // Right after other punctuation, a comma would double it up; after a full stop a new sentence starts
      if (/[.!?]$/.test(before)) return ` ${NEW_SENTENCE}`
      if (before.endsWith(",") || compact) return " "
      return ", "
    })
    .replace(CLAUSE_BREAK, (_mark: string, offset: number, whole: string) => {
      const before = whole.slice(0, offset)
      if (/[.!?,]$/.test(before)) return ""
      return singleLine ? "," : `.${NEW_SENTENCE}`
    })
    .replace(new RegExp(`${NEW_SENTENCE}([ \\t]*)(\\p{Ll})`, "gu"), (_match, space: string, letter: string) => `${space}${letter.toUpperCase()}`)
    .replaceAll(NEW_SENTENCE, "")
}

function rewrite(text: string, options: StyleOptions): string {
  // split() with a capture group alternates plain text (even indexes) and protected tokens (odd)
  return text
    .split(PROTECTED)
    .map((part, index) => (index % 2 === 0 ? restyle(part, options) : part))
    .join("")
    .trim()
}

/**
 * Rewrites the AI-sounding marks and words in one generated text. With maxChars, a result that
 * would grow past it uses spaces instead of commas for pauses.
 */
export function applyHumanStyle(text: string, { maxChars, singleLine = false }: { maxChars?: number; singleLine?: boolean } = {}): string {
  const styled = rewrite(text, { singleLine, compact: false })
  return maxChars !== undefined && styled.length > maxChars ? rewrite(text, { singleLine, compact: true }) : styled
}
