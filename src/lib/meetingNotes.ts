import type { ActionItem, MeetingAnalysis } from "@/types/meetings"

/**
 * The meeting's notes: the analysis written out as one editable text, in the rich-text marks the
 * app's editor and viewer read (`lib/richText.ts`). The analysis is what the model wrote from the
 * transcript; this only lays it out, so nothing appears in the notes that the analysis didn't say,
 * and a section with nothing in it is left out rather than shown empty.
 */

const bullets = (lines: readonly string[]) => lines.filter((line) => line.trim()).map((line) => `- ${line.trim()}`)

const describeTask = (item: ActionItem) => {
  const who = item.owner ? ` (**${item.owner}**)` : ""
  const when = item.deadline ? `, by ${item.deadline}` : ""
  return `${item.task}${who}${when}`
}

function section(heading: string, lines: string[]): string[] {
  return lines.length > 0 ? [`## ${heading}`, ...lines, ""] : []
}

/** Notes built from the analysis, ready to be edited. */
export function buildMeetingNotes(analysis: MeetingAnalysis): string {
  const participants = analysis.participants.map((person) => (person.role ? `${person.name}, ${person.role}` : person.name))
  const lines = [
    ...section("Summary", analysis.minutes.trim() ? [analysis.minutes.trim()] : []),
    ...section("Purpose", analysis.purpose?.trim() ? [analysis.purpose.trim()] : []),
    ...section("Who was there", bullets(participants)),
    ...section("Topics", bullets(analysis.topics)),
    ...section("Decisions", bullets(analysis.decisions.map((entry) => entry.decision))),
    ...section("My tasks", bullets(analysis.myTasks.map(describeTask))),
    ...section("Action items", bullets(analysis.actionItems.map(describeTask))),
    ...section("What the client asked for", bullets(analysis.clientRequests)),
    ...section("Still open", bullets(analysis.unknowns)),
  ]
  return lines.join("\n").trim()
}
