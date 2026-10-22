import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { UserFacingError, asUserFacingError } from "@/lib/errors"
import { cleanGeneratedText, stripMarkdownMarks } from "@/lib/generatedText"
import { CLIENT_VOICES_MESSAGES, QUESTION_LIST_MAX, TASK_LIST_MAX, VOICE_BATCH_MAX } from "@/constants/clientVoices"
import type { ClientQuestion, ClientTask, TaskExtraction, TranscriptInput } from "@/types/clientVoices"
import { getClientVoicesPrompt } from "./prompts"

/**
 * Reads the client's transcripts and writes down **two** things: the work they asked for, and the
 * questions they asked.
 *
 * They are kept apart on purpose, at the owner's request. A task is something to do and a question
 * is something to answer, so folding a question into the task list either loses it or turns it into
 * work nobody asked for. The same rules apply to both: one entry per distinct thing, the same thing
 * asked in three voices becomes one entry carrying all three numbers, and nothing is invented.
 *
 * Only text reaches this step: the transcripts arrive in the request and the lists go back in the
 * answer. Saving them against the batch is the route's own job (`services/clientVoices/batches.ts`).
 */

// Taking down what someone asked for leaves no room for invention
const EXTRACTION_TEMPERATURE = 0.2
const MIN_TASK_LENGTH = 8

const TaskListSchema = z.object({
  tasks: z
    .array(
      z.object({
        task: z
          .string()
          .describe("One thing the client asked for, written as an instruction to carry out, in clear English"),
        voices: z
          .array(z.number().int())
          .describe("The voice numbers this was asked in, 1-based. More than one when the same thing was asked twice"),
      })
    )
    .describe("Every distinct thing the client asked for, in the order they first asked for it"),
  questions: z
    .array(
      z.object({
        question: z
          .string()
          .describe("One thing the client asked about and wants an answer to, written as a clear question in English"),
        voices: z
          .array(z.number().int())
          .describe("The voice numbers it was asked in, 1-based. More than one when the same thing was asked twice"),
      })
    )
    .describe(
      "Every question the client asked that is waiting for an answer, in the order they first asked it. A question is never also a task"
    ),
})

type TaskListOutput = z.infer<typeof TaskListSchema>

const clean = (raw: string) => stripMarkdownMarks(cleanGeneratedText(raw)).replace(/^[-*\d.\s]+/, "").trim()

/**
 * Keeps the voice numbers that were really in the batch. A number the model invented would put
 * a task against a voice the client never sent.
 */
const knownVoices = (voices: number[], available: Set<number>) => [...new Set(voices)].filter((voice) => available.has(voice)).sort((a, b) => a - b)

function findUnusableReason(output: TaskListOutput): string | null {
  if (output.tasks.length > TASK_LIST_MAX) return `more than ${TASK_LIST_MAX} tasks, which is not a task list any more`
  const empty = output.tasks.filter((entry) => clean(entry.task).length < MIN_TASK_LENGTH)
  if (empty.length > 0) return `${empty.length} task(s) are empty or too short to act on`
  // A batch with no questions in it is ordinary, so only an absurdly long list is a problem
  if ((output.questions ?? []).length > QUESTION_LIST_MAX) {
    return `more than ${QUESTION_LIST_MAX} questions, which is not a list of what the client asked`
  }
  return null
}

interface ExtractOptions {
  voices: TranscriptInput[]
  missingVoices: number[]
  signal: AbortSignal
}

/**
 * Two lists for the whole batch, not one per voice. The same request made in three voices becomes
 * one task carrying all three numbers, and anything the client only mentioned in passing stays out
 * of it; a question they asked lands in the questions list instead of being lost or turned into work.
 *
 * A batch where some voices failed still produces both lists from the ones that worked, and the
 * answer names the voices it could not read, so the page never presents a partial list as the
 * whole picture.
 */
export async function extractTasks({ voices, missingVoices, signal }: ExtractOptions): Promise<TaskExtraction> {
  if (voices.length === 0) throw new UserFacingError(CLIENT_VOICES_MESSAGES.noTranscripts)

  const { prompt } = await getClientVoicesPrompt()
  const system = renderPrompt(await loadPrompt("client-voice-tasks-system"), {
    VOICE_COUNT: voices.length,
    MAX_TASKS: TASK_LIST_MAX,
    MAX_VOICES: VOICE_BATCH_MAX,
  })
  const transcripts = voices
    .sort((a, b) => a.voice - b.voice)
    .map((entry) => `Voice ${entry.voice}:\n${entry.transcript.trim()}`)
    .join("\n\n")

  const user = composePromptMessage(
    prompt,
    [
      {
        variable: "transcripts",
        tag: "client_voice_transcripts",
        label: "What the client said, one block per voice message",
        content: transcripts,
      },
    ],
    { voice_count: String(voices.length) }
  )

  const { data, provider } = await generateStructuredWithFallback({
    schema: TaskListSchema,
    name: "client_voice_tasks",
    messages: [new SystemMessage(system), new HumanMessage(user)],
    temperature: EXTRACTION_TEMPERATURE,
    signal,
    validate: findUnusableReason,
  }).catch((error: unknown) => {
    if (signal.aborted) throw error
    console.error("❌ Client voice task extraction failed:", error instanceof Error ? error.message : error)
    throw asUserFacingError(error, CLIENT_VOICES_MESSAGES.tasksFailed)
  })

  const available = new Set(voices.map((entry) => entry.voice))
  const tasks: ClientTask[] = data.tasks
    .map((entry) => ({ task: clean(entry.task), voices: knownVoices(entry.voices, available) }))
    .filter((entry) => entry.task.length >= MIN_TASK_LENGTH)
  const questions: ClientQuestion[] = (data.questions ?? [])
    .map((entry) => ({ question: clean(entry.question), voices: knownVoices(entry.voices, available) }))
    .filter((entry) => entry.question.length >= MIN_TASK_LENGTH)
    .slice(0, QUESTION_LIST_MAX)

  // Lengths only: what a client said is theirs, so none of it goes to the log
  console.info(
    "Client voice tasks extracted:",
    JSON.stringify({
      provider,
      transcripts: voices.length,
      missing: missingVoices.length,
      tasks: tasks.length,
      questions: questions.length,
      characters: voices.reduce((total, entry) => total + entry.transcript.length, 0),
    })
  )

  return { tasks, questions, missingVoices: [...new Set(missingVoices)].sort((a, b) => a - b) }
}
