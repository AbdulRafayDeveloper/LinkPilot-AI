import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { NO_SENDER_PROFILE_TEXT, generateWithoutSenderClaims } from "@/services/senderGuard"
import { humanizeTexts } from "@/services/humanizer"
import { cleanGeneratedText, containsPlaceholder } from "@/lib/generatedText"
import { LINKEDIN_MESSAGE_MAX_CHARS, OPENING_LINES, getTuneLabel, type FirstMessageTuneId } from "@/constants/firstMessage"
import { hasOpeningLine, withOpeningLine } from "@/lib/openingLine"
import type { GeneratedFirstMessage } from "@/types/firstMessage"
import { getGenerationInputs } from "./prompts"

// Slightly creative so messages read like a person wrote them
const WRITING_TEMPERATURE = 0.7
/**
 * The analysis fields come before the message on purpose: the model commits to the
 * profile detail and the sender link it will use before it writes.
 */
const FirstMessageSchema = z.object({
  recipient_summary: z.string().describe("Who the recipient is and what they focus on now, from their profile only"),
  key_detail: z.string().describe("The single highest-signal profile detail the message builds on"),
  sender_link: z
    .string()
    .nullable()
    .describe(
      "The sender-recipient connection the message uses (e.g. the sender's relevant service or a shared focus), taken from both profiles. Fill it whenever the message mentions the sender's work or a similarity; null only when the message doesn't"
    ),
  message: z.string().describe("The complete first message text, nothing else"),
})

type FirstMessageOutput = z.infer<typeof FirstMessageSchema>

interface GenerateOptions {
  profileData: string
  tune: FirstMessageTuneId
  signal: AbortSignal
}

function findUnusableReason(output: FirstMessageOutput): string | null {
  const message = cleanGeneratedText(output.message)
  if (!message) return "empty message"
  if (containsPlaceholder(message)) return "message contains a placeholder"
  return null
}

/**
 * Generates one first message using the latest saved prompt for the tune and the
 * shared sender profile, then rewrites it with the Humanization prompt. Profile text is
 * untrusted data inside its own delimiter tags.
 */
export async function generateFirstMessage({ profileData, tune, signal }: GenerateOptions): Promise<GeneratedFirstMessage> {
  const { tunePrompt, senderProfile } = await getGenerationInputs(tune)

  const system = renderPrompt(await loadPrompt("first-message-system"), { MAX_CHARS: LINKEDIN_MESSAGE_MAX_CHARS })
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
    { tune: getTuneLabel(tune) }
  )

  const { data, provider, senderClaimRewrite, unsupportedSenderClaim } = await generateWithoutSenderClaims({
    schema: FirstMessageSchema,
    name: "first_message",
    messages: [new SystemMessage(system), new HumanMessage(user)],
    temperature: WRITING_TEMPERATURE,
    signal,
    validate: findUnusableReason,
    senderProfile,
    claimText: (output) => output.message,
    describeDraft: (output) => cleanGeneratedText(output.message),
  })
  // A tone with an opening line (OPENING_LINES) opens with its exact sentence: put right in the draft,
  // kept by the humanizer (a rewrite that changes it is sent back), and checked once more at the end
  const opener = OPENING_LINES[tune]
  const draft = opener ? withOpeningLine(cleanGeneratedText(data.message), opener) : { text: cleanGeneratedText(data.message), fixed: false }
  const humanization = await humanizeTexts({
    fields: [
      {
        id: "message",
        kind: "LinkedIn first message (DM) to someone new",
        text: draft.text,
        maxChars: LINKEDIN_MESSAGE_MAX_CHARS,
      },
    ],
    // Each of these tones ends on one open question: the Curiosity Hook's open loop, or a soft offer of help
    validate: opener
      ? (_id, text) => {
          if (!hasOpeningLine(text, opener)) return `Keep the opening exactly "Hi <first name>, ${opener.sentence}"`
          if (!/\?\s*$/.test(text)) return "End the message with one open question, ending with a question mark"
          return null
        }
      : undefined,
    signal,
  })
  const final = opener ? withOpeningLine(humanization.texts.message, opener) : { text: humanization.texts.message, fixed: false }
  const message = final.text

  const warnings = [
    unsupportedSenderClaim &&
      "This message may describe you, but About Me is empty. Check what it says about you before sending.",
    message.length > LINKEDIN_MESSAGE_MAX_CHARS &&
      `This message is ${message.length.toLocaleString()} characters, over LinkedIn's ${LINKEDIN_MESSAGE_MAX_CHARS.toLocaleString()}-character limit. Shorten it before sending.`,
  ].filter((warning): warning is string => typeof warning === "string")

  // Serialized so the details also survive Next's dev file log, which drops object arguments
  console.info(
    "First message generated:",
    JSON.stringify({
      tune,
      provider,
      usedSenderProfile: senderProfile !== null,
      senderClaimRewrite,
      unsupportedSenderClaim,
      humanized: humanization.humanized,
      ...(opener ? { openerFixed: draft.fixed || final.fixed, openerPresent: hasOpeningLine(message, opener) } : {}),
      characters: message.length,
    })
  )

  return {
    message,
    tune,
    characterCount: message.length,
    maxCharacters: LINKEDIN_MESSAGE_MAX_CHARS,
    warning: warnings.length > 0 ? warnings.join(" ") : null,
    usedSenderProfile: senderProfile !== null,
    analysis: {
      keyDetail: data.key_detail.trim(),
      senderLink: data.sender_link?.trim() || null,
    },
  }
}
