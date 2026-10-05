/**
 * The A, B, C, D method: the message ends by offering four replies, so answering costs the reader
 * one letter. The four lines are fixed here rather than left to the model, so they are always the
 * owner's own wording, always all four, and never the crude version of D that this method is known
 * for online. Kept away from the database and from any model, so First Message and InMail end the
 * same way and the rules can be tested on their own.
 */

export const ABCD_LEAD_IN = "Just reply with a letter:"

export const ABCD_OPTIONS = [
  { letter: "A", text: "Yes, I'm interested, let's move forward" },
  { letter: "B", text: "I'm interested, but not right now" },
  { letter: "C", text: "I'm not really interested at all" },
  { letter: "D", text: "Leave me alone" },
] as const

/** The block exactly as it must appear at the end of the message. */
export const ABCD_BLOCK = [ABCD_LEAD_IN, ...ABCD_OPTIONS.map((option) => `${option.letter} - ${option.text}`)].join("\n")

// A line the model wrote for one of the letters, however it worded or punctuated it ("A) yes...", "**B.** ...")
const optionLine = (letter: string) => new RegExp(`^\\s*(?:\\*\\*)?${letter}(?:\\*\\*)?\\s*[-–—).:,]\\s*\\S`, "im")
// The lead-in, in whatever words, so it is replaced rather than left above the block
const LEAD_IN_LINE = /^\s*(?:\*\*)?(?:just\s+)?(?:reply|respond|answer|pick|choose|let me know)\b[^\n]*$/im
// The same sentence written at the end of a paragraph rather than on a line of its own
const LEAD_IN_TAIL = /\s*(?:just\s+)?(?:reply|respond|answer)\s+with\s+(?:a|one|the)\s+letter\s*[.:!]?\s*$/i

/** Whether the message already ends with the four options, exactly as they are written here. */
export const hasAbcdOptions = (message: string) => message.trimEnd().endsWith(ABCD_BLOCK)

/**
 * The message with the four options on the end, exactly as written here. Anything the model wrote
 * for the letters, and its own lead-in line, are taken off first, so the block is never said twice
 * and a reworded or missing option can't reach the user.
 */
export function withAbcdOptions(message: string): { text: string; fixed: boolean } {
  const trimmed = message.trim()
  if (hasAbcdOptions(trimmed)) return { text: trimmed, fixed: false }
  const kept: string[] = []
  for (const line of trimmed.split("\n")) {
    const isOption = ABCD_OPTIONS.some((option) => optionLine(option.letter).test(line))
    if (isOption || LEAD_IN_LINE.test(line)) continue
    kept.push(line)
  }
  // A model often ends its paragraph with "Just reply with a letter." too; the block says that itself
  const body = kept.join("\n").trim().replace(LEAD_IN_TAIL, "").trim()
  return { text: body ? `${body}\n\n${ABCD_BLOCK}` : ABCD_BLOCK, fixed: true }
}

/** What the humanizer is told when its rewrite loses or changes the options. */
export const abcdProblem = (message: string) =>
  hasAbcdOptions(message) ? null : `End the message with these four lines exactly as they are, nothing changed:\n${ABCD_BLOCK}`
