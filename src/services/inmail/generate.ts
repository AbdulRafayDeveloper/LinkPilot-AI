import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { generateWithoutSenderClaims } from "@/services/senderGuard"
import { loadPromptBook, type PromptBook } from "@/services/promptBook"
import { humanizeTexts } from "@/services/humanizer"
import { cleanGeneratedText, containsPlaceholder } from "@/lib/generatedText"
import { INMAIL_BODY_MAX_CHARS, INMAIL_SUBJECT_MAX_CHARS } from "@/constants/linkedinLimits"
import { OPENING_LINES, getInMailTuneLabel, type InMailTuneId } from "@/constants/inmail"
import { hasOpeningLine, withOpeningLine } from "@/lib/openingLine"
import { ABCD_TUNE_ID, VOICE_NOTE_MAX_CHARS, VOICE_NOTE_MAX_WORDS, VOICE_TUNE_ID } from "@/constants/outreachTunes"
import { abcdProblem, hasAbcdOptions, withAbcdOptions } from "@/lib/abcdMethod"
import { countWords, speakingSeconds, voiceNoteProblem } from "@/lib/voiceNote"
import type { GeneratedInMail } from "@/types/inmail"
import { getInMailGenerationInputs } from "./prompts"

// Slightly creative so InMails read like a person wrote them
const WRITING_TEMPERATURE = 0.7
const SUBJECT_LABEL = /^\s*subject\s*:\s*/i

/**
 * Analysis first, then the subject, then the body: the model commits to the angle and
 * writes the subject deliberately before the message has to deliver on it.
 */
// What each field means is part of the tool's instructions prompt, so the schema is built from it
const inMailSchema = (book: PromptBook) =>
  z.object({
    recipient_summary: z.string().describe(book.text("field.recipient-summary")),
    key_detail: z.string().describe(book.text("field.key-detail")),
    sender_link: z.string().nullable().describe(book.text("field.sender-link")),
    subject_hook: z.string().describe(book.text("field.subject-hook")),
    subject: z.string().describe(book.text("field.subject")),
    message: z.string().describe(book.text("field.message")),
  })

type InMailOutput = z.infer<ReturnType<typeof inMailSchema>>

interface GenerateOptions {
  profileData: string
  tune: InMailTuneId
  signal: AbortSignal
}

function cleanSubject(raw: string): string {
  return cleanGeneratedText(cleanGeneratedText(raw).replace(SUBJECT_LABEL, "")).replace(/\s*\n+\s*/g, " ")
}

/**
 * Removes a subject line the model repeated at the top of the body, whether labelled
 * ("Subject: …") or copied verbatim.
 */
function cleanMessage(raw: string, subject: string): string {
  const lines = cleanGeneratedText(raw).split("\n")
  const firstLine = lines[0]?.trim() ?? ""
  const isRepeatedSubject =
    SUBJECT_LABEL.test(firstLine) || (subject !== "" && firstLine.toLowerCase() === subject.toLowerCase())
  return (isRepeatedSubject ? lines.slice(1) : lines).join("\n").trim()
}

function findUnusableReason(output: InMailOutput): string | null {
  const subject = cleanSubject(output.subject)
  const message = cleanMessage(output.message, subject)
  if (!subject) return "empty subject"
  if (!message) return "empty message"
  if (containsPlaceholder(subject) || containsPlaceholder(message)) return "InMail contains a placeholder"
  return null
}

function buildWarnings(subject: string, message: string, unsupportedSenderClaim: boolean, isVoice = false): string | null {
  const words = countWords(message)
  const warnings = [
    unsupportedSenderClaim && "This InMail may describe you, but About Me is empty. Check what it says about you before sending.",
    subject.length > INMAIL_SUBJECT_MAX_CHARS &&
      `The subject is ${subject.length} characters, over LinkedIn's ${INMAIL_SUBJECT_MAX_CHARS}-character limit.`,
    isVoice &&
      words > VOICE_NOTE_MAX_WORDS &&
      `This script is ${words} words, about ${speakingSeconds(words)} seconds. Cut it to ${VOICE_NOTE_MAX_WORDS} words or fewer before recording.`,
    !isVoice &&
      message.length > INMAIL_BODY_MAX_CHARS &&
      `The message is ${message.length.toLocaleString()} characters, over LinkedIn's ${INMAIL_BODY_MAX_CHARS.toLocaleString()}-character InMail limit.`,
  ].filter((warning): warning is string => typeof warning === "string")
  return warnings.length > 0 ? warnings.join(" ") : null
}

/**
 * Generates one InMail (subject and message as separate outputs) using the latest saved
 * prompt for the tune and the shared sender profile, then rewrites both with the
 * Humanization prompt. Profile text is untrusted data inside its own delimiter tags.
 */
