/**
 * The `{{placeholders}}` of a prompt, and the ones an edit has lost. A placeholder is where a tool puts
 * live data (the post, the research it found, your experience), and for some of them **its presence is
 * what turns the feature on**: Comment Writer only researches the web for a tune whose prompt places
 * `{{research_context}}`, and only looks up your experience for one that places `{{user_experience}}`.
 * So an edit that drops one quietly turns that feature off, which is exactly what happened to the
 * Latest Trends and Based on My Past Experience tunes. The admin editor warns about it and offers to
 * put the lost ones back, and `scripts/restore-lost-placeholders.mjs` repairs stored prompts the same way.
 */

const PLACEHOLDER = /\{\{\s*([\w-]+)\s*\}\}/g
// Every writing prompt ends with this block, which should stay last
const HUMAN_STYLE_HEADING = /^HUMAN STYLE \(STRICT/m

/** The placeholders a prompt places, each once, in the order they first appear. */
export function placeholdersIn(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1]))]
}

/** The placeholders the original text placed that the text now does not. */
export function lostPlaceholders(text: string, original: string): string[] {
  const kept = new Set(placeholdersIn(text))
  return placeholdersIn(original).filter((name) => !kept.has(name))
}

/**
 * The text with every lost placeholder put back as the original placed it: the line that carries it
 * and, when the line before it is a label of its own ("Verified research findings:"), that label too.
 * They go above the HUMAN STYLE block when there is one, so it stays last, otherwise at the end.
 * Text that has lost nothing comes back unchanged.
 */
export function withPlaceholdersBack(text: string, original: string): string {
  const lost = lostPlaceholders(text, original)
  if (lost.length === 0) return text
  const lines = original.split(/\r?\n/)
  const blocks = lost.map((name) => {
    const at = lines.findIndex((line) => new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`).test(line))
    const label = at > 0 ? lines[at - 1] : ""
    const keepsLabel = label.trim() !== "" && placeholdersIn(label).length === 0
    return [keepsLabel ? label : null, lines[at]].filter((line): line is string => line !== null).join("\n")
  })
  const block = blocks.join("\n\n")
  const at = text.search(HUMAN_STYLE_HEADING)
  if (at < 0) return `${text.trimEnd()}\n\n${block}\n`
  return `${text.slice(0, at).trimEnd()}\n\n${block}\n\n${text.slice(at)}`
}
