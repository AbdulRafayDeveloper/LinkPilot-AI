import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { AI_PROVIDERS, generateStructuredWithFallback, type ModelProvider } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import type { ResearchResult } from "@/services/liveResearch"
import { findRelevantExperience, type UserExperience } from "@/services/senderContext"
import { extractPostFromImage } from "@/services/postImage"
import { humanizeTexts } from "@/services/humanizer"
import type { PostSource } from "@/lib/validation/postInput"
import {
  COMMENT_MAX_CHARS,
  COMMENT_WRITER_MESSAGES,
  getTuneLabel,
  promptUsesVariable,
  type CommentTuneId,
} from "@/constants/commentWriter"
import type { CommentReference, CommentStage, GeneratedComment } from "@/types/commentWriter"
import { getActiveTunePrompt } from "./prompts"
import { researchPostTopic } from "./context"
import { CommentDraftSchema } from "./schema"
import { cleanComment, findCitationProblem, findReference, findUnusableReason } from "./validate"
import { experienceBlock, postBlock, researchBlock } from "./blocks"

// Natural and varied rather than templated
const WRITING_TEMPERATURE = 0.7
// Gemini is the primary writer; OpenAI is only called when Gemini can't deliver
const PROVIDER_ORDER: readonly ModelProvider[] = AI_PROVIDERS
// Readable stand-ins for the variables when the tune prompt is used to steer web research
const RESEARCH_BRIEF_LABELS = {
  post_content: "[the LinkedIn post]",
  user_experience: "[the user's experience]",
  research_context: "[the research findings]",
}

interface GenerateOptions {
  tune: CommentTuneId
  post: PostSource
  signal: AbortSignal
  onStage: (stage: CommentStage, text: string) => void
}

function describeLookup(wantsResearch: boolean, wantsExperience: boolean): string {
  if (wantsResearch && wantsExperience) return "Checking recent information and your experience"
  return wantsResearch ? "Checking recent information" : "Checking your About Me profile for relevant experience"
}

interface MessageData {
  postText: string
  // undefined when the tune prompt didn't ask for that data
  research?: ResearchResult | null
  experience?: UserExperience
}

/**
 * The saved tune prompt is the user's instruction layer. Each variable places its data
 * section where the prompt wants it; the post is appended when the prompt doesn't place
 * it. Research and experience sections exist only when the prompt asked for them.
 */
function buildUserMessage(stylePrompt: string, tune: CommentTuneId, { postText, research, experience }: MessageData): string {
  return composePromptMessage(
    stylePrompt,
    [
      postBlock(postText),
      ...(experience ? [experienceBlock(experience)] : []),
      ...(research !== undefined ? [researchBlock(research)] : []),
    ],
    { selected_tune: getTuneLabel(tune) }
  )
}

function collectNotices(reference: CommentReference | null, experienceQuote: string, data: MessageData): string[] {
  const notices: string[] = []
  if (data.research !== undefined && !reference) notices.push(COMMENT_WRITER_MESSAGES.noRecentDevelopment)
  if (data.experience && !experienceQuote.trim()) {
    notices.push(data.experience.hasProfile ? COMMENT_WRITER_MESSAGES.noExperience : COMMENT_WRITER_MESSAGES.missingProfile)
  }
  return notices
}

/**
 * One end-to-end comment: latest saved tune prompt → post text (read from the screenshot
 * when needed) → web research and/or the About Me profile when the prompt asks for them
 * → one structured writing call (Gemini, OpenAI fallback) → output verification → the
 * Humanization prompt, whose rewrite must pass the same comment checks.
 */
