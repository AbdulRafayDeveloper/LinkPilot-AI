import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage, type PromptDataBlock } from "@/services/promptComposer"
import { getFullSenderProfile } from "@/services/senderProfile"
import { findUnsupportedFigures } from "@/lib/figures"
import { dayLabel, formatTime } from "@/lib/meetingDates"
import type { MeetingPlanDetail, MeetingPrep } from "@/types/meetingPlanner"
import { getActivePreparationPrompt } from "./prompts"

/**
 * Writes the preparation for one meeting: who the person appears to be, what is worth talking
 * about, and a conversation to follow on the call. It reads only what the user supplied about
 * the lead and what the user has saved about themselves (About Me plus Rafay Profile Info, the
 * same source every writing tool uses), so it can never invent a background for either side.
 */
// Preparation is advice, not copy: enough freedom to sound human, little enough to stay grounded
const PREP_TEMPERATURE = 0.4
// A read of a person plus a nine-stage plan is a long answer, so it gets longer than the 45
// seconds a single call is otherwise given
const PREP_TIMEOUT_MS = 120_000

const EvidenceSchema = z
  .enum(["stated", "inferred"])
  .describe('"stated" when the supplied information says it outright, "inferred" when it only follows from it')

const ObservationSchema = z.object({
  point: z.string().describe("One specific observation about the person, in one sentence"),
  evidence: EvidenceSchema,
})

const PrepSchema = z.object({
  lead_analysis: z.object({
    who_they_are: z.string().describe("Who this person is, from the supplied information only. Say plainly what is unknown"),
    background: z.string().describe("Their professional background as the supplied information gives it"),
    interests: z.array(ObservationSchema).describe("What they pay attention to professionally"),
    needs_and_opportunities: z
      .array(ObservationSchema)
      .describe("Problems, goals or gaps this meeting could help with, each tied to something supplied"),
    how_you_can_help: z
      .array(z.string())
      .describe("Where the user's own stated skills and past work meet those needs. Never claim work the user's profile does not state"),
    before_you_join: z.array(z.string()).describe("What the user should keep in mind walking into this meeting"),
    open_questions: z
      .array(z.string())
      .describe("What is genuinely unknown about this person or their situation, to ask instead of assuming"),
  }),
  discussion_topics: z
    .array(
      z.object({
        topic: z.string().describe("A topic worth spending time on in this meeting"),
        why_it_matters: z.string().describe("Why it matters to this person, from the supplied information"),
        evidence: EvidenceSchema,
      })
    )
    .min(2)
    .describe("The topics this particular meeting should cover, most relevant first"),
  conversation_plan: z
    .array(
      z.object({
        stage: z.string().describe("The stage name, e.g. Opening and rapport"),
        goal: z.string().describe("What this stage is for, in one line"),
        what_to_say: z
          .string()
          .describe("How to handle this stage in the user's own voice: what to raise and how, not a word-for-word script"),
        questions: z.array(z.string()).describe("Questions to ask here, in plain spoken English"),
        transition: z.string().describe("How to move to the next stage naturally"),
      })
    )
    .min(5)
    .describe("The meeting from hello to goodbye, in the order it happens"),
  deal_path: z.object({
    signals_to_listen_for: z
      .array(z.string())
      .describe("What in their answers would show there is a real project here, and what would show there isn't"),
    how_to_raise_scope: z.string().describe("How to move to scope, budget or timing only once the fit is clear"),
    natural_next_step: z.string().describe("The next step to suggest at the end, sized to how the meeting went"),
  }),
  cautions: z
    .array(z.string())
    .describe("Things the user must not claim or assume in this meeting because no source supports them"),
})

type PrepOutput = z.infer<typeof PrepSchema>

/** Everything the model wrote, as one text, for the checks below. */
function prepText(prep: PrepOutput): string {
  const { lead_analysis: lead, discussion_topics: topics, conversation_plan: plan, deal_path: deal } = prep
  return [
    lead.who_they_are,
    lead.background,
    ...lead.interests.map((entry) => entry.point),
    ...lead.needs_and_opportunities.map((entry) => entry.point),
    ...lead.how_you_can_help,
    ...lead.before_you_join,
    ...lead.open_questions,
    ...topics.flatMap((topic) => [topic.topic, topic.why_it_matters]),
    ...plan.flatMap((stage) => [stage.goal, stage.what_to_say, stage.transition, ...stage.questions]),
    ...deal.signals_to_listen_for,
    deal.how_to_raise_scope,
    deal.natural_next_step,
    ...prep.cautions,
  ].join("\n")
}

