/**
 * Which of the sidebar's sections (its headings in TOOL_GROUPS) is open. They work as an
 * accordion: one open at a time, and opening one closes the one that was open. Kept apart from
 * the component so the rule can be tested on its own.
 *
 * The stored choice is a section's id, "" when the user closed the open one and left none open,
 * or null when they have never chosen.
 */

/**
 * The open section: the user's own choice while that section is still on show; otherwise, the
 * first time, the section of the page being viewed (so it is never hidden on arrival), or the
 * first section when the page belongs to none. A choice that can no longer be shown (every tool
 * under it turned off) falls back the same way, rather than leaving the list closed for no reason.
 */
export function openSectionOf<Id extends string>(stored: string | null, activeSection: Id | null, available: readonly Id[]): Id | null {
  if (stored === "") return null
  const chosen = available.find((id) => id === stored)
  if (chosen) return chosen
  if (activeSection && available.includes(activeSection)) return activeSection
  return available[0] ?? null
}

/** What a click on a section's heading stores: that section, or "" when it was the open one. */
export const toggledSection = (open: string | null, clicked: string) => (open === clicked ? "" : clicked)