export async function generateInMail({ profileData, tune, signal }: GenerateOptions): Promise<GeneratedInMail> {
  // Every word besides the system and tune prompts is read from the instructions prompts
  const [{ tunePrompt, senderProfile }, book, shared] = await Promise.all([
    getInMailGenerationInputs(tune),
    loadPromptBook("inmail-instructions"),
    loadPromptBook("shared-instructions"),
  ])

  const system = renderPrompt(await loadPrompt("inmail-system"), {
    SUBJECT_MAX_CHARS: INMAIL_SUBJECT_MAX_CHARS,
    BODY_MAX_CHARS: INMAIL_BODY_MAX_CHARS,
  })
  const user = await composePromptMessage(
    tunePrompt,
    [
      {
        variable: "sender_profile",
        tag: "sender_profile",
        label: book.text("label.about-me"),
        content: senderProfile,
        emptyText: shared.text("empty.sender-profile"),
      },
      { variable: "profile_data", tag: "profile_data", label: book.text("label.their-profile"), content: profileData, pasted: true },
    ],
    { tune: getInMailTuneLabel(tune) }
  )

  const { data, provider, senderClaimRewrite, unsupportedSenderClaim } = await generateWithoutSenderClaims({
    schema: inMailSchema(book),
    name: "inmail",
    messages: [new SystemMessage(system), new HumanMessage(user)],
    temperature: WRITING_TEMPERATURE,
    signal,
    validate: findUnusableReason,
    senderProfile,
    claimText: (output) => `${output.subject}\n${output.message}`,
    describeDraft: (output) => book.text("draft", { subject: cleanSubject(output.subject), message: cleanGeneratedText(output.message) }),
  })

  const draftSubject = cleanSubject(data.subject)
  // A tone with an opening line (OPENING_LINES) opens its message with that exact sentence: put right in
  // the draft, kept by the humanizer (a rewrite that changes it is sent back), and checked once more at the end
  const opener = OPENING_LINES[tune]
  // A voice note is said out loud, so it is held to its word ceiling rather than LinkedIn's characters
  const isVoice = tune === VOICE_TUNE_ID
  // The ABCD method's four replies are fixed in code, so they are put on the draft and checked again at the end
  const isAbcd = tune === ABCD_TUNE_ID
  const draftMessage = cleanMessage(data.message, draftSubject)
  const opened = opener ? withOpeningLine(draftMessage, opener) : { text: draftMessage, fixed: false }
  const draft = isAbcd ? withAbcdOptions(opened.text) : opened
  const humanization = await humanizeTexts({
    fields: [
      {
        id: "subject",
        kind: book.text("humanize.kind.subject"),
        text: draftSubject,
        maxChars: INMAIL_SUBJECT_MAX_CHARS,
        singleLine: true,
      },
      {
        id: "message",
        kind: book.text("humanize.kind.message"),
        text: draft.text,
        maxChars: isVoice ? VOICE_NOTE_MAX_CHARS : INMAIL_BODY_MAX_CHARS,
        ...(isVoice ? { rule: book.text("humanize.rule.voice", { max: VOICE_NOTE_MAX_WORDS }) } : {}),
      },
    ],
    // Each of these tones ends on one open question: the Curiosity Hook's open loop, or a soft offer of help
    validate:
      opener || isVoice || isAbcd
        ? (id, text) => {
            if (id !== "message") return null
            if (opener && !hasOpeningLine(text, opener)) return book.text("humanize.problem.opening", { sentence: opener.sentence })
            if (opener && !/\?\s*$/.test(text)) return book.text("humanize.problem.question")
            if (isAbcd) return abcdProblem(text, book)
            return isVoice ? voiceNoteProblem(text, book) : null
          }
        : undefined,
    signal,
  })
  const subject = cleanSubject(humanization.texts.subject)
  const cleaned = cleanMessage(humanization.texts.message, subject)
  const final = opener ? withOpeningLine(cleaned, opener) : { text: cleaned, fixed: false }
  // Whatever came back, the four replies are exactly the owner's own, on the end, once
  const ending = isAbcd ? withAbcdOptions(final.text) : final
  const message = ending.text

  // Serialized so the details also survive Next's dev file log, which drops object arguments
  console.info(
    "InMail generated:",
    JSON.stringify({
      tune,
      provider,
      usedSenderProfile: senderProfile !== null,
      senderClaimRewrite,
      unsupportedSenderClaim,
      humanized: humanization.humanized,
      ...(opener ? { openerFixed: draft.fixed || final.fixed, openerPresent: hasOpeningLine(message, opener) } : {}),
      subjectCharacters: subject.length,
      messageCharacters: message.length,
      ...(isVoice ? { words: countWords(message), speakingSeconds: speakingSeconds(countWords(message)) } : {}),
      ...(isAbcd ? { abcdFixed: draft.fixed || ending.fixed, abcdPresent: hasAbcdOptions(message) } : {}),
    })
  )

  return {
    subject,
    message,
    tune,
    subjectCharacters: subject.length,
    messageCharacters: message.length,
    subjectMaxCharacters: INMAIL_SUBJECT_MAX_CHARS,
    messageMaxCharacters: isVoice ? VOICE_NOTE_MAX_CHARS : INMAIL_BODY_MAX_CHARS,
    ...(isVoice ? { wordCount: countWords(message), speakingSeconds: speakingSeconds(countWords(message)) } : {}),
    warning: buildWarnings(subject, message, unsupportedSenderClaim, isVoice),
    usedSenderProfile: senderProfile !== null,
    analysis: {
      keyDetail: data.key_detail.trim(),
      senderLink: data.sender_link?.trim() || null,
    },
  }
}