function findUnusableReason(output: PrepOutput): string | null {
  if (!output.lead_analysis.who_they_are.trim()) return "no read of the person"
  if (output.conversation_plan.some((stage) => !stage.stage.trim() || !stage.what_to_say.trim())) {
    return "a stage of the plan is empty"
  }
  return null
}

/**
 * Writes the preparation for a meeting. The lead's information and the user's own profile are
 * untrusted data inside their own delimiter tags, so anything written inside them is treated as
 * information about the meeting and never as instructions. A figure the sources don't contain is
 * an invented result, so the model is asked once to write it again without it.
 */
export async function prepareMeeting(meeting: MeetingPlanDetail, signal: AbortSignal): Promise<MeetingPrep> {
  const [template, senderProfile] = await Promise.all([getActivePreparationPrompt(), getFullSenderProfile()])
  const system = renderPrompt(await loadPrompt("meeting-prep-system"), {
    CURRENT_DATE: new Date().toISOString().slice(0, 10),
  })

  const blocks: PromptDataBlock[] = [
    {
      variable: "profile_info",
      tag: "lead_profile",
      label: "Profile information about the person",
      content: meeting.profileInfo,
    },
    {
      variable: "conversation_history",
      tag: "conversation_history",
      label: "The conversation with them so far",
      content: meeting.conversationHistory,
    },
    {
      variable: "additional_info",
      tag: "meeting_notes",
      label: "Anything else that matters for this meeting",
      content: meeting.additionalInfo,
    },
    {
      variable: "sender_profile",
      tag: "sender_profile",
      label: "About me, the person taking this meeting",
      content: senderProfile,
      emptyText:
        "Not provided. You know nothing about the user's background, services or results. Do not put any claim about their work, experience or past results into the plan; keep the meeting on the other person and on questions.",
    },
  ]
  const user = composePromptMessage(template, blocks, {
    meeting_name: meeting.name,
    meeting_when: `${dayLabel(meeting.meetingDate)} at ${formatTime(meeting.meetingTime)}`,
    person_name: meeting.personName ?? "not given",
  })

  const messages = [new SystemMessage(system), new HumanMessage(user)]
  const generation = {
    schema: PrepSchema,
    name: "meeting_preparation",
    temperature: PREP_TEMPERATURE,
    timeoutMs: PREP_TIMEOUT_MS,
    signal,
    validate: findUnusableReason,
  }
  const sourceText = [meeting.profileInfo, meeting.conversationHistory, meeting.additionalInfo, senderProfile]
    .filter(Boolean)
    .join("\n")

  const first = await generateStructuredWithFallback({ ...generation, messages })
  let prep = first.data
  let invented = findUnsupportedFigures(prepText(prep), sourceText)

  if (invented.length > 0) {
    const rewrite = await generateStructuredWithFallback({
      ...generation,
      messages: [
        ...messages,
        new HumanMessage(
          `Your preparation states figures that neither the information about them nor my own profile contains: ${invented.join(
            ", "
          )}. Those are invented. Write it again without them, keeping everything else, and never put a number in my mouth that my profile does not state.`
        ),
      ],
    }).catch((error: unknown) => {
      if (signal.aborted) throw error
      console.warn("⚠️ Meeting preparation rewrite failed; keeping the first draft:", error)
      return null
    })
    if (rewrite) {
      prep = rewrite.data
      invented = findUnsupportedFigures(prepText(prep), sourceText)
    }
  }

  console.info(
    "Meeting preparation written:",
    JSON.stringify({
      provider: first.provider,
      usedProfile: senderProfile !== null,
      hasLeadProfile: Boolean(meeting.profileInfo),
      hasConversation: Boolean(meeting.conversationHistory),
      stages: prep.conversation_plan.length,
      topics: prep.discussion_topics.length,
      unsupportedFigures: invented,
    })
  )
  return prep
}
