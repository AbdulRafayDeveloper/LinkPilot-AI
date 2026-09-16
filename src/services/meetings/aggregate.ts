import type { ActionItem, MeetingDecision, MeetingParticipant } from "@/types/meetings"
import type { ChunkResult } from "./analysis"

/**
 * Putting the chunk results together, in code rather than by asking a model to remember them all.
 *
 * A model asked to merge twenty sets of notes will quietly summarise them, and a fact from the
 * middle of a long meeting can disappear. So the lists are merged here: every participant, every
 * decision and every task from every part is carried across, duplicates are collapsed, and the
 * model is left to do only what needs judgement (the title, the purpose, the minutes).
 */
export interface AggregatedFacts {
  // What the meeting was for, from the first part that says so
  purpose: string | null
  participants: MeetingParticipant[]
  topics: string[]
  decisions: MeetingDecision[]
  actionItems: ActionItem[]
  myTasks: ActionItem[]
  myDecisions: MeetingDecision[]
  clientRequests: string[]
  unknowns: string[]
}

// Two lines mean the same thing when they read the same apart from case and punctuation
const key = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

/**
 * The fullest wording wins, so a merged entry never loses detail one part had. Two lines also
 * count as the same when one reads inside the other, which is what happens when one part records
 * "look at the audit log" and another "look at the audit log after the upload work".
 */
function mergeText(values: string[]): string[] {
  const kept: { id: string; text: string }[] = []
  for (const value of values) {
    const text = value.trim()
    const id = key(text)
    if (!id) continue
    const at = kept.findIndex((entry) => entry.id === id || entry.id.includes(id) || id.includes(entry.id))
    if (at < 0) {
      kept.push({ id, text })
    } else if (text.length > kept[at].text.length) {
      kept[at] = { id, text }
    }
  }
  return kept.map((entry) => entry.text)
}

function mergeParticipants(results: ChunkResult[]): MeetingParticipant[] {
  const people = new Map<string, MeetingParticipant>()
  for (const result of results) {
    for (const person of result.participants) {
      const name = person.name.trim()
      if (!name) continue
      const id = key(name)
      const existing = people.get(id)
      people.set(id, {
        name: existing && existing.name.length >= name.length ? existing.name : name,
        role: existing?.role ?? person.role?.trim() ?? null,
        // Named anywhere means named; a part that missed the name does not undo it
        isNamed: Boolean(existing?.isNamed) || person.is_named,
        evidence: existing?.evidence === "stated" || person.evidence === "stated" ? "stated" : "inferred",
      })
    }
  }
  return [...people.values()]
}

function mergeDecisions(all: { decision: string; evidence: "stated" | "inferred" }[]): MeetingDecision[] {
  const texts = mergeText(all.map((entry) => entry.decision))
  const stated = new Set(all.filter((entry) => entry.evidence === "stated").map((entry) => key(entry.decision)))
  return texts.map((decision) => ({ decision, evidence: stated.has(key(decision)) ? "stated" : "inferred" }))
}

function mergeActionItems(all: ActionItemLike[]): ActionItem[] {
  const tasks = mergeText(all.map((entry) => entry.task))
  return tasks.map((task) => {
    // Everything the parts said about this task, so an owner or a deadline any of them gave is kept
    const id = key(task)
    const mentions = all.filter((entry) => {
      const other = key(entry.task)
      return other === id || other.includes(id) || id.includes(other)
    })
    return {
      task,
      owner: mentions.find((entry) => entry.owner?.trim())?.owner?.trim() ?? null,
      deadline: mentions.find((entry) => entry.deadline?.trim())?.deadline?.trim() ?? null,
      evidence: mentions.some((entry) => entry.evidence === "stated") ? "stated" : "inferred",
    }
  })
}

interface ActionItemLike {
  task: string
  owner: string | null
  deadline: string | null
  evidence: "stated" | "inferred"
}

/**
 * Every fact from every part, in the order the meeting made them, with duplicates collapsed.
 */
export function aggregateChunkResults(results: { index: number; result: ChunkResult }[]): AggregatedFacts {
  const ordered = [...results].sort((a, b) => a.index - b.index).map((entry) => entry.result)
  return {
    // The first part that says what the meeting is for settles it
    purpose: ordered.map((result) => result.purpose?.trim()).find(Boolean) ?? null,
    participants: mergeParticipants(ordered),
    topics: mergeText(ordered.flatMap((result) => result.topics)),
    decisions: mergeDecisions(ordered.flatMap((result) => result.decisions)),
    actionItems: mergeActionItems(ordered.flatMap((result) => result.action_items)),
    myTasks: mergeActionItems(ordered.flatMap((result) => result.my_tasks)),
    myDecisions: mergeDecisions(ordered.flatMap((result) => result.my_decisions)),
    clientRequests: mergeText(ordered.flatMap((result) => result.client_requests)),
    unknowns: mergeText(ordered.flatMap((result) => result.unknowns)),
  }
}
