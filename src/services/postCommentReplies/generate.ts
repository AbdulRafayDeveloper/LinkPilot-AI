import { z } from "zod"
import { HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { currentModelOrder } from "@/lib/modelOrder"
import { runLiveResearch } from "@/services/liveResearch"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { loadPromptBook, type PromptBook } from "@/services/promptBook"
import { getFullSenderProfile } from "@/services/senderProfile"
import { extractPostFromImage } from "@/services/postImage"
import { humanizeTexts } from "@/services/humanizer"
import { UserFacingError } from "@/lib/errors"
import { stripMarkdownMarks } from "@/lib/generatedText"
import { findUnsupportedFigures } from "@/lib/figures"
import { createTagSanitizer } from "@/lib/sanitize"
import { parseLinkedInConversation } from "@/lib/linkedinComments"
import type { PostSource } from "@/lib/validation/postInput"
import {
  POST_COMMENT_REPLY_MESSAGES,
  REPLY_TARGET_MAX_CHARS,
  getReplyStyleLabel,
  isReplyAuthor,
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
// Targeted rewrites for made-up figures, unsupported claims, a reply that's too long or stiff punctuation
const MAX_REWRITES = 2
// One cited source is enough to support a single reply
const MIN_RESEARCH_SOURCES = 1
const WRAPPED_IN_QUOTES = /^(["“])([\s\S]*)(["”])$/
// First-person habit or experience claims, which models tend to invent for the user
const EXPERIENCE_CLAIM =
  /\b(?:we|i|our team|my team)\s+(?:usually|typically|normally|generally|often|always|tend to|found (?:that|it)|have (?:found|seen|tried))\b|\b(?:we|i)['’]ve (?:found|seen|tried)\b|\bin (?:my|our) experience\b|\bat (?:my|our) (?:company|job|work|firm)\b/i

// A story about an unnamed client, which the model tends to invent to fill a case-study structure
const CLIENT_STORY =
  /\b(?:a|one|another)\s+(?:recent\s+|former\s+|past\s+)?client(?:\s+of\s+(?:ours|mine))?\b|\bone of (?:our|my) clients\b/i
// Replies read like a person typing: no colons, semicolons, dashes or commas (a comma or colon inside a number is fine)
const STIFF_PUNCTUATION = /(?<!\d)[,:]|[,:](?!\d)|;|[—–]|\s-\s/

// Prompt variables. Live research runs only when the saved prompt uses it. {{knowledge_base}} is
// an alias of {{sender_profile}}, and {{comment}} of {{latest_comment}}, so every saved prompt keeps working.
const VARIABLE = {
  conversation: "conversation",
  postContent: "post_content",
  latestComment: "latest_comment",
  comment: "comment",
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

// What each field means is part of the tool's instructions prompt, so the schema is built from it
const replySchema = (book: PromptBook) =>
  z.object({
    target_found: z.boolean().describe(book.text("field.target-found")),
    replying_to: z.string().describe(book.text("field.replying-to")),
    reply: z.string().describe(book.text("field.reply")),
  })

type ReplyOutput = z.infer<ReturnType<typeof replySchema>>

export interface ReplyInput {
  context: ReplyContextId
  style: ReplyStyleId
  comments: string
  // The original post as pasted text or a verified screenshot, or null when not provided
  post: PostSource | null
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

function postSection(postText: string | null): string | null {
  return postText ? wrapSection("linkedin_post", postText) : null
}

function targetSection(targetComment: TargetComment | null): string | null {
  if (!targetComment) return null
  const author = targetComment.author ? `${targetComment.author}:\n` : ""
  return wrapSection("target_comment", `${author}${targetComment.text}`)
}

/**
 * The post and the comments come from separate inputs, so each gets its own section.
 * The post section is left out entirely when the user didn't provide the post, and a
 * part the prompt already places elsewhere ({{post_content}}, {{latest_comment}}) isn't repeated.
 */
function conversationSection(
  { postText, comments, targetComment }: Conversation,
  { includePost = true, includeTarget = true }: { includePost?: boolean; includeTarget?: boolean } = {}
): string {
  return [
    includePost ? postSection(postText) : null,
    wrapSection("linkedin_comments", comments),
    includeTarget ? targetSection(targetComment) : null,
  ]
    .filter((section): section is string => section !== null)
    .join("\n\n")
}

/**
 * The comment to answer: the latest comment in the thread that Abdul didn't write. Null
 * when the comments can't be told apart, and then the writer finds it itself.
 */
function resolveTargetComment(comments: string): TargetComment | null {
  const latest = parseLinkedInConversation(comments)
    .comments.filter((comment) => !isReplyAuthor(comment.author))
    .at(-1)
  return latest ? { author: latest.author, text: latest.text } : null
}

/**
 * Everything Abdul has written about himself: his About Me profile and his Rafay Profile
 * Info (Global AI Prompts). It is the only source of facts about his background, work,
 * results and numbers, and every reply style may draw on it.
 */
async function loadSenderProfileSection(book: PromptBook): Promise<string> {
  return (await getFullSenderProfile()) ?? book.text("empty.sender-profile")
}

/**
 * Live web research through the shared Groq → OpenAI search. Never fails the reply: when
 * nothing verifiable is found, the writer is told not to state current facts.
 */
async function researchConversation(conversation: Conversation, stylePrompt: string, signal: AbortSignal, book: PromptBook): Promise<string> {
  const system = renderPrompt(await loadPrompt("post-comment-reply-research"), { CURRENT_DATETIME: new Date().toISOString() })
  const styleBrief = renderPrompt(stylePrompt, {
    [VARIABLE.conversation]: book.text("research.brief.conversation"),
    [VARIABLE.postContent]: book.text("research.brief.post"),
    [VARIABLE.latestComment]: book.text("research.brief.comment"),
    [VARIABLE.comment]: book.text("research.brief.comment"),
    [VARIABLE.senderProfile]: book.text("research.brief.sender-profile"),
    [VARIABLE.legacySenderProfile]: book.text("research.brief.sender-profile"),
    [VARIABLE.webResearch]: book.text("research.brief.research"),
  })
  const messages: BaseMessage[] = [
    new SystemMessage(system),
    new HumanMessage(
      book.text("research.request", { instructions: wrapSection("reply_instructions", styleBrief), conversation: conversationSection(conversation) })
    ),
  ]

  try {
    const research = await runLiveResearch({
      groqPasses: [messages],
      openAIPasses: [messages],
      minSources: MIN_RESEARCH_SOURCES,
      signal,
      onFallback: () => undefined,
    })
    const sources = research.sources.map((source) => `- ${source.title} | ${source.url}`).join("\n")
    return `${research.notes.slice(0, RESEARCH_NOTES_MAX_CHARS)}\n\n${book.text("research.sources-heading")}\n${sources}`
  } catch (error: unknown) {
    if (signal.aborted) throw error
    console.warn("⚠️ Post comment reply research unavailable:", error instanceof Error ? error.message : error)
    return book.text("research.unavailable")
  }
}

/**
 * Keeps the three instruction layers separate: application rules (with the post-ownership
 * context) in the system message, the saved style prompt as the user's instructions, and
 * pasted or retrieved text inside delimiter tags it cannot close. Each variable places its
 * section where the prompt wants it: {{conversation}} (post, comments and the comment being
 * answered), {{post_content}}, {{latest_comment}} / {{comment}} and {{sender_profile}}.
 * Whatever the prompt doesn't place is appended after it.
 */
async function buildMessages(
  input: ReplyInput,
  conversation: Conversation,
  stylePrompt: string,
  senderProfile: string,
  webResearch: string | null,
  book: PromptBook
): Promise<BaseMessage[]> {
  const [systemTemplate, postContext] = await Promise.all([
    loadPrompt("post-comment-reply-system"),
    loadPrompt(`post-comment-reply-context-${input.context}`),
  ])
  const system = renderPrompt(systemTemplate, {
    POST_CONTEXT: postContext,
    STYLE: getReplyStyleLabel(input.style),
  })

  const uses = (...names: string[]) => names.some((name) => usesVariable(stylePrompt, name))
  const placesPost = uses(VARIABLE.postContent)
  const placesTarget = uses(VARIABLE.latestComment, VARIABLE.comment)
  const target = targetSection(conversation.targetComment) ?? book.text("empty.latest-comment")
  const profile = wrapSection("sender_profile", senderProfile)
  const variables: Record<string, string> = {
    [VARIABLE.conversation]: conversationSection(conversation, { includePost: !placesPost, includeTarget: !placesTarget }),
    [VARIABLE.postContent]: postSection(conversation.postText) ?? book.text("empty.post"),
    [VARIABLE.latestComment]: target,
    [VARIABLE.comment]: target,
    [VARIABLE.senderProfile]: profile,
    [VARIABLE.legacySenderProfile]: profile,
  }
  if (webResearch !== null) variables[VARIABLE.webResearch] = wrapSection("web_research", webResearch)

  const appended = [
    uses(VARIABLE.conversation)
      ? null
      : conversationSection(conversation, { includePost: !placesPost, includeTarget: !placesTarget }),
    uses(VARIABLE.senderProfile, VARIABLE.legacySenderProfile) ? null : `${book.text("label.about-sender")}\n${profile}`,
  ].filter((section): section is string => section !== null)
  return [new SystemMessage(system), new HumanMessage([renderPrompt(stylePrompt, variables), ...appended].join("\n\n"))]
}

function cleanReply(raw: string): string {
  const text = raw.trim()
  const wrapped = text.match(WRAPPED_IN_QUOTES)
  // Strip quotes only when they wrap the whole reply, not when it merely starts or ends with a quotation
  return stripMarkdownMarks(wrapped && !/["“”]/.test(wrapped[2]) ? wrapped[2] : text).trim()
}

interface ReplyProblems {
  claim: string | null
  story: string | null
  figures: string[]
  length: number
  punctuation: string | null
}

// Short labels for the log line
function findProblemLabels({ claim, story, figures, length, punctuation }: ReplyProblems): string[] {
  return [
    claim && `claim "${claim}"`,
    story && `story "${story}"`,
    ...figures.map((figure) => `figure "${figure}"`),
    length > REPLY_TARGET_MAX_CHARS && `${length} chars`,
    punctuation && `punctuation "${punctuation.trim()}"`,
  ].filter((label): label is string => typeof label === "string")
}

// What is wrong with a draft, in the words of the tool's instructions prompt
function describeProblems({ claim, story, figures, length, punctuation }: ReplyProblems, book: PromptBook): string[] {
  return [
    story && book.text("problem.story", { story }),
    claim && book.text("problem.claim", { claim }),
    figures.length > 0 && book.text("problem.unsupported-figures", { figures: figures.join(", ") }),
    length > REPLY_TARGET_MAX_CHARS && book.text("problem.too-long", { length: length.toLocaleString(), max: REPLY_TARGET_MAX_CHARS }),
    punctuation && book.text("problem.punctuation", { punctuation: punctuation.trim() }),
  ].filter((problem): problem is string => typeof problem === "string")
}

function findUnusableReason(output: ReplyOutput): string | null {
  if (!output.target_found) return null
  const reply = cleanReply(output.reply)
  if (!reply) return "empty reply"
  if (reply.length > REPLY_MAX_CHARS) return `reply is ${reply.length} characters`
  return null
}

function problemRewrite(reply: string, problems: string[], book: PromptBook): HumanMessage {
  return new HumanMessage(book.text("rewrite", { problems: problems.join(" "), draft: wrapSection("draft_reply", reply) }))
}

function lengthWarning(length: number): string | null {
  return length > REPLY_TARGET_MAX_CHARS
    ? `This reply is ${length.toLocaleString()} characters, longer than the ${REPLY_TARGET_MAX_CHARS}-character target. Trim it before posting.`
    : null
}

/**
 * Writes one reply with the latest saved prompt for the exact context + style pair
 * (the module's provider order, Groq first). A post screenshot is read first. A draft that
 * claims first-person experience gets one controlled rewrite that keeps only claims the
 * sources support. The final reply is rewritten with the Humanization prompt. Throws a
 * user-facing error when the comments contain nothing to reply to.
 */
export async function generatePostCommentReply({ input, signal, onStage }: GenerateOptions): Promise<GeneratedReply> {
  // Every word besides the system, context, research and style prompts is read from the tool's instructions prompt
  const [stylePrompt, book] = await Promise.all([getActiveReplyPrompt(input.context, input.style), loadPromptBook("post-comment-reply-instructions")])
  const needsResearch = usesVariable(stylePrompt, VARIABLE.webResearch)
  let providers = currentModelOrder()

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
    targetComment: resolveTargetComment(input.comments),
  }

  if (needsResearch) onStage("ANALYZING")
  const [senderProfile, webResearch] = await Promise.all([
    loadSenderProfileSection(book),
    needsResearch ? researchConversation(conversation, stylePrompt, signal, book) : null,
  ])

  onStage("WRITING")
  const messages = await buildMessages(input, conversation, stylePrompt, senderProfile, webResearch, book)
  const write = (thread: BaseMessage[]) =>
    generateStructuredWithFallback({
      schema: replySchema(book),
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

  // Targeted rewrites for unsupported experience claims, made-up figures, a reply that's too long or stiff punctuation
  const sourceText = [conversation.postText ?? "", input.comments, senderProfile, stylePrompt].join("\n")
  const findProblems = (text: string): ReplyProblems => ({
    claim: text.match(EXPERIENCE_CLAIM)?.[0] ?? null,
    story: text.match(CLIENT_STORY)?.[0] ?? null,
    figures: findUnsupportedFigures(text, sourceText),
    length: text.length,
    punctuation: text.match(STIFF_PUNCTUATION)?.[0] ?? null,
  })
  const draftProblemState = findProblems(reply)
  let problems = describeProblems(draftProblemState, book)
  // A rewrite can bring in new made-up figures, so each one is checked again; the cleanest version wins
  for (let attempt = 0; attempt < MAX_REWRITES && problems.length > 0; attempt++) {
    const rewrite = await write([...messages, problemRewrite(reply, problems, book)]).catch((error: unknown) => {
      if (signal.aborted) throw error
      console.warn("⚠️ Post comment reply rewrite failed; keeping the current draft:", error)
      return null
    })
    if (!rewrite?.data.target_found) break
    const rewritten = cleanReply(rewrite.data.reply)
    const rewrittenProblems = describeProblems(findProblems(rewritten), book)
    if (rewrittenProblems.length > problems.length) continue
    reply = rewritten
    problems = rewrittenProblems
    replyingTo = rewrite.data.replying_to || replyingTo
    provider = rewrite.provider
  }

  onStage("HUMANIZING")
  const draftHasClaim = EXPERIENCE_CLAIM.test(reply)
  const draftHasStiffPunctuation = STIFF_PUNCTUATION.test(reply)
  const humanization = await humanizeTexts({
    fields: [
      {
        id: "reply",
        kind: book.text(`humanize.kind.${input.context}`),
        text: reply,
        // Stays within the target length, unless the draft couldn't be brought under it
        maxChars: Math.max(REPLY_TARGET_MAX_CHARS, reply.length),
        rule: book.text("humanize.rule"),
      },
    ],
    providers: providers.slice(providers.indexOf(provider)),
    signal,
    validate: (_id, text) => {
      if (!draftHasClaim && EXPERIENCE_CLAIM.test(text)) return book.text("humanize.problem.experience-claim")
      if (!draftHasStiffPunctuation && STIFF_PUNCTUATION.test(text)) return book.text("humanize.problem.punctuation")
      return null
    },
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
      target: conversation.targetComment?.author ?? (conversation.targetComment ? "unnamed" : "left to the writer"),
      webResearch: needsResearch,
      rewriteFor: findProblemLabels(draftProblemState),
      unresolved: problems.length,
    })
  )

  return {
    reply,
    context: input.context,
    style: input.style,
    replyingTo: replyingTo.trim() || conversation.targetComment?.author || null,
    characterCount: reply.length,
    maxCharacters: REPLY_TARGET_MAX_CHARS,
    warning: lengthWarning(reply.length),
    extractedPost,
  }
}
