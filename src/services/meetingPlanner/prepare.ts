import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage, type PromptDataBlock } from "@/services/promptComposer"
import { getFullSenderProfile } from "@/services/senderProfile"
import { findUnsupportedFigures } from "@/lib/figures"
import { dayLabel, formatTime } from "@/lib/meetingDates"
import { scriptId } from "@/lib/meetingScript"
import { MAX_PROJECTS_TO_SHOW, SCRIPT_MAX_MINUTES, SCRIPT_STEP_KIND_IDS } from "@/constants/meetingPlanner"
import type { MeetingPlanDetail, MeetingPrep, ProjectToShow, ScriptStage } from "@/types/meetingPlanner"
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
  // Decided first, because everything after it depends on why the meeting exists
  meeting_context: z.object({
    situation: z
      .enum(["they_asked_for_a_project", "you_reached_out", "unclear"])
      .describe(
        '"they_asked_for_a_project" when the conversation shows they came to me with a specific project or need, "you_reached_out" when I started the conversation to offer working together and they have not named a project, "unclear" when the supplied information does not show which'
      ),
    what_it_is_about: z
      .string()
      .describe("One or two sentences: the specific project they brought, in their words, or the collaboration I proposed and what they have said back"),
  }),
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
    .describe(
      "The topics this particular meeting should cover, most relevant first: the details of their project when they brought one, or where my work fits their business when I reached out"
    ),
  projects_to_show: z
    .array(
      z.object({
        project: z.string().describe("One of my own projects or products, named exactly as my profile names it"),
        why_it_will_land: z.string().describe("Why this person in particular will care about it, tied to their project, need or interest"),
      })
    )
    .describe("2 to 4 of my own projects to have open and show them, most convincing first. Only work my profile states; empty when my profile has none"),
  your_intro: z
    .string()
    .describe(
      "My introduction, said near the start, in first person: who I am and what I build, in my profile's words, shaped to what this person cares about. 3 to 5 spoken sentences"
    ),
  conversation: z
    .array(
      z.object({
        title: z.string().describe("The stage name, e.g. Opening and rapport"),
        goal: z.string().describe("What this stage is for, in one line"),
        steps: z
          .array(
            z.object({
              kind: z
                .enum(SCRIPT_STEP_KIND_IDS)
                .describe(
                  '"say": words I say aloud, statements only. "ask": exactly one question I ask. "listen": I stop talking and let them speak; the text says what to listen for. "show_project": I open one of my projects and show it. "note": a short reminder for me, not said aloud'
                ),
              text: z
                .string()
                .describe(
                  "say: the exact first-person words, 1 to 4 sentences. ask: the one question. listen: what to listen for and how to react. show_project: the words I say while showing it. note: the reminder"
                ),
              project: z.string().describe("show_project only: the project, named exactly as in projects_to_show; empty for every other kind"),
              minutes: z.number().int().describe("show_project only: roughly how many minutes to spend showing it, 2 to 10; 0 for every other kind"),
              features: z
                .array(z.string())
                .describe("show_project only: 2 to 5 features or screens of that project to show, the ones this person will care about most; empty for every other kind"),
            })
          )
          .min(2)
          .describe("What happens in this stage, in order: usually say, then ask and listen in turn, and a closing say that leads into the next stage"),
        move_on_when: z.string().describe("What I need to have heard or agreed before this stage is done, in one line"),
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
  const { lead_analysis: lead, discussion_topics: topics, conversation: stages, deal_path: deal } = prep
  return [
    prep.meeting_context.what_it_is_about,
    prep.your_intro,
    ...prep.projects_to_show.flatMap((entry) => [entry.project, entry.why_it_will_land]),
    lead.who_they_are,
    lead.background,
    ...lead.interests.map((entry) => entry.point),
    ...lead.needs_and_opportunities.map((entry) => entry.point),
    ...lead.how_you_can_help,
    ...lead.before_you_join,
    ...lead.open_questions,
    ...topics.flatMap((topic) => [topic.topic, topic.why_it_matters]),
    // A step's minutes are a number field, never text, so a suggested time is not taken for a claimed figure
    ...stages.flatMap((stage) => [stage.goal, stage.move_on_when, ...stage.steps.flatMap((step) => [step.text, ...step.features])]),
    ...deal.signals_to_listen_for,
    deal.how_to_raise_scope,
    deal.natural_next_step,
    ...prep.cautions,
  ].join("\n")
}

// "I specialize in healthcare", "particularly for logistics": the user's work reshaped to mirror the lead
const MIRRORED_SPECIALTY =
  /\b(?:speciali[sz](?:e|es|ed|ing)|focus(?:ed|ing)?|particularly)\b[^.!?]*?(?:\b(?:in|on|for)\s+(?:the\s+)?([a-z]+)\s+(?:sector|industry|space|domain)\b|\bindustries\s+(?:like|such\s+as)\s+([a-z]+))/gi

/**
 * What makes a script hard to follow on a call or puts words in the user's mouth: a question
 * hidden inside words to say, a stage with nothing to ask, questions with no moment to listen, a
 * stage that doesn't lead into the next, a project to show that isn't one of the user's, and an
 * industry specialty the user's own profile never names. Each is described so a rewrite can fix it.
 */
// Words too common to say anything about what a project does
const COMMON_WORDS = new Set("the and for with your you our their from that this into can will user users based show feature features platform".split(" "))
// How much of the profile after a project's name describes that project
const PROJECT_WINDOW_CHARS = 450

/** The words of a text by their first five letters, so "notify" and "notifications" count as one. */
const wordStems = (text: string) =>
  new Set(
    (text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((word) => !COMMON_WORDS.has(word)).map((word) => word.slice(0, 5))
  )

/** What the profile says right after each mention of a project, which is where it describes it. */
function projectDescription(project: string, profile: string): string {
  const name = project.trim().toLowerCase()
  if (!name) return ""
  const lower = profile.toLowerCase()
  const parts: string[] = []
  for (let index = lower.indexOf(name); index !== -1; index = lower.indexOf(name, index + name.length)) {
    const lines = profile.slice(index + name.length, index + name.length + PROJECT_WINDOW_CHARS).split("\n")
    const kept: string[] = []
    let sawBullet = false
    let sawText = false
    // The description ends where the next entry starts: a plain line after its bullets, or a blank line after plain text
    for (const line of lines) {
      const trimmed = line.trim()
      const isBullet = /^[*•-]\s/.test(trimmed)
      if (!trimmed) {
        if (sawText && !sawBullet && kept.length > 1 && !kept[kept.length - 1].trim().endsWith(":")) break
      } else if (isBullet) {
        sawBullet = true
      } else if (sawBullet) {
        break
      } else {
        sawText = true
      }
      kept.push(line)
    }
    parts.push(kept.join("\n"))
  }
  return parts.join("\n")
}

/**
 * The features a show_project step lists that the profile never describes for that project: a
 * feature sharing no word with what the profile says about it ("SMS reminders" or "automated
 * notifications" for a booking platform the profile describes as an AI pricing engine, an
 * itinerary planner and Stripe checkout).
 */
function unsupportedFeatures(project: string, features: string[], profile: string): string[] {
  const nameStems = wordStems(project)
  const described = new Set([...wordStems(projectDescription(project, profile))].filter((stem) => !nameStems.has(stem)))
  return features.filter((feature) => ![...wordStems(feature)].some((stem) => described.has(stem)))
}

/** The last resort for invented features that survived a rewrite: they are left off the list. */
function dropUnsupportedFeatures(prep: PrepOutput, profile: string): PrepOutput {
  const conversation = prep.conversation.map((stage) => ({
    ...stage,
    steps: stage.steps.map((step) => {
      if (step.kind !== "show_project") return step
      const unsupported = new Set(unsupportedFeatures(step.project, step.features, profile))
      return { ...step, features: step.features.filter((feature) => !unsupported.has(feature)) }
    }),
  }))
  return { ...prep, conversation }
}

function findPlanProblems(prep: PrepOutput, senderProfile: string | null, chosen: ProjectToShow[]): string[] {
  const problems: string[] = []
  const shown = new Set(
    prep.conversation.flatMap((stage) => stage.steps.filter((step) => step.kind === "show_project").map((step) => step.project.trim().toLowerCase()))
  )
  const notShown = chosen.filter((entry) => !shown.has(entry.project.trim().toLowerCase())).map((entry) => entry.project.trim())
  if (notShown.length > 0) {
    problems.push(`the conversation never shows the projects I chose (${notShown.join(", ")}); give each a show_project step where it fits best, named exactly that way`)
  }
  const profile = (senderProfile ?? "").toLowerCase()
  const stages = prep.conversation
  stages.forEach((stage, index) => {
    const isLast = index === stages.length - 1
    const kinds = stage.steps.map((step) => step.kind)
    if (stage.steps.some((step) => step.kind === "say" && step.text.includes("?"))) {
      problems.push(`stage "${stage.title}" has a question inside a say step; make each question its own ask step`)
    }
    if (!isLast && !kinds.includes("ask")) {
      problems.push(`stage "${stage.title}" has no ask step; give it 1 to 3`)
    }
    if (kinds.includes("ask") && !kinds.includes("listen")) {
      problems.push(`stage "${stage.title}" asks questions but has no listen step saying when to stop and hear them out`)
    }
    if (!isLast && kinds[kinds.length - 1] !== "say") {
      problems.push(`stage "${stage.title}" doesn't end with a say step that leads into the next stage`)
    }
    for (const step of stage.steps.filter((entry) => entry.kind === "show_project")) {
      if (!step.project.trim() || !profile.includes(step.project.trim().toLowerCase())) {
        problems.push(`stage "${stage.title}" shows "${step.project}", which is not a project named in my profile`)
      }
      const invented = unsupportedFeatures(step.project, step.features, senderProfile ?? "")
      if (invented.length > 0) {
        problems.push(
          `the features listed for "${step.project}" (${invented.join(", ")}) are not what my profile describes for that project; list only features my profile gives it, and describe it in the text only by those`
        )
      }
      if (step.features.length === 0) {
        problems.push(`the show_project step for "${step.project}" in stage "${stage.title}" names no features to show`)
      }
    }
  })
  if (prep.projects_to_show.length > 0 && !stages.some((stage) => stage.steps.some((step) => step.kind === "show_project"))) {
    problems.push("the conversation never has a show_project step; add one where showing my most relevant project fits best")
  }
  const spoken = [prep.your_intro, ...stages.flatMap((stage) => stage.steps.filter((step) => step.kind === "say").map((step) => step.text))].join("\n")
  for (const match of spoken.matchAll(MIRRORED_SPECIALTY)) {
    const field = (match[1] ?? match[2]).toLowerCase()
    if (!profile.includes(field)) {
      problems.push(`"${match[0]}" claims a specialty my profile never names; connect a real project of mine instead`)
    }
  }
  return problems
}

/**
 * The last resort for a question the model left inside words to say even after its rewrite: each
 * such question becomes its own ask step right after, so Say is only ever said and the question is
 * still asked. A step that is nothing but questions keeps its words as they were.
 */
function moveQuestionsOutOfSpeech(prep: PrepOutput): PrepOutput {
  const conversation = prep.conversation.map((stage) => ({
    ...stage,
    steps: stage.steps.flatMap((step) => {
      if (step.kind !== "say") return [step]
      const sentences = step.text.match(/[^.!?]+[.!?]*/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? []
      const asked = sentences.filter((sentence) => sentence.endsWith("?"))
      const said = sentences.filter((sentence) => !sentence.endsWith("?"))
      if (asked.length === 0 || said.length === 0) return [step]
      return [{ ...step, text: said.join(" ") }, ...asked.map((question) => ({ kind: "ask" as const, text: question, project: "", minutes: 0, features: [] }))]
    }),
  }))
  return { ...prep, conversation }
}

function findUnusableReason(output: PrepOutput): string | null {
  if (!output.lead_analysis.who_they_are.trim()) return "no read of the person"
  if (!output.your_intro.trim()) return "no introduction"
  if (output.conversation.some((stage) => !stage.title.trim() || stage.steps.every((step) => !step.text.trim()))) {
    return "a stage of the conversation is empty"
  }
  return null
}

/**
 * The projects to show on the new preparation: the ones the user chose first, in their order and
 * with their links and notes (the model's reason fills in a missing note), then the model's other
 * suggestions. Nothing the user added is ever lost to a new preparation.
 */
function mergeProjects(written: PrepOutput["projects_to_show"], chosen: ProjectToShow[]): ProjectToShow[] {
  const key = (name: string) => name.trim().toLowerCase()
  const writtenByName = new Map(written.map((entry) => [key(entry.project), entry]))
  const kept = chosen.map((entry) => ({
    id: entry.id ?? scriptId(),
    project: entry.project.trim(),
    why_it_will_land: entry.why_it_will_land.trim() || writtenByName.get(key(entry.project))?.why_it_will_land.trim() || "",
    link: entry.link ?? "",
    added_by_user: true,
  }))
  const chosenNames = new Set(chosen.map((entry) => key(entry.project)))
  const suggested = written
    .filter((entry) => entry.project.trim() && !chosenNames.has(key(entry.project)))
    .map((entry) => ({
      id: scriptId(),
      project: entry.project.trim(),
      why_it_will_land: entry.why_it_will_land.trim(),
      link: "",
      added_by_user: false,
    }))
  return [...kept, ...suggested].slice(0, MAX_PROJECTS_TO_SHOW)
}

/** The model's script with an id on every stage and step, and nothing a step's kind doesn't use. */
function toScript(output: PrepOutput["conversation"]): ScriptStage[] {
  return output.map((stage) => ({
    id: scriptId(),
    title: stage.title.trim(),
    goal: stage.goal.trim(),
    move_on_when: stage.move_on_when.trim(),
    steps: stage.steps
      .filter((step) => step.text.trim() || step.kind === "show_project")
      .map((step) => {
        const isShow = step.kind === "show_project"
        return {
          id: scriptId(),
          kind: step.kind,
          text: step.text.trim(),
          project: isShow ? step.project.trim() : "",
          minutes: isShow ? Math.min(SCRIPT_MAX_MINUTES, Math.max(1, Math.round(step.minutes) || 5)) : 0,
          features: isShow ? step.features.map((feature) => feature.trim()).filter(Boolean) : [],
        }
      }),
  }))
}

/**
 * Writes the preparation for a meeting. The lead's information and the user's own profile are
 * untrusted data inside their own delimiter tags, so anything written inside them is treated as
 * information about the meeting and never as instructions. A figure the sources don't contain is
 * an invented result, so the model is asked once to write it again without it.
 */
export async function prepareMeeting(meeting: MeetingPlanDetail, signal: AbortSignal): Promise<MeetingPrep> {
  const [template, senderProfile] = await Promise.all([getActivePreparationPrompt(), getFullSenderProfile()])
  // The projects the user added or edited on the earlier preparation are theirs to show: the model
  // is told about them, and what the user wrote about each counts as their own words
  const chosen = (meeting.prep?.projects_to_show ?? []).filter((entry) => entry.added_by_user && entry.project.trim())
  const chosenList = chosen
    .map((entry) => `- ${entry.project.trim()}${entry.why_it_will_land.trim() ? `: ${entry.why_it_will_land.trim()}` : ""}`)
    .join("\n")
  const chosenFacts = chosen.map((entry) => `${entry.project.trim()}:\n${entry.why_it_will_land.trim()}`).join("\n\n")
  const userFacts = [senderProfile, chosenFacts].filter(Boolean).join("\n\n") || null
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
    {
      variable: "chosen_projects",
      tag: "projects_i_chose",
      label: "Projects I have already chosen to show in this meeting, in order",
      content: chosenList || null,
      emptyText: "None chosen yet. Choose them from my profile.",
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
  const sourceText = [meeting.profileInfo, meeting.conversationHistory, meeting.additionalInfo, senderProfile, chosenFacts]
    .filter(Boolean)
    .join("\n")

  const first = await generateStructuredWithFallback({ ...generation, messages })
  let prep = first.data
  let invented = findUnsupportedFigures(prepText(prep), sourceText)
  let problems = findPlanProblems(prep, userFacts, chosen)

  if (invented.length > 0 || problems.length > 0) {
    const fixes = [
      ...(invented.length > 0
        ? [
            `It states figures that neither the information about them nor my own profile contains: ${invented.join(
              ", "
            )}. Those are invented; never put a number in my mouth that my profile does not state.`,
          ]
        : []),
      ...problems,
    ]
    const rewrite = await generateStructuredWithFallback({
      ...generation,
      messages: [
        ...messages,
        new HumanMessage(
          `Write the preparation again, keeping everything else, and fix exactly these problems:\n- ${fixes.join("\n- ")}`
        ),
      ],
    }).catch((error: unknown) => {
      if (signal.aborted) throw error
      console.warn("⚠️ Meeting preparation rewrite failed; keeping the first draft:", error)
      return null
    })
    if (rewrite) {
      const nextInvented = findUnsupportedFigures(prepText(rewrite.data), sourceText)
      const nextProblems = findPlanProblems(rewrite.data, userFacts, chosen)
      // An invented figure outweighs a formatting slip, so a rewrite is kept only when it is no worse
      if (nextInvented.length <= invented.length && nextInvented.length + nextProblems.length < invented.length + problems.length) {
        prep = rewrite.data
        invented = nextInvented
        problems = nextProblems
      }
    }
    prep = dropUnsupportedFeatures(moveQuestionsOutOfSpeech(prep), userFacts ?? "")
    problems = findPlanProblems(prep, userFacts, chosen)
  }

  console.info(
    "Meeting preparation written:",
    JSON.stringify({
      provider: first.provider,
      usedProfile: senderProfile !== null,
      hasLeadProfile: Boolean(meeting.profileInfo),
      hasConversation: Boolean(meeting.conversationHistory),
      stages: prep.conversation.length,
      projectsShown: prep.conversation.flatMap((stage) => stage.steps).filter((step) => step.kind === "show_project").length,
      topics: prep.discussion_topics.length,
      unsupportedFigures: invented,
      planProblems: problems.length,
    })
  )
  return { ...prep, projects_to_show: mergeProjects(prep.projects_to_show, chosen), conversation: toScript(prep.conversation) }
}
