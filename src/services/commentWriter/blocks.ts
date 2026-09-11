import { createTagSanitizer } from "@/lib/sanitize"
import type { PromptDataBlock } from "@/services/promptComposer"
import type { ResearchResult } from "@/services/liveResearch"
import type { UserExperience } from "@/services/senderContext"

const MAX_RESEARCH_CHARS = 16_000
const MAX_LISTED_SOURCES = 30

export const COMMENT_WRITER_TAGS = ["linkedin_post", "research_data", "user_experience", "comment_style_instructions"]

// Every section tag is stripped from every input, including sections a given request doesn't
// use, so a post can't fake research findings or experience
const stripSectionTags = createTagSanitizer(COMMENT_WRITER_TAGS)

/**
 * The data sections a Comment Writer prompt can place with {{variable}}. Each is wrapped in
 * a delimiter tag its content can't close (see composePromptMessage).
 */
export function postBlock(postText: string): PromptDataBlock {
  return { variable: "post_content", tag: "linkedin_post", label: "LinkedIn post", content: stripSectionTags(postText) }
}

export function styleInstructionsBlock(styleBrief: string): PromptDataBlock {
  return {
    variable: "comment_style_instructions",
    tag: "comment_style_instructions",
    label: "Comment style instructions",
    content: stripSectionTags(styleBrief),
  }
}

export function experienceBlock({ text, hasProfile }: UserExperience): PromptDataBlock {
  return {
    variable: "user_experience",
    tag: "user_experience",
    label: "The user's experience",
    content: text && stripSectionTags(text),
    emptyText: hasProfile
      ? "No relevant experience was found in the user's About Me profile."
      : "The user hasn't written their About me profile, so no personal experience is available.",
  }
}

export function researchBlock(research: ResearchResult | null): PromptDataBlock {
  const sourceList = research?.sources
    .slice(0, MAX_LISTED_SOURCES)
    .map((source) => `- ${source.title} | ${source.url}`)
    .join("\n")
  return {
    variable: "research_context",
    tag: "research_data",
    label: "Research findings",
    content:
      research && sourceList
        ? stripSectionTags(
            `${research.notes.slice(0, MAX_RESEARCH_CHARS)}\n\nVerified source URLs (the only URLs you may cite):\n${sourceList}`
          )
        : null,
    emptyText: "No verified recent information was found for this post.",
  }
}
