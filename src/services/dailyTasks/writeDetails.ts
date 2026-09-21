import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage } from "@/services/promptComposer"
import { asUserFacingError, toUserFacingMessage } from "@/lib/errors"
import { WriteDetailsSchema } from "@/lib/validation/taskAttachment"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"
import { findPlaceholders } from "@/lib/generatedText"
import { TASK_ATTACHMENT_MESSAGES, TASK_DESCRIPTION_MAX_LENGTH } from "@/constants/taskAttachments"

/**
 * Writes the details of a task with AI: from its own line, the tasks it sits under and anything
 * already written, a short note on what done looks like and the steps to get there, as formatted
 * text (lib/richText.ts) the details editor shows as it reads. Used by Daily Tasks and by an
 * employee's plan alike; the route decides which module's model order it runs in.
 *
 * The rules are the fixed `task-details-system` prompt: nothing is invented (no names, numbers,
 * dates or tools the task doesn't give), and a vague task gets plain, general steps rather than a
 * made-up plan. Nothing is saved here: the page shows the text in the editor, where it is saved like
 * anything typed.
 */

// Well under the field's limit, so what comes back always fits and leaves room to add to it
const TARGET_CHARS = Math.floor(TASK_DESCRIPTION_MAX_LENGTH * 0.6)
const WRITING_TEMPERATURE = 0.3

const DetailsSchema = z.object({
  details: z.string().describe("The task's details as short formatted text: one line on what done looks like, then the steps as a list"),
})

export interface WriteDetailsInput {
  // The task's own line
  title: string
  // The tasks above it, the top one first, so a subtask is written about in its context
  parents: string[]
  // Whatever is already written, which the new text builds on rather than contradicts
  description: string
  signal?: AbortSignal
}

function problemWith(details: string): string | null {
  if (!details.trim()) return "It is empty. Write the details."
  if (details.length > TASK_DESCRIPTION_MAX_LENGTH) return `It is ${details.length} characters. Keep it under ${TARGET_CHARS}.`
  const placeholders = findPlaceholders(details)
  if (placeholders.length > 0) return `It has placeholders to fill in (${placeholders.join(", ")}). Write it without any.`
  return null
}

export async function writeTaskDetails({ title, parents, description, signal }: WriteDetailsInput): Promise<{ details: string }> {
  const system = renderPrompt(await loadPrompt("task-details-system"), { MAX_CHARS: TARGET_CHARS })
  const user = composePromptMessage("", [
    { variable: "task", tag: "task", label: "The task", content: title },
    { variable: "parents", tag: "parent_tasks", label: "The tasks it sits under, the top one first", content: parents.join("\n"), emptyText: "None: it is a task of its own." },
    { variable: "written", tag: "written_so_far", label: "What is already written about it", content: description, emptyText: "Nothing yet." },
  ])
  const { data } = await generateStructuredWithFallback({
    schema: DetailsSchema,
    name: "task_details",
    messages: [new SystemMessage(system), new HumanMessage(user)],
    temperature: WRITING_TEMPERATURE,
    signal,
    validate: (draft) => problemWith(draft.details),
  }).catch((error: unknown) => {
    if (signal?.aborted) throw error
    console.error("❌ Task details writing failed:", error instanceof Error ? error.message : error)
    throw asUserFacingError(error, TASK_ATTACHMENT_MESSAGES.generateFailed)
  })
  return { details: data.details.trim() }
}

/**
 * The whole request, for the two routes that offer it (Daily Tasks and an employee's plan): checked,
 * run in that module's model order with its usage counted, and answered with the text and which
 * provider wrote it. Nothing is saved; the page puts the text in the editor.
 */
export async function answerWriteDetails(req: NextRequest, module: "daily-tasks" | "employees"): Promise<NextResponse> {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  const parsed = WriteDetailsSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || TASK_ATTACHMENT_MESSAGES.generateFailed }, { status: 400 })
  }
  try {
    const answer = await runAiRequest(auth.viewer, module, () => writeTaskDetails({ ...parsed.data, signal: req.signal }))
    return NextResponse.json({ success: true, message: "Details written", data: withSource(answer) })
  } catch (error: unknown) {
    console.error("POST Write Task Details Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: toUserFacingMessage(error, TASK_ATTACHMENT_MESSAGES.generateFailed) }, { status: 500 })
  }
}
