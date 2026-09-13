const WRAPPED_IN_QUOTES = /^["“'‘]([\s\S]*)["”'’]$/
// [Name], [Your Company], or a {{slot}} copied from a prompt template instead of filled in
const PLACEHOLDER = /\[[^\]\n]{1,60}\]|\{\{\s*[\w/]+\s*\}\}/

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
