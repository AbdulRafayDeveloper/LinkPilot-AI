import type { AiProviderId } from "@/constants/aiProviders"
import type { CommentTuneId } from "@/constants/commentWriter"
import type { EditablePrompt } from "./prompts"
import type { WithAiSource } from "./ai"

export interface CommentTunePrompt extends EditablePrompt {
  tune: CommentTuneId
}

export interface CommentReference {
  url: string
  title: string
  source: string
}

export interface GeneratedComment extends Pick<WithAiSource, "providers"> {
  comment: string
  tune: CommentTuneId
  characterCount: number
  maxCharacters: number
  provider: AiProviderId
  reference: CommentReference | null
  notices: string[]
  // The post text read from an uploaded screenshot, so the user can check it
  extractedPost: string | null
}

export type CommentStage = "READING_IMAGE" | "RESEARCHING" | "WRITING" | "HUMANIZING" | "FALLBACK"

export type CommentStreamEvent =
  | { status: CommentStage; text: string }
  | { status: "COMPLETE"; result: GeneratedComment }
  | { status: "ERROR"; message: string }
