import { z } from "zod"
import { MEETING_LINK_MESSAGES, MEETING_MESSAGES, MEETING_TITLE_MAX_LENGTH, TRANSCRIPT_MAX_LENGTH } from "@/constants/meetings"

/**
 * One meeting as the API accepts it. The name is optional, because the analysis writes one when
 * the user does not. The transcript is kept exactly as pasted, apart from trimming the ends.
 */
export const MeetingSchema = z.object({
  title: z.string().trim().max(MEETING_TITLE_MAX_LENGTH, MEETING_MESSAGES.titleTooLong).optional(),
  transcript: z
    .string({ error: MEETING_MESSAGES.missingTranscript })
    .trim()
    .min(1, MEETING_MESSAGES.missingTranscript)
    .max(TRANSCRIPT_MAX_LENGTH, MEETING_MESSAGES.transcriptTooLong),
})

/** Making, replacing or turning off a meeting's share link. */
export const MeetingLinkSchema = z.object({
  action: z.enum(["create", "replace", "disable"], { error: MEETING_LINK_MESSAGES.failed }),
})
