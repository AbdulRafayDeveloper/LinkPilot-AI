import { conversationOf } from "@/lib/meetingScript"
import { CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS, type MeetingChunkKind } from "@/constants/meetingChat"
import type { MeetingPlanDetail, MeetingPrep } from "@/types/meetingPlanner"
import type { Meeting as MeetingNotes } from "@/types/meetings"
import type { PromptBook } from "@/services/promptBook"

/**
 * Cutting one meeting into the pieces its chat is answered from: the details, the profile, the
 * conversation so far, the notes, and every part of the preparation (the read of the person, each
 * topic, each stage of the conversation plan, the projects, the deal path and the cautions). Each
 * piece stands on its own, because a piece is what the model is given to answer from, and each
 * carries the label an answer names it by. Nothing here talks to a model or the database, so the
 * rules can be read and tested on their own.
 *
 * **Every word around the meeting's own data (each label, each "Who they are:") is the module's
 * instructions prompt's**, handed in as `book`: a piece is what the model reads, so its framing is a
 * prompt like any other and an admin can change it. Meeting Planner passes its own, Meeting Notes its.
 */

type Words = Pick<PromptBook, "text">

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

const piecesOf = (book: Words, kind: MeetingChunkKind, label: string, text: string): MeetingChunk[] => {
  const parts = splitText(text)
  return parts.map((part, index) => ({
    kind,
    label: parts.length > 1 ? book.text("chunk.part", { label, number: index + 1, total: parts.length }) : label,
    text: part,
  }))
}

const taskText = (book: Words, heading: string, item: { task: string; owner: string | null; deadline: string | null; evidence: string }) =>
  [
    `${heading}: ${item.task}`,
    item.owner && book.text("chunk.task.agreed-by", { owner: item.owner }),
    item.deadline && book.text("chunk.task.by", { deadline: item.deadline }),
    book.text("chunk.evidence", { evidence: item.evidence }),
  ]
    .filter(Boolean)
    .join("\n")

const list = (heading: string, values: string[]) => (values.filter(Boolean).length > 0 ? `${heading}\n${values.filter(Boolean).map((value) => `- ${value}`).join("\n")}` : "")

function prepChunks(prep: MeetingPrep, book: Words): MeetingChunk[] {
  const chunks: MeetingChunk[] = []
  const analysis = prep.lead_analysis
  if (analysis) {
    const text = [
      analysis.who_they_are && book.text("chunk.lead.who", { value: analysis.who_they_are }),
      analysis.background && book.text("chunk.lead.background", { value: analysis.background }),
      list(book.text("chunk.lead.interests"), (analysis.interests ?? []).map((entry) => `${entry.point} (${entry.evidence})`)),
      list(book.text("chunk.lead.needs"), (analysis.needs_and_opportunities ?? []).map((entry) => `${entry.point} (${entry.evidence})`)),
      list(book.text("chunk.lead.help"), analysis.how_you_can_help ?? []),
      list(book.text("chunk.lead.before"), analysis.before_you_join ?? []),
      list(book.text("chunk.lead.unknown"), analysis.open_questions ?? []),
    ]
      .filter(Boolean)
      .join("\n\n")
    chunks.push(...piecesOf(book, "lead-analysis", book.text("chunk.label.lead"), text))
  }
  if (prep.your_intro) chunks.push(...piecesOf(book, "lead-analysis", book.text("chunk.label.intro"), prep.your_intro))
  for (const [index, topic] of (prep.discussion_topics ?? []).entries()) {
    chunks.push({
      kind: "topics",
      label: book.text("chunk.label.topic", { number: index + 1, topic: topic.topic }),
      text: `${book.text("chunk.topic", { topic: topic.topic, why: topic.why_it_matters })}\n${book.text("chunk.evidence", { evidence: topic.evidence })}`,
    })
  }
  for (const [index, stage] of conversationOf(prep).entries()) {
    const steps = stage.steps
      .map((step) => {
        const details = [
          book.text("chunk.step.project", { project: step.project }),
          step.minutes ? book.text("chunk.step.minutes", { minutes: step.minutes }) : null,
          step.features.length > 0 ? book.text("chunk.step.features", { features: step.features.join(", ") }) : null,
        ].filter(Boolean)
        const extra = step.project ? ` [${details.join(", ")}]` : ""
        return `${step.kind.replace("_", " ")}: ${step.text}${extra}`
      })
      .join("\n")
    const text = [
      book.text("chunk.stage.heading", { number: index + 1, title: stage.title }),
      stage.goal && book.text("chunk.stage.goal", { goal: stage.goal }),
      steps,
      stage.move_on_when && book.text("chunk.stage.move-on", { value: stage.move_on_when }),
    ]
      .filter(Boolean)
      .join("\n")
    chunks.push(...piecesOf(book, "conversation", book.text("chunk.label.stage", { number: index + 1, title: stage.title }), text))
  }
  for (const project of prep.projects_to_show ?? []) {
    chunks.push({
      kind: "projects",
      label: book.text("chunk.label.project", { project: project.project }),
      text: `${book.text("chunk.project", { project: project.project, why: project.why_it_will_land })}${project.link ? `\n${book.text("chunk.project.link", { link: project.link })}` : ""}`,
    })
  }
  if (prep.deal_path) {
    const text = [
      list(book.text("chunk.deal.signals"), prep.deal_path.signals_to_listen_for ?? []),
      prep.deal_path.how_to_raise_scope && book.text("chunk.deal.scope", { value: prep.deal_path.how_to_raise_scope }),
      prep.deal_path.natural_next_step && book.text("chunk.deal.next", { value: prep.deal_path.natural_next_step }),
    ]
      .filter(Boolean)
      .join("\n\n")
    if (text) chunks.push(...piecesOf(book, "deal-path", book.text("chunk.label.deal"), text))
  }
  const cautions = list(book.text("chunk.cautions"), prep.cautions ?? [])
  if (cautions) chunks.push(...piecesOf(book, "cautions", book.text("chunk.label.cautions"), cautions))
  return chunks
}