export async function generateComment({ tune, post, signal, onStage }: GenerateOptions): Promise<GeneratedComment> {
  const now = new Date()
  const stylePrompt = await getActiveTunePrompt(tune)
  let providers = PROVIDER_ORDER
  let isFallbackAnnounced = false
  const announceModelFallback = () => {
    if (isFallbackAnnounced) return
    isFallbackAnnounced = true
    onStage("FALLBACK", "Primary model unavailable, switching to the backup model")
  }

  let postText = post.type === "text" ? post.text : ""
  let extractedPost: string | null = null
  if (post.type === "image") {
    onStage("READING_IMAGE", "Reading the post from your screenshot")
    const extraction = await extractPostFromImage({ image: post.image, providers, signal, onFallback: announceModelFallback })
    postText = extraction.postText
    extractedPost = extraction.postText
    // A provider that just failed isn't called again within the same request
    providers = providers.slice(providers.indexOf(extraction.provider))
  }

  const wantsResearch = promptUsesVariable(stylePrompt, "research_context")
  const wantsExperience = promptUsesVariable(stylePrompt, "user_experience")
  if (wantsResearch || wantsExperience) onStage("RESEARCHING", describeLookup(wantsResearch, wantsExperience))
  const [research, experience] = await Promise.all([
    wantsResearch
      ? researchPostTopic({
          postText,
          styleBrief: renderPrompt(stylePrompt, { ...RESEARCH_BRIEF_LABELS, selected_tune: getTuneLabel(tune) }),
          now,
          signal,
          onFallback: () => onStage("FALLBACK", "Primary search unavailable, switching to backup web search"),
        })
      : undefined,
    wantsExperience ? findRelevantExperience() : undefined,
  ])
  let messageData: MessageData = { postText, research, experience }

  onStage("WRITING", "Analyzing the post and writing your comment")
  const systemPrompt = renderPrompt(loadPrompt("comment-writer-system"), {
    CURRENT_DATE: now.toISOString().slice(0, 10),
    MAX_CHARS: COMMENT_MAX_CHARS,
  })
  const write = (data: MessageData, writers: readonly ModelProvider[], requireNoCitation: boolean) =>
    generateStructuredWithFallback({
      schema: CommentDraftSchema,
      name: "linkedin_comment",
      messages: [new SystemMessage(systemPrompt), new HumanMessage(buildUserMessage(stylePrompt, tune, data))],
      temperature: WRITING_TEMPERATURE,
      providers: writers,
      signal,
      onFallback: announceModelFallback,
      validate: (draft) =>
        // Claimed experience must be backed by profile-anchored text; without a profile nothing qualifies
        findUnusableReason(draft, { postText, systemPrompt, experience: experience?.text ?? null }) ??
        (requireNoCitation && draft.reference_url.trim() ? "cites a source without verified research" : null),
    })

  let written = await write(messageData, providers, false)
  const citationProblem = findCitationProblem(written.data, research ?? null, now)
  if (citationProblem) {
    // The comment text relies on a claim that can't be verified as recent, so it is
    // rewritten without the research instead of being shown with an unverified claim
    console.warn("⚠️ Comment Writer citation rejected, rewriting without research:", citationProblem)
    onStage("WRITING", "Couldn't verify a recent development, rewriting without it")
    messageData = { ...messageData, research: research === undefined ? undefined : null }
    written = await write(messageData, providers.slice(providers.indexOf(written.provider)), true)
  }

  const { data, provider } = written
  const reference = findReference(data, messageData.research ?? null)

  onStage("HUMANIZING", "Making the comment sound natural")
  const humanization = await humanizeTexts({
    fields: [
      {
        id: "comment",
        kind: "LinkedIn comment under someone else's post",
        text: cleanComment(data.comment),
        maxChars: COMMENT_MAX_CHARS,
      },
    ],
    providers: providers.slice(providers.indexOf(provider)),
    signal,
    onFallback: announceModelFallback,
    validate: (_id, text) =>
      findUnusableReason({ ...data, comment: text }, { postText, systemPrompt, experience: experience?.text ?? null }),
  })
  const comment = cleanComment(humanization.texts.comment)

  // Serialized so the details also survive Next's dev file log, which drops object arguments
  console.info(
    "Comment Writer generated:",
    JSON.stringify({
      tune,
      provider,
      humanized: humanization.humanized,
      input: post.type,
      characters: comment.length,
      researchSources: research === undefined ? "off" : (research?.sources.length ?? 0),
      experience: experience === undefined ? "off" : experience.hasProfile ? "profile" : "no profile",
      usedExperience: Boolean(data.experience_quote.trim()),
      cited: reference !== null,
    })
  )

  return {
    comment,
    tune,
    characterCount: comment.length,
    maxCharacters: COMMENT_MAX_CHARS,
    provider,
    reference,
    notices: collectNotices(reference, data.experience_quote, messageData),
    extractedPost,
  }
}
