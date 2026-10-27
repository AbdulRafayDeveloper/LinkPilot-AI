import type { EntryFields } from "@/lib/profileSections"

/**
 * The projects My AI Profile kept **in this browser** before entries were saved to accounts (the
 * `my-profile:projects` tool store), read once so they can be saved to the account and then
 * forgotten. Nothing here talks to the server: the page sends them and calls `forget` once it has.
 */

// Where the tool store kept them: its remembered choice (no expiry), the tab's copy and the 24-hour mirror
const KEYS = ["linkpilot:tool:choice:my-profile:projects", "linkpilot:tool:my-profile:projects"] as const

interface OldProject {
  id?: unknown
  name?: unknown
  summary?: unknown
  highlights?: unknown
  bestMatches?: unknown
  proposalMatches?: unknown
  keywords?: unknown
}

const text = (value: unknown) => (typeof value === "string" ? value : "")
const list = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [])

/** One old project in the fields the Projects section keeps now (its pairs were need/emphasize). */
export function projectFieldsOf(project: OldProject): EntryFields {
  const pairs = Array.isArray(project.proposalMatches) ? (project.proposalMatches as { need?: unknown; emphasize?: unknown }[]) : []
  return {
    name: text(project.name),
    summary: text(project.summary),
    highlights: list(project.highlights),
    bestMatches: list(project.bestMatches),
    proposalMatches: pairs.map((pair) => ({ first: text(pair?.need), second: text(pair?.emphasize) })).filter((pair) => pair.first && pair.second),
    keywords: list(project.keywords),
  }
}

/** Every project any of those copies holds, each once, with a way to forget them all once they are saved. */
export function takeBrowserProjects(): { entries: EntryFields[]; forget: () => void } | null {
  if (typeof window === "undefined") return null
  const found = new Map<string, OldProject>()
  const stores = [window.localStorage, window.sessionStorage]
  try {
    for (const storage of stores) {
      for (const key of KEYS) {
        const raw = storage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw) as { state?: { projects?: OldProject[] } }
        for (const project of parsed.state?.projects ?? []) {
          const id = text(project.id) || text(project.name)
          if (id && text(project.name).trim() && text(project.summary).trim() && !found.has(id)) found.set(id, project)
        }
      }
    }
  } catch {
    return null
  }
  return {
    entries: [...found.values()].map(projectFieldsOf),
    forget: () => {
      try {
        for (const storage of stores) for (const key of KEYS) storage.removeItem(key)
      } catch {
        // Private mode or blocked storage: they were saved, and are simply offered again next time
      }
    },
  }
}
