/**
 * Builds a function that removes the given prompt delimiter tags from text, so neither
 * configured prompts nor untrusted content can close their own section and inject instructions.
 */
export function createTagSanitizer(tagNames: readonly string[]): (text: string) => string {
  const pattern = new RegExp(`<\\/?\\s*(${tagNames.join("|")})\\b[^>]*>`, "gi")
  return (text) => text.replace(pattern, "")
}
