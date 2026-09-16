import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { UserFacingError } from "@/lib/errors"
import { cleanGeneratedText, stripMarkdownMarks } from "@/lib/generatedText"
import { CLIENT_VOICES_MESSAGES, TASK_LIST_MAX, VOICE_BATCH_MAX } from "@/constants/clientVoices"
import type { ClientTask, TaskExtraction, TranscriptInput } from "@/types/clientVoices"
import { getClientVoicesPrompt } from "./prompts"

/**
 * Reads the client's transcripts and writes down the work they asked for.
 *
 * Only text reaches this step. The transcripts arrive in the request, the list goes back in the
 * answer, and nothing is written to the database, which is the whole point of the module: the
 * client's voice never becomes a stored record anywhere.
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
  return null
}

interface ExtractOptions {
  voices: TranscriptInput[]
  missingVoices: number[]
  signal: AbortSignal
}

/**
 * One list for the whole batch, not one per voice. The same request made in three voices
 * becomes one task carrying all three numbers, and anything the client only mentioned in
 * passing stays out of it.
 *
 * A batch where some voices failed still produces a list from the ones that worked, and the
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
    throw new UserFacingError(CLIENT_VOICES_MESSAGES.tasksFailed)
  })

  const available = new Set(voices.map((entry) => entry.voice))
  const tasks: ClientTask[] = data.tasks
    .map((entry) => ({ task: clean(entry.task), voices: knownVoices(entry.voices, available) }))
    .filter((entry) => entry.task.length >= MIN_TASK_LENGTH)

  // Lengths only: what a client said is theirs, so none of it goes to the log
  console.info(
    "Client voice tasks extracted:",
    JSON.stringify({
      provider,
      transcripts: voices.length,
      missing: missingVoices.length,
      tasks: tasks.length,
      characters: voices.reduce((total, entry) => total + entry.transcript.length, 0),
    })
  )

  return { tasks, missingVoices: [...new Set(missingVoices)].sort((a, b) => a - b) }
}
