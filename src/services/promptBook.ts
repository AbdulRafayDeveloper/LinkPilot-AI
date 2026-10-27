import { loadPrompt, renderPrompt, type PromptName } from "@/services/prompts"

/**
 * **A tool's instructions, kept in the database and read by name.**
 *
 * Besides the prompts its users choose between, a tool sends a model many small pieces of text: the
 * message that asks for a rewrite, each problem its checks found, what to say when a field is empty,
 * the label over a block of data, what each field of the answer means. None of it may be written in
 * code (the owner's rule: every word a model reads is in the `prompts` collection, and an admin can
 * change it), and one stored prompt per sentence would be hundreds of prompts nobody could manage.
 *
 * So each tool has **one instructions prompt** (`<tool>-instructions`, a system prompt an admin edits
 * under Administration → Global AI Prompts → System), divided into named sections:
 *
 *     ## rewrite
 *     Rewrite your draft below. {{problems}} Keep the same tone.
 *
 *     ## problem.too-long
 *     It is {{length}} characters. Rewrite it in at most {{max}}.
 *
 * and the code asks for a section by its name, with the values to put in its `{{placeholders}}`.
 * **A section that is not there is an error that names it** (`PromptTemplateMissing`), never a quiet
 * fallback to text in the source: a tool that runs with half its instructions is worse than one that
 * says what is missing.
 */

export interface PromptBook {
  // One section, with its placeholders filled in
  text: (id: string, values?: Record<string, string | number>) => string
  // Whether a section exists, for the few that are optional by design
  has: (id: string) => boolean
}

// A section starts with "## <id>" on a line of its own; the id is letters, digits, dots and dashes
const SECTION_HEADING = /^##[ \t]+([\w.-]+)[ \t]*$/gm

/** Reads an instructions prompt into its sections. Pure, so the rules are testable without a database. */
export function parsePromptBook(name: string, content: string): PromptBook {
  const sections = new Map<string, string>()
  const headings = [...content.matchAll(SECTION_HEADING)]
  headings.forEach((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length
    const end = index + 1 < headings.length ? (headings[index + 1].index ?? content.length) : content.length
    sections.set(heading[1], content.slice(start, end).trim())
  })
  return {
    text: (id, values = {}) => {
      const section = sections.get(id)
      if (section === undefined) throw new Error(`PromptTemplateMissing: "${name}" has no "## ${id}" section in the prompts collection`)
      return renderPrompt(section, values)
    },
    has: (id) => sections.has(id),
  }
}

/** A tool's instructions prompt, read fresh like every prompt, so an admin's edit applies to the next result. */
export async function loadPromptBook(name: PromptName): Promise<PromptBook> {
  return parsePromptBook(name, await loadPrompt(name))
}
