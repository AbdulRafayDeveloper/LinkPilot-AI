import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { NO_SENDER_PROFILE_TEXT, generateWithoutSenderClaims } from "@/services/senderGuard"
import { humanizeTexts } from "@/services/humanizer"
import { cleanGeneratedText, containsPlaceholder } from "@/lib/generatedText"
import { INMAIL_BODY_MAX_CHARS, INMAIL_SUBJECT_MAX_CHARS } from "@/constants/linkedinLimits"
import { getInMailTuneLabel, type InMailTuneId } from "@/constants/inmail"
import type { GeneratedInMail } from "@/types/inmail"
import { getInMailGenerationInputs } from "./prompts"

// Slightly creative so InMails read like a person wrote them
const WRITING_TEMPERATURE = 0.7
const SUBJECT_LABEL = /^\s*subject\s*:\s*/i

/**
 * Analysis first, then the subject, then the body: the model commits to the angle and
 * writes the subject deliberately before the message has to deliver on it.
 */
const InMailSchema = z.object({
  recipient_summary: z.string().describe("Who the recipient is and what they focus on now, from their profile only"),
  key_detail: z.string().describe("The single highest-signal profile detail the InMail builds on"),
  sender_link: z
    .string()
    .nullable()
    .describe(
      "The sender-recipient connection the InMail uses, taken from both profiles. Fill it whenever the InMail mentions the sender's work or a similarity; null only when it doesn't"
    ),
  subject_hook: z
    .string()
    .describe(
      "The concrete element the subject will name, taken from key_detail: e.g. a project or product name, a number, a post's topic or their company. Never a broad theme"
    ),
  subject: z
    .string()
    .describe(
      "The InMail subject line only. It includes subject_hook, uses sentence case and is written deliberately as a subject, not a shortened copy of the message"
    ),
  message: z.string().describe("The InMail body only, without the subject line"),
})

type InMailOutput = z.infer<typeof InMailSchema>

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

function buildWarnings(subject: string, message: string, unsupportedSenderClaim: boolean): string | null {
  const warnings = [
    unsupportedSenderClaim && "This InMail may describe you, but About Me is empty. Check what it says about you before sending.",
    subject.length > INMAIL_SUBJECT_MAX_CHARS &&
      `The subject is ${subject.length} characters, over LinkedIn's ${INMAIL_SUBJECT_MAX_CHARS}-character limit.`,
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
  const { tunePrompt, senderProfile } = await getInMailGenerationInputs(tune)

  const system = renderPrompt(loadPrompt("inmail-system"), {
    SUBJECT_MAX_CHARS: INMAIL_SUBJECT_MAX_CHARS,
    BODY_MAX_CHARS: INMAIL_BODY_MAX_CHARS,
  })
  const user = composePromptMessage(
    tunePrompt,
    [
      {
        variable: "sender_profile",
        tag: "sender_profile",
        label: "About me",
        content: senderProfile,
        emptyText: NO_SENDER_PROFILE_TEXT,
      },
      { variable: "profile_data", tag: "profile_data", label: "Their profile", content: profileData },
    ],
    { tune: getInMailTuneLabel(tune) }
  )

  const { data, provider, senderClaimRewrite, unsupportedSenderClaim } = await generateWithoutSenderClaims({
    schema: InMailSchema,
    name: "inmail",
    messages: [new SystemMessage(system), new HumanMessage(user)],
    temperature: WRITING_TEMPERATURE,
    signal,
    validate: findUnusableReason,
    senderProfile,
    claimText: (output) => `${output.subject}\n${output.message}`,
    describeDraft: (output) => `Subject: ${cleanSubject(output.subject)}\n\n${cleanGeneratedText(output.message)}`,
  })

  const draftSubject = cleanSubject(data.subject)
  const humanization = await humanizeTexts({
    fields: [
      {
        id: "subject",
        kind: "LinkedIn InMail subject line",
        text: draftSubject,
        maxChars: INMAIL_SUBJECT_MAX_CHARS,
        singleLine: true,
      },
      {
        id: "message",
        kind: "LinkedIn InMail message body (without the subject)",
        text: cleanMessage(data.message, draftSubject),
        maxChars: INMAIL_BODY_MAX_CHARS,
      },
    ],
    signal,
  })
  const subject = cleanSubject(humanization.texts.subject)
  const message = cleanMessage(humanization.texts.message, subject)

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
      subjectCharacters: subject.length,
      messageCharacters: message.length,
    })
  )

  return {
    subject,
    message,
    tune,
    subjectCharacters: subject.length,
    messageCharacters: message.length,
    subjectMaxCharacters: INMAIL_SUBJECT_MAX_CHARS,
    messageMaxCharacters: INMAIL_BODY_MAX_CHARS,
    warning: buildWarnings(subject, message, unsupportedSenderClaim),
    usedSenderProfile: senderProfile !== null,
    analysis: {
      keyDetail: data.key_detail.trim(),
      senderLink: data.sender_link?.trim() || null,
    },
  }
}
