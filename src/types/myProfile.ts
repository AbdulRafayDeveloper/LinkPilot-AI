import type { EntryFields } from "@/lib/profileSections"

/** One My AI Profile entry as the page reads it. See constants/profileSections.ts. */
export interface ProfileEntry {
  id: string
  section: string
  fields: EntryFields
  position: number
  // Whether it can be found yet (services/myProfile/vectors.ts)
  searchStatus: "pending" | "ready" | "failed"
  searchError: string | null
  createdAt: string
  updatedAt: string
}

/** How one person's profile stands in search: how many parts can be found, and why any cannot. */
export interface ProfileSearchState {
  // False when Gemini is not set up here; `missing` names what to set
  configured: boolean
  missing: string[]
  // Every entry plus Profile Info when it has text
  total: number
  ready: number
  pending: number
  failed: number
  // The reasons given, each once
  errors: string[]
}

/** One piece of the profile that matches a question, closest first. */
export interface ProfileSearchMatch {
  sourceId: string
  // A section's id, or "profile-info"
  section: string
  text: string
  score: number
}
