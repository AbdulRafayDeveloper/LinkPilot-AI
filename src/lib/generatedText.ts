const WRAPPED_IN_QUOTES = /^["“'‘]([\s\S]*)["”'’]$/
const PLACEHOLDER = /\[[^\]\n]{1,60}\]/

/**
 * Trims model output and removes one pair of quotation marks wrapped around the whole text.
 */
export function cleanGeneratedText(raw: string): string {
  const text = raw.trim()
  return (text.match(WRAPPED_IN_QUOTES)?.[1] ?? text).trim()
}

/**
 * True when the text still contains a template placeholder such as [Name] or [Your Company].
 */
export function containsPlaceholder(text: string): boolean {
  return PLACEHOLDER.test(text)
}
