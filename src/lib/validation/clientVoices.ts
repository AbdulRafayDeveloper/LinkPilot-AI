import { z } from "zod"
import { TRANSCRIPT_MAX_LENGTH, VOICE_BATCH_MAX } from "@/constants/clientVoices"

/**
 * What the task step accepts: the transcripts, each with the voice it came from. Only text
 * crosses this boundary. The audio itself never reaches this route, and nothing is stored.
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
})
