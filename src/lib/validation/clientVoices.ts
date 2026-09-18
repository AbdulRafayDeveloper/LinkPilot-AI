import { z } from "zod"
import { TASK_LIST_MAX, TRANSCRIPT_MAX_LENGTH, VOICE_BATCH_MAX } from "@/constants/clientVoices"

/**
 * What the task step accepts: the transcripts, each with the voice it came from. Only text
 * crosses this boundary, and the audio itself never reaches this route. A batch with a client is
 * kept with that client; without one, nothing is stored.
 */
export const TranscriptBatchSchema = z.object({
  voices: z
    .array(
      z.object({
        voice: z.number().int().min(1).max(VOICE_BATCH_MAX),
        transcript: z.string().trim().min(1).max(TRANSCRIPT_MAX_LENGTH),
      })
    )
    .min(1, "There are no transcripts to take tasks from.")
    .max(VOICE_BATCH_MAX, `Up to ${VOICE_BATCH_MAX} voice messages at a time.`),
  // Voices that failed, so the answer can say the list was made without them
  missingVoices: z.array(z.number().int().min(1).max(VOICE_BATCH_MAX)).max(VOICE_BATCH_MAX).optional().default([]),
  // The client this batch belongs to, when one was chosen: the list is then kept with that client
  clientId: z.string().trim().max(60).optional(),
  // The voices already kept for it, so the saved list points back at the recordings it was made from
  voiceIds: z.array(z.string().trim().max(60)).max(VOICE_BATCH_MAX).optional().default([]),
})

/** The user's own wording of a saved task list. */
/** The client chosen on the page: one of the viewer's clients by id, or "" for none. */
export const ClientChoiceSchema = z.object({
  clientId: z.union([z.literal(""), z.string().regex(/^[0-9a-f]{24}$/)]),
})

export const EditTasksSchema = z.object({
  tasks: z
    .array(
      z.object({
        task: z.string().trim().min(1, "A task can not be empty.").max(TRANSCRIPT_MAX_LENGTH),
        voices: z.array(z.number().int().min(1).max(VOICE_BATCH_MAX)).max(VOICE_BATCH_MAX).optional().default([]),
      })
    )
    .max(TASK_LIST_MAX),
})
