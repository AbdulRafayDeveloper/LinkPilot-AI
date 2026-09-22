import { z } from "zod"
import { NOTE_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH, QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"

/**
 * A note as it is saved or edited: the content is required, the title optional (a note saved without
 * one, like every note saved before titles existed, has ""). Used by the save (POST) and the auto-save
 * of an edit (PUT), so both refuse exactly the same things.
 */
export const QuickNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .max(NOTE_TITLE_MAX_LENGTH, QUICK_NOTES_MESSAGES.titleTooLong)
    .optional()
    .default(""),
  content: z
    .string({ error: QUICK_NOTES_MESSAGES.missingContent })
    .trim()
    .min(1, QUICK_NOTES_MESSAGES.missingContent)
    .max(NOTE_MAX_LENGTH, QUICK_NOTES_MESSAGES.contentTooLong),
})

export type QuickNoteFields = z.infer<typeof QuickNoteSchema>
