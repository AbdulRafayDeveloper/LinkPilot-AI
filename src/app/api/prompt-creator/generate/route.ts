import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { UserFacingError, toUserFacingMessage } from "@/lib/errors"
import { PROMPT_CREATOR_MESSAGES, PROMPT_TARGET_IDS, REQUEST_MAX_LENGTH } from "@/constants/promptCreator"
import { PROJECTS_TOOL, PROMPT_PROJECT_MESSAGES } from "@/constants/promptProjects"
import { isFeatureDisabled } from "@/lib/featureAccess"
import { createPrompt } from "@/services/promptCreator/generate"
import { saveCreatedPrompt } from "@/services/promptCreator/records"
import { ensureProjectFolder, projectForPrompt } from "@/services/promptCreator/projects"
import { appendInstructions } from "@/lib/promptInstructions"
import { ProjectIdSchema } from "@/lib/validation/promptProjects"
import { requireViewer } from "@/services/auth/viewer"
import { runAiRequest, withSource } from "@/services/modelPriority"
import { withIdempotency } from "@/services/idempotency"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const GenerateSchema = z.object({
  request: z
    .string({ error: PROMPT_CREATOR_MESSAGES.missingRequest })
    .trim()
    .min(1, PROMPT_CREATOR_MESSAGES.missingRequest)
    .max(REQUEST_MAX_LENGTH, PROMPT_CREATOR_MESSAGES.requestTooLong),
  target: z.enum(PROMPT_TARGET_IDS, { error: PROMPT_CREATOR_MESSAGES.missingTarget }),
  // Only for the record: whether the description was spoken or typed
  requestSource: z.enum(["text", "voice"]).optional().default("text"),
  // The project this prompt is for: its instructions go on the end and it is filed under it
  projectId: ProjectIdSchema.optional().default(null),
  // A prompt to work with now and not keep: nothing is written to the database, whatever project
  // it was written for
  temporary: z.boolean().optional().default(false),
})

/**
 * POST: Writes one ready-to-paste prompt from the described task, using the latest saved
 * prompt for the chosen target, and saves it with its auto-written name.
 */
async function handlePost(req: NextRequest) {
  const auth = await requireViewer()
  if (auth.denied) return auth.denied
  try {
    const body = await req.json().catch(() => null)
    const parsed = GenerateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || PROMPT_CREATOR_MESSAGES.missingRequest },
        { status: 400 }
      )
    }

    const { request, target, requestSource, temporary } = parsed.data
    // With Projects turned off for this account, a project id left in the browser from before counts
    // for nothing: the prompt is still written, only without a project's instructions on the end
    const projectId = isFeatureDisabled(auth.viewer, PROJECTS_TOOL.id) ? null : parsed.data.projectId
    // Read first, so a project that is gone is refused before a model is called
    const project = await projectForPrompt(auth.viewer, projectId)
    const written = withSource(await runAiRequest(auth.viewer, "prompt-creator", () => createPrompt({ request, target, requestSource, signal: req.signal })))
    // The project's standing instructions end every prompt written in it, saved or not
    const created = { ...written, prompt: appendInstructions(written.prompt, project?.instructions ?? "") }

    if (temporary) {
      // Nothing is stored: the prompt lives on the page until it is replaced or the page is reset
      const now = new Date().toISOString()
      return NextResponse.json({
        success: true,
        message: "Prompt created. It is not saved.",
        data: {
          ...created,
          id: "",
          request,
          requestSource,
          folderId: null,
          projectId: project?.id ?? null,
          createdAt: now,
          updatedAt: now,
        },
      })
    }

    // A prompt written in a project is filed in that project's folder, made now if it is missing
    const folderId = project ? await ensureProjectFolder(auth.viewer, project) : null
    const saved = await saveCreatedPrompt(auth.viewer, created, { text: request, source: requestSource }, project?.id ?? null, folderId)
    return NextResponse.json({ success: true, message: "Prompt created", data: saved })
  } catch (error: unknown) {
    if (req.signal.aborted) {
      return NextResponse.json({ success: false, message: "Request cancelled" }, { status: 499 })
    }
    // A project that was deleted meanwhile is the caller's to fix, not a failure of the module
    if (error instanceof UserFacingError && error.message === PROMPT_PROJECT_MESSAGES.notFound) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    }
    console.error("POST Prompt Creator Generate Exception:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, message: toUserFacingMessage(error, PROMPT_CREATOR_MESSAGES.generationFailed) },
      { status: 500 }
    )
  }
}

// A retry of the same request (same Idempotency-Key) gets the first answer back instead of running again
export const POST = withIdempotency("prompt-creator:generate", handlePost)
