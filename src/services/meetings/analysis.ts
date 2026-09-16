import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { SITE_AUTHOR } from "@/config/site"
import { MEETING_TITLE_MAX_LENGTH } from "@/constants/meetings"
import type { TranscriptChunk } from "@/lib/transcriptChunks"
import type { MeetingAnalysis } from "@/types/meetings"
import { aggregateChunkResults } from "./aggregate"

/**
 * The two AI stages of a meeting. Reading one chunk is the map step, and putting the chunk
 * results together is the reduce step, which folds in passes when there are too many results to
 * hand over at once. Neither stage ever sees more than one chunk of transcript at a time.
 */
// Facts, not prose: the model should quote the meeting, not write around it
const ANALYSIS_TEMPERATURE = 0.2
// The most characters of chunk results handed to one reduce call; more than this folds first
const REDUCE_INPUT_MAX_CHARS = 30_000
// Putting a long meeting together reads more than a normal generation, so it gets longer than the
// 45 seconds a single call is otherwise given
const SYNTHESIS_TIMEOUT_MS = 120_000

const EvidenceSchema = z
  .enum(["stated", "inferred"])
  .describe('"stated" when the transcript says it outright, "inferred" when it clearly follows from what was said')

const ParticipantSchema = z.object({
  name: z.string().describe('The speaker name as the transcript gives it, or "Unnamed speaker 1" when they speak but are never named'),
  role: z.string().nullable().describe("What they do, only when the transcript says so, otherwise null"),
  is_named: z.boolean().describe("True when the transcript actually gives their name"),
  evidence: EvidenceSchema,
})

const ActionItemSchema = z.object({
  task: z.string().describe("The task exactly as it was agreed, in one line"),
  owner: z.string().nullable().describe("Who took it on, or null when the transcript does not say"),
  deadline: z.string().nullable().describe("Only a date or timeframe that was actually said, otherwise null"),
  evidence: EvidenceSchema,
})

const DecisionSchema = z.object({
  decision: z.string().describe("The decision as it was settled, in one line"),
  evidence: EvidenceSchema,
})

/**
 * What one chunk of the meeting gives up. The same shape carries a fold of several chunk results,
 * so folding is just reading a shorter meeting.
 */
export const ChunkResultSchema = z.object({
  purpose: z
    .string()
    .nullable()
    .describe("Why the meeting is being held, but only when this part actually says so, otherwise null"),
  participants: z
    .array(ParticipantSchema)
    .describe("Only people who actually speak or are addressed as being in this part; never someone merely talked about"),
  topics: z.array(z.string()).describe("What this part of the meeting was about, a few words each"),
  decisions: z.array(DecisionSchema).describe("Decisions settled in this part; a suggestion nobody agreed to is not a decision"),
  action_items: z.array(ActionItemSchema).describe("Tasks anyone agreed to do in this part"),
  my_tasks: z.array(ActionItemSchema).describe("Tasks the user himself agreed to or was asked to do"),
  my_decisions: z.array(DecisionSchema).describe("Decisions that involve the user or change his work"),
  client_requests: z.array(z.string()).describe("What the client asked the user for, in their own terms"),
  unknowns: z.array(z.string()).describe("Things this part raises but leaves open, such as a date nobody set"),
})

export type ChunkResult = z.infer<typeof ChunkResultSchema>

/**
 * What the model writes at the end. The lists of participants, decisions and tasks are not asked
 * for here: they are merged from the chunk results in code (services/meetings/aggregate.ts), so a
 * fact from the middle of a long meeting can never be summarised away. The model is left with the
 * parts that need judgement.
 */
const SynthesisSchema = z.object({
  title: z.string().describe("A 4 to 8 word name for this meeting, in plain words"),
  purpose: z.string().nullable().describe("Why the meeting happened, in one or two sentences, or null when the notes never say"),
  topics: z.array(z.string()).describe("The main subjects of the whole meeting, most important first, in a few words each"),
  minutes: z.string().describe("3 to 4 lines summarising the meeting, ready to send the client as it is"),
})

