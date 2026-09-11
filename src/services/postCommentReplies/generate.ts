import { z } from "zod"
import { HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages"
import { AI_PROVIDERS, generateStructuredWithFallback, type ModelProvider } from "@/services/ai"
import { runLiveResearch } from "@/services/liveResearch"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { getSenderProfile } from "@/services/senderProfile"
import { extractPostFromImage } from "@/services/postImage"
import { humanizeTexts } from "@/services/humanizer"
import { UserFacingError } from "@/lib/errors"
import { createTagSanitizer } from "@/lib/sanitize"
import type { PostSource } from "@/lib/validation/postInput"
import {
  LINKEDIN_COMMENT_MAX_CHARS,
  POST_COMMENT_REPLY_MESSAGES,
  getReplyStyleLabel,
  type ReplyContextId,
  type ReplyStage,
  type ReplyStyleId,
} from "@/constants/postCommentReplies"
import type { GeneratedReply, TargetComment } from "@/types/postCommentReplies"
import { getActiveReplyPrompt } from "./prompts"

// Higher than the project default so replies read like a person, not a template
const WRITING_TEMPERATURE = 0.7
// Integrity ceiling only; each saved prompt sets the real length
const REPLY_MAX_CHARS = 5000
const RESEARCH_NOTES_MAX_CHARS = 12000
const NO_SENDER_PROFILE_TEXT =
  "The user hasn't filled in their About Me profile, so nothing is known about their background, services or experience."
// One cited source is enough to support a single reply
const MIN_RESEARCH_SOURCES = 1
// Gemini first; OpenAI only when Gemini can't deliver
const PROVIDER_ORDER: readonly ModelProvider[] = AI_PROVIDERS
const WRAPPED_IN_QUOTES = /^(["“])([\s\S]*)(["”])$/
// First-person habit or experience claims, which models tend to invent for the user
const EXPERIENCE_CLAIM =
  /\b(?:we|i|our team|my team)\s+(?:usually|typically|normally|generally|often|always|tend to|found (?:that|it)|have (?:found|seen|tried))\b|\b(?:we|i)['’]ve (?:found|seen|tried)\b|\bin (?:my|our) experience\b|\bat (?:my|our) (?:company|job|work|firm)\b/i

// Prompt variables. The About Me lookup and live research run only when the saved prompt uses them.
// {{knowledge_base}} is kept as an alias of {{sender_profile}} so earlier saved prompts keep working.
const VARIABLE = {
  conversation: "conversation",
  senderProfile: "sender_profile",
  legacySenderProfile: "knowledge_base",
  webResearch: "web_research",
} as const

const stripDataTags = createTagSanitizer([
  "linkedin_post",
  "linkedin_comments",
  "target_comment",
  "sender_profile",
  "knowledge_base",
  "web_research",
  "reply_instructions",
  "draft_reply",
])

const ReplySchema = z.object({
  target_found: z.boolean().describe("False only when the pasted comments contain no comment to reply to"),
  replying_to: z.string().describe("Name of the commenter being replied to, or an empty string if it isn't shown"),
  reply: z.string().describe("The complete reply exactly as it should be posted; empty when target_found is false"),
})

type ReplyOutput = z.infer<typeof ReplySchema>

export interface ReplyInput {
  context: ReplyContextId
  style: ReplyStyleId
  comments: string
  // The original post as pasted text or a verified screenshot, or null when not provided
  post: PostSource | null
  targetComment: TargetComment | null
}

// The input after any screenshot has been read, so every prompt sees plain text
interface Conversation {
  postText: string | null
  comments: string
  targetComment: TargetComment | null
}

interface GenerateOptions {
  input: ReplyInput
  signal: AbortSignal
  onStage: (stage: ReplyStage) => void
}

function usesVariable(prompt: string, name: string): boolean {
  return prompt.includes(`{{${name}}}`)
}

function wrapSection(tag: string, content: string): string {
  return `<${tag}>\n${stripDataTags(content).trim()}\n</${tag}>`
}

/**
 * The post and the comments come from separate inputs, so each gets its own section.
 * The post section is left out entirely when the user didn't provide the post.
 */
function conversationSection({ postText, comments, targetComment }: Conversation): string {
  const sections = [
    ...(postText ? [wrapSection("linkedin_post", postText)] : []),
    wrapSection("linkedin_comments", comments),
  ]
  if (targetComment) {
    const author = targetComment.author ? `${targetComment.author}:\n` : ""
    sections.push(wrapSection("target_comment", `${author}${targetComment.text}`))
  }
  return sections.join("\n\n")
}

/**
 * The user's own About Me profile: the only source of facts about their background,
 * services and experience.
 */
async function loadSenderProfileSection(): Promise<string> {
  return (await getSenderProfile())?.trim() || NO_SENDER_PROFILE_TEXT
}

/**
 * Live web research through the shared Gemini → OpenAI search. Never fails the reply: when
 * nothing verifiable is found, the writer is told not to state current facts.
 */
async function researchConversation(conversation: Conversation, stylePrompt: string, signal: AbortSignal): Promise<string> {
  const system = renderPrompt(loadPrompt("post-comment-reply-research"), { CURRENT_DATETIME: new Date().toISOString() })
  const styleBrief = renderPrompt(stylePrompt, {
    [VARIABLE.conversation]: "(the post and comments below)",
    [VARIABLE.senderProfile]: "(the user's About Me profile)",
    [VARIABLE.legacySenderProfile]: "(the user's About Me profile)",
    [VARIABLE.webResearch]: "(this research)",
  })
  const messages: BaseMessage[] = [
    new SystemMessage(system),
    new HumanMessage(
      `${wrapSection("reply_instructions", styleBrief)}\n\n${conversationSection(conversation)}\n\nSearch the web now and reply only with the research report format from your instructions.`
    ),
  ]

  try {
    const research = await runLiveResearch({
      geminiPasses: [messages],
      openAIPasses: [messages],
      minSources: MIN_RESEARCH_SOURCES,
      signal,
      onFallback: () => undefined,
    })
    const sources = research.sources.map((source) => `- ${source.title} | ${source.url}`).join("\n")
    return `${research.notes.slice(0, RESEARCH_NOTES_MAX_CHARS)}\n\nSources:\n${sources}`
  } catch (error: unknown) {
    if (signal.aborted) throw error
    console.warn("⚠️ Post comment reply research unavailable:", error instanceof Error ? error.message : error)
    return "Live web research was unavailable for this reply, so don't state current facts, figures or dates."
  }
}

/**
 * Keeps the three instruction layers separate: application rules (with the post-ownership
 * context) in the system message, the saved style prompt as the user's instructions, and
 * pasted or retrieved text inside delimiter tags it cannot close. {{conversation}} places
 * the post and comment sections where the prompt wants them; otherwise they are appended.
 */
function buildMessages(
  input: ReplyInput,
  conversation: Conversation,
  stylePrompt: string,
  senderProfile: string | null,
  webResearch: string | null
): BaseMessage[] {
  const system = renderPrompt(loadPrompt("post-comment-reply-system"), {
    POST_CONTEXT: loadPrompt(`post-comment-reply-context-${input.context}`),
    STYLE: getReplyStyleLabel(input.style),
  })

  const sections = conversationSection(conversation)
  const variables: Record<string, string> = { [VARIABLE.conversation]: sections }
  if (senderProfile !== null) {
    const section = wrapSection("sender_profile", senderProfile)
    variables[VARIABLE.senderProfile] = section
    variables[VARIABLE.legacySenderProfile] = section
  }
  if (webResearch !== null) variables[VARIABLE.webResearch] = wrapSection("web_research", webResearch)

  const instructions = renderPrompt(stylePrompt, variables)
  const userMessage = usesVariable(stylePrompt, VARIABLE.conversation) ? instructions : `${instructions}\n\n${sections}`
  return [new SystemMessage(system), new HumanMessage(userMessage)]
}

function cleanReply(raw: string): string {
  const text = raw.trim()
  const wrapped = text.match(WRAPPED_IN_QUOTES)
  // Strip quotes only when they wrap the whole reply, not when it merely starts or ends with a quotation
  return (wrapped && !/["“”]/.test(wrapped[2]) ? wrapped[2] : text).trim()
}

function findUnusableReason(output: ReplyOutput): string | null {
  if (!output.target_found) return null
  const reply = cleanReply(output.reply)
  if (!reply) return "empty reply"
  if (reply.length > REPLY_MAX_CHARS) return `reply is ${reply.length} characters`
  return null
}

function experienceClaimRewrite(reply: string, claim: string): HumanMessage {
  return new HumanMessage(
    `Your draft reply below says "${claim}". Check every statement in it about what the user or their team does, did, uses or has experienced. Keep such a statement only if the post, the user's own comment or the user's About Me profile states it. Rewrite any other one as a general option (for example "one approach is..."). Keep the same style, length and target comment.\n\n${wrapSection("draft_reply", reply)}`
  )
}

function lengthWarning(length: number): string | null {
  return length > LINKEDIN_COMMENT_MAX_CHARS
    ? `This reply is ${length.toLocaleString()} characters, over LinkedIn's ${LINKEDIN_COMMENT_MAX_CHARS.toLocaleString()}-character comment limit. Shorten it before posting.`
    : null
}

/**
 * Writes one reply with the latest saved prompt for the exact context + style pair
 * (Gemini first, OpenAI only as a fallback). A post screenshot is read first. A draft that
 * claims first-person experience gets one controlled rewrite that keeps only claims the
 * sources support. The final reply is rewritten with the Humanization prompt. Throws a
 * user-facing error when the comments contain nothing to reply to.
 */
export async function generatePostCommentReply({ input, signal, onStage }: GenerateOptions): Promise<GeneratedReply> {
  const stylePrompt = await getActiveReplyPrompt(input.context, input.style)
  const needsSenderProfile =
    usesVariable(stylePrompt, VARIABLE.senderProfile) || usesVariable(stylePrompt, VARIABLE.legacySenderProfile)
  const needsResearch = usesVariable(stylePrompt, VARIABLE.webResearch)
  let providers = PROVIDER_ORDER

  let extractedPost: string | null = null
  if (input.post?.type === "image") {
    onStage("READING_POST")
    const extraction = await extractPostFromImage({ image: input.post.image, providers, signal })
    extractedPost = extraction.postText
    // A provider that just failed isn't called again within the same request
    providers = providers.slice(providers.indexOf(extraction.provider))
  }
  const conversation: Conversation = {
    postText: input.post?.type === "text" ? input.post.text : extractedPost,
    comments: input.comments,
    targetComment: input.targetComment,
  }

  let senderProfile: string | null = null
  let webResearch: string | null = null
  if (needsSenderProfile || needsResearch) {
    onStage("ANALYZING")
    ;[senderProfile, webResearch] = await Promise.all([
      needsSenderProfile ? loadSenderProfileSection() : null,
      needsResearch ? researchConversation(conversation, stylePrompt, signal) : null,
    ])
  }

  onStage("WRITING")
  const messages = buildMessages(input, conversation, stylePrompt, senderProfile, webResearch)
  const write = (thread: BaseMessage[]) =>
    generateStructuredWithFallback({
      schema: ReplySchema,
      name: "post_comment_reply",
      messages: thread,
      temperature: WRITING_TEMPERATURE,
      providers,
      signal,
      validate: findUnusableReason,
    })

  const first = await write(messages)
  if (!first.data.target_found) {
    throw new UserFacingError(POST_COMMENT_REPLY_MESSAGES.missingComment)
  }

  let reply = cleanReply(first.data.reply)
  let replyingTo = first.data.replying_to
  let provider = first.provider

  // One controlled rewrite when the draft claims experience the sources may not support
  const claim = reply.match(EXPERIENCE_CLAIM)?.[0]
  if (claim) {
    const rewrite = await write([...messages, experienceClaimRewrite(reply, claim)]).catch((error: unknown) => {
      if (signal.aborted) throw error
      console.warn("⚠️ Post comment reply claim rewrite failed; returning the original draft:", error)
      return null
    })
    if (rewrite?.data.target_found) {
      reply = cleanReply(rewrite.data.reply)
      replyingTo = rewrite.data.replying_to || replyingTo
      provider = rewrite.provider
    }
  }

  onStage("HUMANIZING")
  const draftHasClaim = EXPERIENCE_CLAIM.test(reply)
  const humanization = await humanizeTexts({
    fields: [
      {
        id: "reply",
        kind: input.context === "my-post" ? "LinkedIn reply to a comment on my own post" : "LinkedIn reply in someone else's comment thread",
        text: reply,
        maxChars: REPLY_MAX_CHARS,
      },
    ],
    providers: providers.slice(providers.indexOf(provider)),
    signal,
    validate: (_id, text) => (!draftHasClaim && EXPERIENCE_CLAIM.test(text) ? "adds a first-person experience claim" : null),
  })
  reply = cleanReply(humanization.texts.reply)

  // Serialized so the details also survive Next's dev file log, which drops object arguments
  console.info(
    "Post comment reply generated:",
    JSON.stringify({
      context: input.context,
      style: input.style,
      provider,
      humanized: humanization.humanized,
      post: input.post?.type ?? "none",
      characters: reply.length,
      senderProfile: needsSenderProfile,
      webResearch: needsResearch,
      claimRewrite: claim ?? null,
    })
  )

  return {
    reply,
    context: input.context,
    style: input.style,
    replyingTo: replyingTo.trim() || input.targetComment?.author || null,
    characterCount: reply.length,
    maxCharacters: LINKEDIN_COMMENT_MAX_CHARS,
    warning: lengthWarning(reply.length),
    extractedPost,
  }
}
