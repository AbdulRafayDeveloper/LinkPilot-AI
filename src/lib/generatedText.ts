const WRAPPED_IN_QUOTES = /^["“'‘]([\s\S]*)["”'’]$/
// [Name], [Your Company], or a {{slot}} copied from a prompt template instead of filled in
const PLACEHOLDER = /\[[^\]\n]{1,60}\]|\{\{\s*[\w/]+\s*\}\}/
// LinkedIn has no formatting, so ** __ and ` reach the reader as the characters themselves
const MARKDOWN_MARKS = /\*\*|__|`/g

/**
 * Trims model output and removes one pair of quotation marks wrapped around the whole text.
 */
export function cleanGeneratedText(raw: string): string {
  const text = raw.trim()
  return (text.match(WRAPPED_IN_QUOTES)?.[1] ?? text).trim()
}

/**
 * True when the text still contains a template placeholder such as [Name], [Your Company] or {{first_name}}.
 */
export function containsPlaceholder(text: string): boolean {
  return PLACEHOLDER.test(text)
}

/**
 * Removes markdown emphasis marks. Models fall back to them out of habit, and LinkedIn prints
 * them literally, so a "**step one**" would be posted with the asterisks showing.
 */
export function stripMarkdownMarks(text: string): string {
  return text.replace(MARKDOWN_MARKS, "")
}
