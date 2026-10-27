import { z } from "zod"
import type { PromptBook } from "@/services/promptBook"

/**
 * Shape requested from the writing model. Both providers' structured output handle plain
 * strings reliably, so "none" is an empty string rather than null. The two analysis
 * fields come first on purpose: the model commits to the post's point before writing. What each
 * field means is the tool's instructions prompt, so the schema is built from it.
 */
export const commentDraftSchema = (book: PromptBook) =>
  z.object({
    post_main_point: z.string().describe(book.text("field.post-main-point")),
    comment_plan: z.string().describe(book.text("field.comment-plan")),
    comment: z.string().describe(book.text("field.comment")),
    experience_quote: z.string().describe(book.text("field.experience-quote")),
    reference_url: z.string().describe(book.text("field.reference-url")),
    event_date: z.string().describe(book.text("field.event-date")),
  })

export type CommentDraft = z.infer<ReturnType<typeof commentDraftSchema>>