const trimTitle = (title: string) => title.replace(/["'`*#]/g, "").replace(/\s+/g, " ").trim().slice(0, MEETING_TITLE_MAX_LENGTH)

/**
 * Reads one chunk of the transcript. The chunk is untrusted text inside its own tags, and the tail
 * of the chunk before it comes along as context the model may read but must not extract again.
 */
export async function analyzeChunk(chunk: TranscriptChunk, totalChunks: number, signal: AbortSignal): Promise<ChunkResult> {
  const [system, instructions] = await Promise.all([loadPrompt("meeting-system"), loadPrompt("meeting-chunk")])
  const user = composePromptMessage(
    instructions,
    [
      {
        variable: "previous_context",
        tag: "previous_context",
        label: "The end of the previous part, for context only",
        content: chunk.context || null,
        emptyText: "This is the start of the meeting.",
      },
      { variable: "transcript_part", tag: "transcript_part", label: "The part of the meeting to read", content: chunk.text },
    ],
    { part_number: String(chunk.index + 1), total_parts: String(totalChunks), my_name: SITE_AUTHOR }
  )

  const { data } = await generateStructuredWithFallback({
    schema: ChunkResultSchema,
    name: "meeting_chunk_analysis",
    messages: [
      new SystemMessage(renderPrompt(system, { MY_NAME: SITE_AUTHOR, PART_NUMBER: chunk.index + 1, TOTAL_PARTS: totalChunks })),
      new HumanMessage(user),
    ],
    temperature: ANALYSIS_TEMPERATURE,
    signal,
  })
  return data
}

// Chunk results as compact text for a reduce call, each labelled with the part it came from
function describeResults(results: { index: number; result: ChunkResult }[]): string {
  return results
    .map(({ index, result }) => `Part ${index + 1}:\n${JSON.stringify(result)}`)
    .join("\n\n")
}

/**
 * Folds several chunk results into one, for when there are too many to hand over at once. The
 * fold keeps the same shape, so it can be folded again, as many times as a long meeting needs.
 */
async function foldResults(
  results: { index: number; result: ChunkResult }[],
  signal: AbortSignal
): Promise<ChunkResult> {
  const [system, instructions] = await Promise.all([loadPrompt("meeting-system"), loadPrompt("meeting-chunk")])
  const user = composePromptMessage(
    `${instructions}\n\nThese are the notes already taken from consecutive parts of one meeting, in order. Merge them into one set of notes for this stretch of the meeting: keep every distinct fact, drop exact repeats, and never add anything that is not in the notes.`,
    [{ variable: "transcript_part", tag: "meeting_notes", label: "Notes from the parts", content: describeResults(results) }],
    { part_number: "merged", total_parts: String(results.length), my_name: SITE_AUTHOR }
  )

  const { data } = await generateStructuredWithFallback({
    schema: ChunkResultSchema,
    name: "meeting_notes_merge",
    messages: [
      new SystemMessage(renderPrompt(system, { MY_NAME: SITE_AUTHOR, PART_NUMBER: "merged", TOTAL_PARTS: results.length })),
      new HumanMessage(user),
    ],
    temperature: ANALYSIS_TEMPERATURE,
    signal,
  })
  return data
}

/**
 * Brings the chunk results down to something one call can read: consecutive groups are folded
 * together, over and over, until what is left fits. Order is kept at every pass, so the meeting
 * still reads from start to finish.
 */
async function reduceToFitting(
  results: { index: number; result: ChunkResult }[],
  signal: AbortSignal,
  onFold?: (remaining: number) => void
): Promise<{ index: number; result: ChunkResult }[]> {
  let current = [...results].sort((a, b) => a.index - b.index)
  while (describeResults(current).length > REDUCE_INPUT_MAX_CHARS && current.length > 1) {
    const groups: { index: number; result: ChunkResult }[][] = []
    let group: { index: number; result: ChunkResult }[] = []
    for (const entry of current) {
      group.push(entry)
      if (describeResults(group).length >= REDUCE_INPUT_MAX_CHARS / 2) {
        groups.push(group)
        group = []
      }
    }
    if (group.length > 0) groups.push(group)
    // A single group that still does not fit would loop forever; split it in half instead
    if (groups.length === 1) {
      const half = Math.max(1, Math.floor(current.length / 2))
      groups.splice(0, 1, current.slice(0, half), current.slice(half))
    }
    onFold?.(groups.length)
    const folded: { index: number; result: ChunkResult }[] = []
    for (const entries of groups) {
      folded.push({
        index: entries[0].index,
        result: entries.length === 1 ? entries[0].result : await foldResults(entries, signal),
      })
    }
    current = folded
  }
  return current
}

/**
 * The whole meeting, from the notes taken of every part.
 *
 * The lists are merged in code, so every participant, decision and task any part found is carried
 * through whatever the meeting's length. The model is given those merged notes (folded first when
 * there are too many to read at once) and writes only what needs judgement: the name of the
 * meeting, what it was for, the subjects in order, and the few lines to send the client.
 */
export async function synthesizeMeeting(
  results: { index: number; result: ChunkResult }[],
  options: { userTitle: string | null; signal: AbortSignal; onFold?: (remaining: number) => void }
): Promise<{ analysis: MeetingAnalysis; title: string }> {
  const facts = aggregateChunkResults(results)
  // The model reads the merged facts, which are far smaller than every raw note and already free
  // of repeats. Only a meeting so long that even those do not fit is folded first, and only for
  // the model: what is stored always keeps every merged fact.
  let digest = JSON.stringify(facts)
  if (digest.length > REDUCE_INPUT_MAX_CHARS) {
    const folded = await reduceToFitting(results, options.signal, options.onFold)
    digest = JSON.stringify(aggregateChunkResults(folded))
  }
  const [system, instructions] = await Promise.all([loadPrompt("meeting-system"), loadPrompt("meeting-synthesis")])
  const user = composePromptMessage(
    instructions,
    [{ variable: "meeting_notes", tag: "meeting_notes", label: "Everything the parts of the meeting gave up, merged and in order", content: digest }],
    {
      my_name: SITE_AUTHOR,
      total_parts: String(results.length),
      title_instruction: options.userTitle
        ? `The meeting already has the name "${options.userTitle}". Repeat it exactly as the title.`
        : "Give the meeting a name of 4 to 8 words, taken from what it was actually about.",
    }
  )

  const { data } = await generateStructuredWithFallback({
    schema: SynthesisSchema,
    name: "meeting_synthesis",
    messages: [
      new SystemMessage(renderPrompt(system, { MY_NAME: SITE_AUTHOR, PART_NUMBER: "all", TOTAL_PARTS: results.length })),
      new HumanMessage(user),
    ],
    temperature: ANALYSIS_TEMPERATURE,
    timeoutMs: SYNTHESIS_TIMEOUT_MS,
    signal: options.signal,
    validate: (output) => (output.minutes.trim() ? null : "empty minutes of meeting"),
  })

  // The subjects the model put in order, then any it left out, so none is lost
  const ordered = data.topics.map((topic) => topic.trim()).filter(Boolean)
  const seen = new Set(ordered.map((topic) => topic.toLowerCase()))
  const topics = [...ordered, ...facts.topics.filter((topic) => !seen.has(topic.toLowerCase()))]

  return {
    title: trimTitle(options.userTitle || data.title) || "Untitled meeting",
    analysis: {
      // What a part of the meeting actually stated wins over what the model wrote about it
      purpose: facts.purpose || data.purpose?.trim() || null,
      topics,
      participants: facts.participants,
      // The count follows the people actually listed, so the two can never disagree
      participantCount: facts.participants.length,
      myTasks: facts.myTasks,
      clientRequests: facts.clientRequests,
      myDecisions: facts.myDecisions,
      decisions: facts.decisions,
      actionItems: facts.actionItems,
      minutes: data.minutes.trim(),
      unknowns: facts.unknowns,
    },
  }
}
