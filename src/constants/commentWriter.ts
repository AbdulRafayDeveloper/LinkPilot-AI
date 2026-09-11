/**
 * Tune registry. Each tune owns an independent, separately stored prompt
 * (default template: src/prompts/comment-writer-<id>.md). Adding a tune means adding
 * an entry here plus its default template; the generation pipeline stays unchanged.
 */
export const COMMENT_TUNES = [
  { id: "thoughtful", label: "Thoughtful", shortLabel: "Thoughtful", description: "A nuanced observation" },
  { id: "impressive", label: "Impressive", shortLabel: "Impressive", description: "A sharp, memorable idea" },
  { id: "concerning", label: "Concerning", shortLabel: "Concerning", description: "A fair risk or question" },
  { id: "appreciative", label: "Appreciative", shortLabel: "Appreciative", description: "Credits a specific point" },
  { id: "past-experience", label: "Based on My Past Experience", shortLabel: "My Experience", description: "Your real experience" },
  { id: "latest-trends", label: "Latest Trends / Informative", shortLabel: "Latest Trends", description: "Recent, sourced context" },
] as const

export type CommentTuneId = (typeof COMMENT_TUNES)[number]["id"]

// Preselected so a comment can be generated right away; the user can pick another style
export const DEFAULT_COMMENT_TUNE: CommentTuneId = COMMENT_TUNES[0].id

export const COMMENT_TUNE_IDS = COMMENT_TUNES.map((tune) => tune.id) as [CommentTuneId, ...CommentTuneId[]]

export function getTuneLabel(tune: CommentTuneId): string {
  return COMMENT_TUNES.find((entry) => entry.id === tune)?.label ?? tune
}

export function commentWriterPromptKey(tune: CommentTuneId): string {
  return `comment_writer_prompt:${tune}`
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
