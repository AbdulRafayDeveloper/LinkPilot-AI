import { conversationOf } from "@/lib/meetingScript"
import { CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS, type MeetingChunkKind } from "@/constants/meetingChat"
import type { MeetingPlanDetail, MeetingPrep } from "@/types/meetingPlanner"

/**
 * Cutting one meeting into the pieces its chat is answered from: the details, the profile, the
 * conversation so far, the notes, and every part of the preparation (the read of the person, each
 * topic, each stage of the conversation plan, the projects, the deal path and the cautions). Each
 * piece stands on its own, because a piece is what the model is given to answer from, and each
 * carries the label an answer names it by. Nothing here talks to a model or the database, so the
 * rules can be read and tested on their own.
 */

export interface MeetingChunk {
  kind: MeetingChunkKind
  label: string
  text: string
}

const clean = (value: string | null | undefined) => (value ?? "").trim()

/** Long text in pieces, cut at a paragraph or a sentence end so a piece always reads as something whole. */
function splitText(text: string, max = CHUNK_MAX_CHARS, overlap = CHUNK_OVERLAP_CHARS): string[] {
  const whole = clean(text)
  if (whole.length <= max) return whole ? [whole] : []
  const pieces: string[] = []
  let start = 0
  while (start < whole.length) {
    const end = Math.min(whole.length, start + max)
    const window = whole.slice(start, end)
    // Prefer the last paragraph break, then the last sentence end, and only then a hard cut
    const breakAt = end === whole.length ? window.length : Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(". "))
    const size = breakAt > max / 2 ? breakAt + 1 : window.length
    pieces.push(whole.slice(start, start + size).trim())
    if (start + size >= whole.length) break
    start += Math.max(1, size - overlap)
  }
  return pieces.filter(Boolean)
}

const piecesOf = (kind: MeetingChunkKind, label: string, text: string): MeetingChunk[] => {
  const parts = splitText(text)
  return parts.map((part, index) => ({ kind, label: parts.length > 1 ? `${label} (${index + 1} of ${parts.length})` : label, text: part }))
}

const list = (heading: string, values: string[]) => (values.filter(Boolean).length > 0 ? `${heading}\n${values.filter(Boolean).map((value) => `- ${value}`).join("\n")}` : "")

function prepChunks(prep: MeetingPrep): MeetingChunk[] {
  const chunks: MeetingChunk[] = []
  const analysis = prep.lead_analysis
  if (analysis) {
    const text = [
      analysis.who_they_are && `Who they are: ${analysis.who_they_are}`,
      analysis.background && `Background: ${analysis.background}`,
      list("What interests them:", (analysis.interests ?? []).map((entry) => `${entry.point} (${entry.evidence})`)),
      list("What they need, and where the opportunity is:", (analysis.needs_and_opportunities ?? []).map((entry) => `${entry.point} (${entry.evidence})`)),
      list("How you can help:", analysis.how_you_can_help ?? []),
      list("Before you join the call:", analysis.before_you_join ?? []),
      list("Still unknown, so ask:", analysis.open_questions ?? []),
    ]
      .filter(Boolean)
      .join("\n\n")
    chunks.push(...piecesOf("lead-analysis", "Read of the person", text))
  }
  if (prep.your_intro) chunks.push(...piecesOf("lead-analysis", "How to introduce yourself", prep.your_intro))
  for (const [index, topic] of (prep.discussion_topics ?? []).entries()) {
    chunks.push({ kind: "topics", label: `Topic ${index + 1}. ${topic.topic}`, text: `Topic to cover: ${topic.topic}\nWhy it matters: ${topic.why_it_matters}\nThis is ${topic.evidence}.` })
  }
  for (const [index, stage] of conversationOf(prep).entries()) {
    const steps = stage.steps
      .map((step) => {
        const extra = step.project ? ` [project: ${step.project}${step.minutes ? `, about ${step.minutes} minutes` : ""}${step.features.length > 0 ? `, show ${step.features.join(", ")}` : ""}]` : ""
        return `${step.kind.replace("_", " ")}: ${step.text}${extra}`
      })
      .join("\n")
    const text = [`Stage ${index + 1} of the conversation: ${stage.title}`, stage.goal && `Goal: ${stage.goal}`, steps, stage.move_on_when && `Move on when: ${stage.move_on_when}`].filter(Boolean).join("\n")
    chunks.push(...piecesOf("conversation", `Stage ${index + 1}. ${stage.title}`, text))
  }
  for (const project of prep.projects_to_show ?? []) {
    chunks.push({
      kind: "projects",
      label: `Project to show: ${project.project}`,
      text: `Project to show them: ${project.project}\nWhy it will land: ${project.why_it_will_land}${project.link ? `\nLink: ${project.link}` : ""}`,
    })
  }
  if (prep.deal_path) {
    const text = [
      list("Signals to listen for:", prep.deal_path.signals_to_listen_for ?? []),
      prep.deal_path.how_to_raise_scope && `How to raise scope: ${prep.deal_path.how_to_raise_scope}`,
      prep.deal_path.natural_next_step && `The natural next step: ${prep.deal_path.natural_next_step}`,
    ]
      .filter(Boolean)
      .join("\n\n")
    if (text) chunks.push(...piecesOf("deal-path", "Deal path", text))
  }
  const cautions = list("Do not claim any of this, because nothing supports it:", prep.cautions ?? [])
  if (cautions) chunks.push(...piecesOf("cautions", "Cautions", cautions))
  return chunks
}

/** Everything worth answering a question from, in pieces, in the order the meeting holds them. */
export function meetingChunks(meeting: MeetingPlanDetail): MeetingChunk[] {
  const details = [
    `Meeting: ${meeting.name}`,
    meeting.personName && `Person: ${meeting.personName}`,
    `When: ${meeting.meetingDate} at ${meeting.meetingTime}`,
    `Status: ${meeting.status}`,
    meeting.prep?.meeting_context && `Why the meeting exists: ${meeting.prep.meeting_context.what_it_is_about} (${meeting.prep.meeting_context.situation.replace(/_/g, " ")})`,
  ]
    .filter(Boolean)
    .join("\n")
  return [
    { kind: "meeting" as const, label: "Meeting details", text: details },
    ...piecesOf("profile", "Their profile", clean(meeting.profileInfo)),
    ...piecesOf("conversation-history", "Conversation so far", clean(meeting.conversationHistory)),
    ...piecesOf("notes", "Your notes", clean(meeting.additionalInfo)),
    ...(meeting.prep ? prepChunks(meeting.prep) : []),
  ]
}
