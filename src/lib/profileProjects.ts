import { PROFILE_PROJECT_MESSAGES, PROJECT_LIMITS } from "@/constants/profileProjects"
import type { ProfileProject, ProjectDraft } from "@/types/profileProjects"

/**
 * The rules of a project on My AI Profile → Projects, kept apart from the page so they are tested
 * on their own: turning the form into a project and back, and what a project needs to be saved.
 */

export const emptyDraft = (): ProjectDraft => ({ name: "", summary: "", highlights: "", bestMatches: "", proposalMatches: [{ need: "", emphasize: "" }], keywords: [] })

/** A list typed one item per line: blank lines dropped, each trimmed and cut to a line's length, each once. */
export function linesOf(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim().slice(0, PROJECT_LIMITS.line))
    .filter(Boolean)
  return [...new Set(lines)].slice(0, PROJECT_LIMITS.lines)
}

/**
 * Keywords typed with commas or pasted as a list: each trimmed, cut to a line's length and kept
 * once whatever its case, added after the ones already there.
 */
export function addKeywords(current: readonly string[], typed: string): string[] {
  const next = [...current]
  for (const word of typed.split(/[,\n]/).map((entry) => entry.trim().slice(0, PROJECT_LIMITS.line))) {
    if (word && !next.some((kept) => kept.toLowerCase() === word.toLowerCase())) next.push(word)
  }
  return next.slice(0, PROJECT_LIMITS.keywords)
}

/** What is missing before the draft can be saved, or null when it is ready. */
export function draftProblem(draft: ProjectDraft): string | null {
  if (!draft.name.trim()) return PROFILE_PROJECT_MESSAGES.needsName
  if (!draft.summary.trim()) return PROFILE_PROJECT_MESSAGES.needsSummary
  return null
}

/** The draft as a project, keeping the id and first date of the one it edits. */
export function projectOf(draft: ProjectDraft, editing: ProfileProject | null, now: Date = new Date()): ProfileProject {
  const at = now.toISOString()
  return {
    id: editing?.id ?? `project-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: draft.name.trim().slice(0, PROJECT_LIMITS.name),
    summary: draft.summary.trim().slice(0, PROJECT_LIMITS.summary),
    highlights: linesOf(draft.highlights),
    bestMatches: linesOf(draft.bestMatches),
    // A pair needs both halves; half of one says nothing a tool could use
    proposalMatches: draft.proposalMatches
      .map((match) => ({ need: match.need.trim().slice(0, PROJECT_LIMITS.match), emphasize: match.emphasize.trim().slice(0, PROJECT_LIMITS.match) }))
      .filter((match) => match.need && match.emphasize)
      .slice(0, PROJECT_LIMITS.matches),
    keywords: draft.keywords.slice(0, PROJECT_LIMITS.keywords),
    createdAt: editing?.createdAt ?? at,
    updatedAt: at,
  }
}

/** A project back in the form, to be edited. */
export function draftOf(project: ProfileProject): ProjectDraft {
  return {
    name: project.name,
    summary: project.summary,
    highlights: project.highlights.join("\n"),
    bestMatches: project.bestMatches.join("\n"),
    proposalMatches: project.proposalMatches.length > 0 ? project.proposalMatches.map((match) => ({ ...match })) : [{ need: "", emphasize: "" }],
    keywords: [...project.keywords],
  }
}
