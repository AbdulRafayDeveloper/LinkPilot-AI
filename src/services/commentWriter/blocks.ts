import { createTagSanitizer } from "@/lib/sanitize"
import type { PromptDataBlock } from "@/services/promptComposer"
import type { ResearchResult } from "@/services/liveResearch"
import type { UserExperience } from "@/services/senderContext"
import type { PromptBook } from "@/services/promptBook"

const MAX_RESEARCH_CHARS = 16_000
const MAX_LISTED_SOURCES = 30

export const COMMENT_WRITER_TAGS = ["linkedin_post", "research_data", "user_experience", "comment_style_instructions"]

// Every section tag is stripped from every input, including sections a given request doesn't
// use, so a post can't fake research findings or experience
const stripSectionTags = createTagSanitizer(COMMENT_WRITER_TAGS)

/**
 * The data sections a Comment Writer prompt can place with {{variable}}. Each is wrapped in
 * a delimiter tag its content can't close (see composePromptMessage). Their labels and empty texts
 * are the tool's instructions prompt (`book`), never words written here.
 */
export function postBlock(postText: string, book: PromptBook): PromptDataBlock {
  return { variable: "post_content", tag: "linkedin_post", label: book.text("label.post"), content: stripSectionTags(postText), pasted: true }
}

export function styleInstructionsBlock(styleBrief: string, book: PromptBook): PromptDataBlock {
  return {
    variable: "comment_style_instructions",
    tag: "comment_style_instructions",
    label: book.text("label.style"),
    content: stripSectionTags(styleBrief),
  }
}

export function experienceBlock({ text, hasProfile }: UserExperience, book: PromptBook): PromptDataBlock {
  return {
    variable: "user_experience",
    tag: "user_experience",
    label: book.text("label.experience"),
    content: text && stripSectionTags(text),
    emptyText: book.text(hasProfile ? "empty.experience-not-found" : "empty.experience-no-profile"),
  }
}

export function researchBlock(research: ResearchResult | null, book: PromptBook): PromptDataBlock {
  const sourceList = research?.sources
    .slice(0, MAX_LISTED_SOURCES)
    .map((source) => `- ${source.title} | ${source.url}`)
    .join("\n")
  return {
    variable: "research_context",
    tag: "research_data",
    label: book.text("label.research"),
    content:
      research && sourceList
        ? stripSectionTags(`${research.notes.slice(0, MAX_RESEARCH_CHARS)}\n\n${book.text("research.sources-heading")}\n${sourceList}`)
        : null,
    emptyText: book.text("empty.research"),
  }
}
