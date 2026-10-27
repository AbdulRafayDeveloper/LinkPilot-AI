import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { loadPromptBook, type PromptBook } from "@/services/promptBook"
import { SITE_AUTHOR } from "@/config/site"
import { MEETING_MESSAGES, MEETING_TITLE_MAX_LENGTH, MEETING_ANSWER_MAX_TOKENS, TOPICS_MAX } from "@/constants/meetings"
import { foldParticipants, mergeTopics, participantsFromPeople, withKnownOwners, workDecisions } from "@/lib/meetingPeople"
import type { TranscriptChunk } from "@/lib/transcriptChunks"
import type { MeetingAnalysis } from "@/types/meetings"
import { aggregateChunkResults } from "./aggregate"
import { hasMeetingSubstance } from "@/lib/meetingFacts"

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

/**
 * Adds a field's description, read from the module's instructions prompt, or nothing at all. The
 * same shapes serve two purposes: with descriptions they are what the model is asked for, and with
 * none they read back the results already stored (`ChunkResultSchema`), which need no words.
 */
type Describe = <T extends z.ZodType>(schema: T, id: string) => T
const withoutWords: Describe = (schema) => schema
const describedBy = (book: PromptBook): Describe => (schema, id) => schema.describe(book.text(id))

function chunkResultShape(d: Describe) {
  const evidence = d(z.enum(["stated", "inferred"]), "field.evidence")
  const participant = z.object({
    name: d(z.string(), "field.participant.name"),
    role: d(z.string().nullable(), "field.participant.role"),
    is_named: d(z.boolean(), "field.participant.is-named"),
    evidence,
  })
  const actionItem = z.object({
    task: d(z.string(), "field.action.task"),
    owner: d(z.string().nullable(), "field.action.owner"),
    deadline: d(z.string().nullable(), "field.action.deadline"),
    evidence,
  })
  const decision = z.object({ decision: d(z.string(), "field.decision"), evidence })
  return z.object({
    purpose: d(z.string().nullable(), "field.chunk.purpose"),
    participants: d(z.array(participant), "field.chunk.participants"),
    topics: d(z.array(z.string()), "field.chunk.topics"),
    decisions: d(z.array(decision), "field.chunk.decisions"),
    action_items: d(z.array(actionItem), "field.chunk.action-items"),
    my_tasks: d(z.array(actionItem), "field.chunk.my-tasks"),
    my_decisions: d(z.array(decision), "field.chunk.my-decisions"),
    client_requests: d(z.array(z.string()), "field.chunk.client-requests"),
    unknowns: d(z.array(z.string()), "field.chunk.unknowns"),
  })
}

/**
 * What one chunk of the meeting gives up. The same shape carries a fold of several chunk results,
 * so folding is just reading a shorter meeting. This one has no descriptions: it reads stored results.
 */
export const ChunkResultSchema = chunkResultShape(withoutWords)
// The same shape as the model is asked for it, each field described by the instructions prompt
const chunkResultSchema = (book: PromptBook) => chunkResultShape(describedBy(book))

export type ChunkResult = z.infer<typeof ChunkResultSchema>

/**
 * What the model writes at the end. The lists of participants, decisions and tasks are not asked
 * for here: they are merged from the chunk results in code (services/meetings/aggregate.ts), so a
 * fact from the middle of a long meeting can never be summarised away. The model is left with the
 * parts that need judgement.
 */
const synthesisSchema = (book: PromptBook) =>
  z.object({
    title: z.string().describe(book.text("field.synthesis.title")),
    purpose: z.string().nullable().describe(book.text("field.synthesis.purpose")),
    topics: z.array(z.string()).describe(book.text("field.synthesis.topics")),
    minutes: z.string().describe(book.text("field.synthesis.minutes")),
  })

