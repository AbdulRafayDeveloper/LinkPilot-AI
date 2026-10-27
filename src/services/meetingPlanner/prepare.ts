import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage, type PromptDataBlock } from "@/services/promptComposer"
import { loadPromptBook, type PromptBook } from "@/services/promptBook"
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
 * the lead and what the user has saved about themselves (About Me plus Profile Info, the
 * same source every writing tool uses), so it can never invent a background for either side.
 */
// Preparation is advice, not copy: enough freedom to sound human, little enough to stay grounded
const PREP_TEMPERATURE = 0.4
// A read of a person plus a nine-stage plan is a long answer, so it gets longer than the 45
// seconds a single call is otherwise given
const PREP_TIMEOUT_MS = 120_000

const prepSchema = (book: PromptBook) => {
  const d = <T extends z.ZodType>(schema: T, id: string): T => schema.describe(book.text(id))
  const evidence = d(z.enum(["stated", "inferred"]), "field.evidence")
  const observation = z.object({ point: d(z.string(), "field.observation"), evidence })
  return z.object({
    // Decided first, because everything after it depends on why the meeting exists
    meeting_context: z.object({
      situation: d(z.enum(["they_asked_for_a_project", "you_reached_out", "unclear"]), "field.situation"),
      what_it_is_about: d(z.string(), "field.what-it-is-about"),
    }),
    lead_analysis: z.object({
      who_they_are: d(z.string(), "field.who-they-are"),
      background: d(z.string(), "field.background"),
      interests: d(z.array(observation), "field.interests"),
      needs_and_opportunities: d(z.array(observation), "field.needs"),
      how_you_can_help: d(z.array(z.string()), "field.how-you-can-help"),
      before_you_join: d(z.array(z.string()), "field.before-you-join"),
      open_questions: d(z.array(z.string()), "field.open-questions"),
    }),
    discussion_topics: d(
      z
        .array(
          z.object({
            topic: d(z.string(), "field.topic"),
            why_it_matters: d(z.string(), "field.why-it-matters"),
            evidence,
          })
        )
        .min(2),
      "field.topics"
    ),
    projects_to_show: d(
      z.array(
        z.object({
          project: d(z.string(), "field.project"),
          why_it_will_land: d(z.string(), "field.why-it-will-land"),
        })
      ),
      "field.projects"
    ),
    your_intro: d(z.string(), "field.your-intro"),
    conversation: d(
      z
        .array(
          z.object({
            title: d(z.string(), "field.stage-title"),
            goal: d(z.string(), "field.stage-goal"),
            steps: d(
              z
                .array(
                  z.object({
                    kind: d(z.enum(SCRIPT_STEP_KIND_IDS), "field.step-kind"),
                    text: d(z.string(), "field.step-text"),
                    project: d(z.string(), "field.step-project"),
                    minutes: d(z.number().int(), "field.step-minutes"),
                    features: d(z.array(z.string()), "field.step-features"),
                  })
                )
                .min(2),
              "field.steps"
            ),
            move_on_when: d(z.string(), "field.move-on-when"),
          })
        )
        .min(5),
      "field.conversation"
    ),
    deal_path: z.object({
      signals_to_listen_for: d(z.array(z.string()), "field.signals"),
      how_to_raise_scope: d(z.string(), "field.raise-scope"),
      natural_next_step: d(z.string(), "field.next-step"),
    }),
    cautions: d(z.array(z.string()), "field.cautions"),
  })
}

type PrepOutput = z.infer<ReturnType<typeof prepSchema>>

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

