/**
 * Tune registry. Each tune owns an independent, separately stored prompt
 * (prompt record: comment-writer-<id> in the prompts collection). Adding a tune means adding
 * an entry here plus its default template; the generation pipeline stays unchanged.
 */
export const COMMENT_TUNES = [
  { id: "thoughtful", label: "Thoughtful", shortLabel: "Thoughtful", description: "A nuanced observation" },
  // The post's most interesting point, the gap it leaves, what to add, a respectful challenge and a tip
  { id: "value-add", label: "Value Add", shortLabel: "Value Add", description: "Fills a gap + a question + a tip" },
  { id: "past-experience", label: "Based on My Past Experience", shortLabel: "My Experience", description: "Your real experience" },
  { id: "latest-trends", label: "Latest Trends / Informative", shortLabel: "Latest Trends", description: "Recent, sourced context" },
  { id: "concerning", label: "Concerning", shortLabel: "Concerning", description: "A fair risk or question" },
  // Was "appreciative" (RENAMED_COMMENT_TUNES): now a deep read of the post, why it matters and what to add
  { id: "supportive", label: "Supportive", shortLabel: "Supportive", description: "Why it matters + support" },
  { id: "impressive", label: "Impressive", shortLabel: "Impressive", description: "A sharp, memorable idea" },
  // The point said in a friendly way that is easy to remember and relate to, with a practical tip
  { id: "relatable", label: "Relatable", shortLabel: "Relatable", description: "Memorable, friendly + a tip" },
] as const

export type CommentTuneId = (typeof COMMENT_TUNES)[number]["id"]

/**
 * Tunes that were renamed, old id to new. A browser that remembered the old tune, an old link to a
 * filtered "view all" page, or a caller written before still sends the old id, so the routes read it
 * as the new one (lib/validation/commentTunes.ts) instead of refusing it. Saved comments and the prompt
 * were moved to the new id by `node scripts/update-comment-tunes.mjs`.
 */
export const RENAMED_COMMENT_TUNES: Readonly<Record<string, CommentTuneId>> = { appreciative: "supportive" }

/** The current id for a tune id: a renamed tune's old id becomes its new one, anything else is unchanged. */
export const currentTuneId = (id: string): string => RENAMED_COMMENT_TUNES[id] ?? id

// Preselected so a comment can be generated right away; the user can pick another style
export const DEFAULT_COMMENT_TUNE: CommentTuneId = COMMENT_TUNES[0].id

export const COMMENT_TUNE_IDS = COMMENT_TUNES.map((tune) => tune.id) as [CommentTuneId, ...CommentTuneId[]]

export function getTuneLabel(tune: CommentTuneId): string {
  return COMMENT_TUNES.find((entry) => entry.id === tune)?.label ?? tune
}

// LinkedIn's maximum comment length
export const COMMENT_MAX_CHARS = 1250

/**
 * Optional variables for tune prompts. The web research and About Me lookups only
 * run when the saved prompt includes their variable, so each prompt decides its data sources.
 */
export const COMMENT_PROMPT_VARIABLES = [
  {
    name: "post_content",
    description: "Places the LinkedIn post here. It's added at the end if you leave it out.",
  },
  { name: "selected_tune", description: "Inserts the comment style name." },
  {
    name: "user_experience",
    description: "Places your About Me profile here.",
  },
  {
    name: "research_context",
    description: "Runs live web research on the post's topic and places the verified findings here.",
  },
] as const

export type CommentPromptVariable = (typeof COMMENT_PROMPT_VARIABLES)[number]["name"]

export function promptUsesVariable(prompt: string, variable: CommentPromptVariable): boolean {
  return prompt.includes(`{{${variable}}}`)
}

export const COMMENT_WRITER_MESSAGES = {
  missingPost: "Please provide a LinkedIn post first.",
  missingTune: "Please select a comment style.",
  generationFailed: "Unable to generate the comment right now. Please try again.",
  noRecentDevelopment: "No verified recent development fit this post, so the comment doesn't cite one.",
  noExperience: "Nothing in your About Me profile fit this post, so the comment doesn't claim personal experience.",
  missingProfile:
    "Your About Me profile is empty, so the comment doesn't claim personal experience. Fill it in under First Message → Update Prompt → About Me so the writer knows which experience is yours.",
} as const
