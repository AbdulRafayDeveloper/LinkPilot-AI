/**
 * Which of the sidebar's sections (its headings in TOOL_GROUPS) are open. Each one opens and
 * closes on its own, so any number can be open at once, all of them or none. Kept apart from the
 * component so the rule can be tested on its own.
 *
 * The stored choices are the user's own, one per section: true for open, false for closed. A
 * section the user has never touched has none.
 */
export type SectionChoices = Record<string, boolean>

/**
 * Whether a section is open: the user's own choice for it, or, for a section they have never
 * touched, open while the page on screen is one of its tools, so that page is never hidden.
 */
export const isSectionOpen = (choices: SectionChoices, id: string, containsCurrentPage: boolean) => choices[id] ?? containsCurrentPage

/** What a click on one heading stores: that section flipped, every other section left as it was. */
export const withSectionToggled = (choices: SectionChoices, id: string, isOpen: boolean): SectionChoices => ({ ...choices, [id]: !isOpen })

/** Reads stored choices, keeping only true/false per section, so anything else stored reads as untouched. */
export function parseSectionChoices(raw: string | null): SectionChoices {
  try {
    const value: unknown = JSON.parse(raw ?? "{}")
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, open]) => typeof open === "boolean")) as SectionChoices
  } catch {
    return {}
  }
}