/**
 * Everything worth answering a question from, in pieces, in the order the meeting holds them.
 * `book` is Meeting Planner's instructions prompt, whose words frame each piece.
 */
export function meetingChunks(meeting: MeetingPlanDetail, book: Words): MeetingChunk[] {
  const context = meeting.prep?.meeting_context
  const details = [
    book.text("chunk.details.meeting", { name: meeting.name }),
    meeting.personName && book.text("chunk.details.person", { person: meeting.personName }),
    book.text("chunk.details.when", { date: meeting.meetingDate, time: meeting.meetingTime }),
    book.text("chunk.details.status", { status: meeting.status }),
    context && book.text("chunk.details.why", { about: context.what_it_is_about, situation: context.situation.replace(/_/g, " ") }),
  ]
    .filter(Boolean)
    .join("\n")
  return [
    { kind: "meeting" as const, label: book.text("chunk.label.details"), text: details },
    ...piecesOf(book, "profile", book.text("chunk.label.profile"), clean(meeting.profileInfo)),
    ...piecesOf(book, "conversation-history", book.text("chunk.label.history"), clean(meeting.conversationHistory)),
    ...piecesOf(book, "notes", book.text("chunk.label.notes"), clean(meeting.additionalInfo)),
    ...(meeting.prep ? prepChunks(meeting.prep, book) : []),
  ]
}

/**
 * The same, for a meeting that has already happened: the transcript exactly as it was pasted, cut
 * into readable pieces, and each part of the analysis built from it. The transcript is included as
 * well as the analysis because the analysis is a summary, and a question about what someone
 * actually said can only be answered from the words themselves.
 */
export function notesChunks(meeting: MeetingNotes, book: Words): MeetingChunk[] {
  const analysis = meeting.analysis
  const chunks: MeetingChunk[] = [
    {
      kind: "meeting",
      label: book.text("chunk.label.details"),
      text: [
        book.text("chunk.details.meeting", { name: meeting.title }),
        analysis?.purpose && book.text("chunk.details.purpose", { purpose: analysis.purpose }),
        book.text("chunk.details.status", { status: meeting.status }),
        book.text("chunk.details.held", { date: meeting.createdAt.slice(0, 10) }),
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ]

  if (analysis) {
    if (analysis.purpose) chunks.push(...piecesOf(book, "purpose", book.text("chunk.label.purpose"), analysis.purpose))
    if (analysis.minutes) chunks.push(...piecesOf(book, "minutes", book.text("chunk.label.minutes"), analysis.minutes))
    const topics = list(book.text("chunk.topics"), analysis.topics ?? [])
    if (topics) chunks.push(...piecesOf(book, "topics", book.text("chunk.label.topics"), topics))
    const people = list(
      book.text("chunk.people", { count: analysis.participantCount }),
      (analysis.participants ?? []).map((person) => `${person.name}${person.role ? ` - ${person.role}` : ""} (${person.evidence})`)
    )
    if (people) chunks.push(...piecesOf(book, "participants", book.text("chunk.label.people"), people))
    // A decision or a task is its own piece, so a question about one never has to carry the rest
    for (const [index, entry] of (analysis.myDecisions ?? []).entries()) {
      chunks.push({
        kind: "decisions",
        label: book.text("chunk.label.my-decision", { number: index + 1 }),
        text: `${book.text("chunk.my-decision", { decision: entry.decision })}\n${book.text("chunk.evidence", { evidence: entry.evidence })}`,
      })
    }
    for (const [index, entry] of (analysis.decisions ?? []).entries()) {
      chunks.push({
        kind: "decisions",
        label: book.text("chunk.label.decision", { number: index + 1 }),
        text: `${book.text("chunk.decision", { decision: entry.decision })}\n${book.text("chunk.evidence", { evidence: entry.evidence })}`,
      })
    }
    for (const [index, item] of (analysis.myTasks ?? []).entries()) {
      chunks.push({ kind: "my-tasks", label: book.text("chunk.label.my-task", { number: index + 1 }), text: taskText(book, book.text("chunk.my-task"), item) })
    }
    for (const [index, item] of (analysis.actionItems ?? []).entries()) {
      chunks.push({ kind: "action-items", label: book.text("chunk.label.action", { number: index + 1 }), text: taskText(book, book.text("chunk.action"), item) })
    }
    const requests = list(book.text("chunk.requests"), analysis.clientRequests ?? [])
    if (requests) chunks.push(...piecesOf(book, "client-requests", book.text("chunk.label.requests"), requests))
    const unknowns = list(book.text("chunk.unknowns"), analysis.unknowns ?? [])
    if (unknowns) chunks.push(...piecesOf(book, "unknowns", book.text("chunk.label.unknowns"), unknowns))
  }

  return [...chunks, ...piecesOf(book, "transcript", book.text("chunk.label.transcript"), clean(meeting.transcript))]
}
