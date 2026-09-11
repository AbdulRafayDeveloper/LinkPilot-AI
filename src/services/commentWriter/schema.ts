import { z } from "zod"

/**
 * Shape requested from the writing model. Both providers' structured output handle plain
 * strings reliably, so "none" is an empty string rather than null. The two analysis
 * fields come first on purpose: the model commits to the post's point before writing.
 */
export const CommentDraftSchema = z.object({
  post_main_point: z.string().describe("The post's central point in one sentence, in your own words"),
  comment_plan: z.string().describe("One sentence on what the comment adds beyond the post"),
  comment: z.string().describe("The finished LinkedIn comment, plain text only"),
  experience_quote: z
    .string()
    .describe("Verbatim excerpt from <user_experience> behind any personal experience in the comment, or an empty string"),
  reference_url: z
    .string()
    .describe("Verified source URL copied exactly from <research_data> for any recent fact in the comment, or an empty string"),
  event_date: z.string().describe("YYYY-MM-DD date of that development as stated in <research_data>, or an empty string"),
})

export type CommentDraft = z.infer<typeof CommentDraftSchema>