function findPlanProblems(prep: PrepOutput, senderProfile: string | null, chosen: ProjectToShow[], book: PromptBook): string[] {
  const problems: string[] = []
  const shown = new Set(
    prep.conversation.flatMap((stage) => stage.steps.filter((step) => step.kind === "show_project").map((step) => step.project.trim().toLowerCase()))
  )
  const notShown = chosen.filter((entry) => !shown.has(entry.project.trim().toLowerCase())).map((entry) => entry.project.trim())
  if (notShown.length > 0) {
    problems.push(book.text("problem.chosen-not-shown", { projects: notShown.join(", ") }))
  }
  const profile = (senderProfile ?? "").toLowerCase()
  const stages = prep.conversation
  stages.forEach((stage, index) => {
    const isLast = index === stages.length - 1
    const kinds = stage.steps.map((step) => step.kind)
    if (stage.steps.some((step) => step.kind === "say" && step.text.includes("?"))) {
      problems.push(book.text("problem.question-in-say", { stage: stage.title }))
    }
    if (!isLast && !kinds.includes("ask")) {
      problems.push(book.text("problem.no-ask", { stage: stage.title }))
    }
    if (kinds.includes("ask") && !kinds.includes("listen")) {
      problems.push(book.text("problem.no-listen", { stage: stage.title }))
    }
    if (!isLast && kinds[kinds.length - 1] !== "say") {
      problems.push(book.text("problem.no-closing-say", { stage: stage.title }))
    }
    for (const step of stage.steps.filter((entry) => entry.kind === "show_project")) {
      if (!step.project.trim() || !profile.includes(step.project.trim().toLowerCase())) {
        problems.push(book.text("problem.unknown-project", { stage: stage.title, project: step.project }))
      }
      const invented = unsupportedFeatures(step.project, step.features, senderProfile ?? "")
      if (invented.length > 0) {
        problems.push(book.text("problem.invented-features", { project: step.project, features: invented.join(", ") }))
      }
      if (step.features.length === 0) {
        problems.push(book.text("problem.no-features", { project: step.project, stage: stage.title }))
      }
    }
  })
  if (prep.projects_to_show.length > 0 && !stages.some((stage) => stage.steps.some((step) => step.kind === "show_project"))) {
    problems.push(book.text("problem.no-show-step"))
  }
  const spoken = [prep.your_intro, ...stages.flatMap((stage) => stage.steps.filter((step) => step.kind === "say").map((step) => step.text))].join("\n")
  for (const match of spoken.matchAll(MIRRORED_SPECIALTY)) {
    const field = (match[1] ?? match[2]).toLowerCase()
    if (!profile.includes(field)) {
      problems.push(book.text("problem.mirrored-specialty", { phrase: match[0] }))
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
  const [template, senderProfile, book] = await Promise.all([
    getActivePreparationPrompt(),
    getFullSenderProfile(),
    loadPromptBook("meeting-planner-instructions"),
  ])
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
      label: book.text("label.profile"),
      content: meeting.profileInfo,
      pasted: true,
    },
    {
      variable: "conversation_history",
      tag: "conversation_history",
      label: book.text("label.conversation"),
      content: meeting.conversationHistory,
      pasted: true,
    },
    {
      variable: "additional_info",
      tag: "meeting_notes",
      label: book.text("label.notes"),
      content: meeting.additionalInfo,
    },
    {
      variable: "sender_profile",
      tag: "sender_profile",
      label: book.text("label.about-me"),
      content: senderProfile,
      emptyText: book.text("empty.about-me"),
    },
    {
      variable: "chosen_projects",
      tag: "projects_i_chose",
      label: book.text("label.chosen-projects"),
      content: chosenList || null,
      emptyText: book.text("empty.chosen-projects"),
    },
  ]
  const user = await composePromptMessage(template, blocks, {
    meeting_name: meeting.name,
    meeting_when: book.text("when", { date: dayLabel(meeting.meetingDate), time: formatTime(meeting.meetingTime) }),
    person_name: meeting.personName ?? book.text("person-unknown"),
  })

  const messages = [new SystemMessage(system), new HumanMessage(user)]
  const generation = {
    schema: prepSchema(book),
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
  let problems = findPlanProblems(prep, userFacts, chosen, book)

  if (invented.length > 0 || problems.length > 0) {
    const fixes = [
      ...(invented.length > 0 ? [book.text("problem.invented-figures", { figures: invented.join(", ") })] : []),
      ...problems,
    ]
    const rewrite = await generateStructuredWithFallback({
      ...generation,
      messages: [
        ...messages,
        new HumanMessage(book.text("rewrite", { problems: fixes.map((fix) => `- ${fix}`).join("\n") })),
      ],
    }).catch((error: unknown) => {
      if (signal.aborted) throw error
      console.warn("⚠️ Meeting preparation rewrite failed; keeping the first draft:", error)
      return null
    })
    if (rewrite) {
      const nextInvented = findUnsupportedFigures(prepText(rewrite.data), sourceText)
      const nextProblems = findPlanProblems(rewrite.data, userFacts, chosen, book)
      // An invented figure outweighs a formatting slip, so a rewrite is kept only when it is no worse
      if (nextInvented.length <= invented.length && nextInvented.length + nextProblems.length < invented.length + problems.length) {
        prep = rewrite.data
        invented = nextInvented
        problems = nextProblems
      }
    }
    prep = dropUnsupportedFeatures(moveQuestionsOutOfSpeech(prep), userFacts ?? "")
    problems = findPlanProblems(prep, userFacts, chosen, book)
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