const trimTitle = (title: string) => title.replace(/["'`*#]/g, "").replace(/\s+/g, " ").trim().slice(0, MEETING_TITLE_MAX_LENGTH)

/**
 * Reads one chunk of the transcript. The chunk is untrusted text inside its own tags, and the tail
 * of the chunk before it comes along as context the model may read but must not extract again.
 */
/**
 * What the user's own calendar says this meeting was, as a block the model may read.
 *
 * **It is added only when there is something to say**, so a meeting linked to nothing, and every
 * meeting whose people the user has named, is asked exactly what it was asked before. A name here
 * is the app's own record of who the conversation was with, which is why it may be put to a speaker
 * the recording never names; it is marked `inferred`, never `stated`, because nobody said it aloud.
 */
const calendarBlock = (calendar: string | null, book: PromptBook) =>
  calendar ? [{ variable: "calendar", tag: "what_the_calendar_says", label: book.text("label.calendar"), content: calendar }] : []

export async function analyzeChunk(
  chunk: TranscriptChunk,
  totalChunks: number,
  signal: AbortSignal,
  // Who the user says was in the meeting, so the part is read knowing the names rather than guessing
  people: string[] = [],
  // What the calendar says this meeting was, when the user has not said who was in it
  calendar: string | null = null
): Promise<ChunkResult> {
  const [system, instructions, book] = await Promise.all([
    loadPrompt("meeting-system"),
    loadPrompt("meeting-chunk"),
    loadPromptBook("meetings-instructions"),
  ])
  const user = await composePromptMessage(
    instructions,
    [
      {
        variable: "previous_context",
        tag: "previous_context",
        label: book.text("label.previous-context"),
        content: chunk.context || null,
        emptyText: book.text("empty.previous-context"),
      },
      { variable: "transcript_part", tag: "transcript_part", label: book.text("label.transcript-part"), content: chunk.text },
      {
        variable: "people",
        tag: "people_in_the_meeting",
        label: book.text("label.people"),
        content: people.length > 0 ? people.join("\n") : null,
        emptyText: book.text("empty.people"),
      },
      ...calendarBlock(people.length > 0 ? null : calendar, book),
    ],
    { part_number: String(chunk.index + 1), total_parts: String(totalChunks), my_name: SITE_AUTHOR }
  )

  const { data } = await generateStructuredWithFallback({
    schema: chunkResultSchema(book),
    name: "meeting_chunk_analysis",
    messages: [
      new SystemMessage(renderPrompt(system, { MY_NAME: SITE_AUTHOR, PART_NUMBER: chunk.index + 1, TOTAL_PARTS: totalChunks })),
      new HumanMessage(user),
    ],
    temperature: ANALYSIS_TEMPERATURE,
    // A meeting's schemas are the biggest the app asks for; the provider's own default cut them off
    maxTokens: MEETING_ANSWER_MAX_TOKENS,
    signal,
  })
  return data
}

// Chunk results as compact text for a reduce call, each labelled with the part it came from
function describeResults(results: { index: number; result: ChunkResult }[], book: PromptBook): string {
  return results
    .map(({ index, result }) => `${book.text("part-heading", { number: index + 1 })}\n${JSON.stringify(result)}`)
    .join("\n\n")
}

/**
 * Folds several chunk results into one, for when there are too many to hand over at once. The
 * fold keeps the same shape, so it can be folded again, as many times as a long meeting needs.
 */
async function foldResults(
  results: { index: number; result: ChunkResult }[],
  signal: AbortSignal,
  book: PromptBook
): Promise<ChunkResult> {
  const [system, instructions] = await Promise.all([loadPrompt("meeting-system"), loadPrompt("meeting-chunk")])
  const user = await composePromptMessage(
    book.text("fold.request", { instructions }),
    [{ variable: "transcript_part", tag: "meeting_notes", label: book.text("label.notes-from-parts"), content: describeResults(results, book) }],
    { part_number: "merged", total_parts: String(results.length), my_name: SITE_AUTHOR }
  )

  const { data } = await generateStructuredWithFallback({
    schema: chunkResultSchema(book),
    name: "meeting_notes_merge",
    messages: [
      new SystemMessage(renderPrompt(system, { MY_NAME: SITE_AUTHOR, PART_NUMBER: "merged", TOTAL_PARTS: results.length })),
      new HumanMessage(user),
    ],
    temperature: ANALYSIS_TEMPERATURE,
    // A meeting's schemas are the biggest the app asks for; the provider's own default cut them off
    maxTokens: MEETING_ANSWER_MAX_TOKENS,
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
  book: PromptBook,
  onFold?: (remaining: number) => void
): Promise<{ index: number; result: ChunkResult }[]> {
  let current = [...results].sort((a, b) => a.index - b.index)
  while (describeResults(current, book).length > REDUCE_INPUT_MAX_CHARS && current.length > 1) {
    const groups: { index: number; result: ChunkResult }[][] = []
    let group: { index: number; result: ChunkResult }[] = []
    for (const entry of current) {
      group.push(entry)
      if (describeResults(group, book).length >= REDUCE_INPUT_MAX_CHARS / 2) {
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
        result: entries.length === 1 ? entries[0].result : await foldResults(entries, signal, book),
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
  options: { userTitle: string | null; signal: AbortSignal; onFold?: (remaining: number) => void; people?: string[]; calendar?: string | null }
): Promise<{ analysis: MeetingAnalysis; title: string }> {
  const facts = aggregateChunkResults(results)
  const substance = hasMeetingSubstance(facts)
  // Every word besides the system and synthesis prompts is the module's instructions prompt
  const book = await loadPromptBook("meetings-instructions")
  // The model reads the merged facts, which are far smaller than every raw note and already free
  // of repeats. Only a meeting so long that even those do not fit is folded first, and only for
  // the model: what is stored always keeps every merged fact.
  let digest = JSON.stringify(facts)
  if (digest.length > REDUCE_INPUT_MAX_CHARS) {
    const folded = await reduceToFitting(results, options.signal, book, options.onFold)
    digest = JSON.stringify(aggregateChunkResults(folded))
  }
  const [system, instructions] = await Promise.all([loadPrompt("meeting-system"), loadPrompt("meeting-synthesis")])
  const user = await composePromptMessage(
    instructions,
    [
      { variable: "meeting_notes", tag: "meeting_notes", label: book.text("label.merged-notes"), content: digest },
      ...calendarBlock((options.people ?? []).length > 0 ? null : (options.calendar ?? null), book),
    ],
    {
      my_name: SITE_AUTHOR,
      total_parts: String(results.length),
      title_instruction: options.userTitle ? book.text("title.keep", { title: options.userTitle }) : book.text("title.write"),
    }
  )

  const { data } = await generateStructuredWithFallback({
    schema: synthesisSchema(book),
    name: "meeting_synthesis",
    messages: [
      new SystemMessage(renderPrompt(system, { MY_NAME: SITE_AUTHOR, PART_NUMBER: "all", TOTAL_PARTS: results.length })),
      new HumanMessage(user),
    ],
    temperature: ANALYSIS_TEMPERATURE,
    // Putting the whole meeting together is the longest answer of all
    maxTokens: MEETING_ANSWER_MAX_TOKENS,
    timeoutMs: SYNTHESIS_TIMEOUT_MS,
    signal: options.signal,
    /**
     * Empty minutes are a failure **only when there was something to summarise**. A recording that
     * holds no meeting (a microphone test, a few seconds of a video) gives the model nothing to
     * write, and rejecting that answer used to send the whole analysis through every provider and
     * end as "Groq wrote something the app could not use", which blamed the model for the
     * recording being empty and named env vars that had nothing to do with it.
     */
    validate: (output) => (!substance || output.minutes.trim() ? null : "empty minutes of meeting"),
  })

  /**
   * The subjects the model put in order, then any the parts had that it left out. They are merged
   * on **what they are about**, not on being spelled the same: the model writes "SSO handling" and
   * a part wrote "single sign-on (SSO) handling", and listing both twice over turned one real
   * meeting's half-dozen subjects into twenty-two.
   */
  const topics = mergeTopics([...data.topics, ...facts.topics], TOPICS_MAX)

  /**
   * Who was in the meeting. **The user's own list wins**, because a recording has no speaker labels
   * and nothing read out of the transcript can be more certain than the person who was there; with
   * no list, the spellings the transcription heard are folded into one entry each (see
   * lib/meetingPeople.ts). Every owner is then read in those same names, so a task never says
   * "notify Rafa" about the person reading it, or belongs to "Unnamed speaker 1".
   */
  const people = options.people ?? []
  const participants = people.length > 0 ? participantsFromPeople(people) : foldParticipants(facts.participants, SITE_AUTHOR)
  // A speaker the recording never named is still a person in the room, so the count is of everyone
  // the meeting had; only the names it could not learn are left unnamed (lib/meetingPeople.ts)

  return {
    title: trimTitle(options.userTitle || data.title) || "Untitled meeting",
    analysis: {
      /**
       * Why the meeting happened, as the model read **the whole of it**; what one part said is the
       * fallback. It used to be the other way round, which meant the first part always settled it:
       * a recording that opens with greetings gave "Start of the meeting" as the purpose of an hour
       * about billing and staging. Every other field still takes the parts first, because those are
       * things that were said rather than things to judge.
       */
      purpose: data.purpose?.trim() || facts.purpose || null,
      topics,
      participants,
      // The count follows the people actually listed, so the two can never disagree
      participantCount: participants.length,
      myTasks: withKnownOwners(facts.myTasks, participants, SITE_AUTHOR, people.length > 0),
      clientRequests: facts.clientRequests,
      // Arranging the call reads exactly like an agreement, so it is taken out here rather than
      // left to a rule the model follows on one run and not the next
      myDecisions: workDecisions(facts.myDecisions),
      decisions: workDecisions(facts.decisions),
      actionItems: withKnownOwners(facts.actionItems, participants, SITE_AUTHOR, people.length > 0),
      // With nothing to summarise the model rightly writes nothing, so the notes say so plainly
      minutes: data.minutes.trim() || MEETING_MESSAGES.nothingDiscussed,
      unknowns: facts.unknowns,
    },
  }
}
