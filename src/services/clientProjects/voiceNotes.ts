import mongoose from "mongoose"
import { UserFacingError } from "@/lib/errors"
import { detectAudioMimeType } from "@/lib/audioType"
import { PROJECT_TASK_MESSAGES, VOICE_NOTE_MAX_BYTES } from "@/constants/clientProjectTasks"
import { deleteObject, isStorageConfigured, presignDownload, putObject } from "@/services/storage/s3"
import type { VoiceNote, VoiceNoteView } from "@/types/clientProjectTasks"

/**
 * The voice note one task may carry. The browser records it and sends the bytes to the app, which
 * reads the container from the bytes themselves (never from what the browser calls it) and stores
 * it. Through the app rather than straight to storage, the same way a task image goes, because the
 * bucket refuses browser uploads from the live site.
 *
 * The key is always built here from an id the server makes, so nothing the browser sends can point
 * an upload at another object or out of the prefix, and the id says nothing about the task, the
 * project or the client it ends up on.
 */

const KEY_PREFIX = "LinkPilot/client-project-voice"

const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/flac": "flac",
}

const keyOf = (note: Pick<VoiceNote, "assetId" | "contentType">): string => `${KEY_PREFIX}/${note.assetId}.${EXTENSIONS[note.contentType] ?? "webm"}`

/** Whether a voice note can be recorded at all here, so a page can say so instead of failing oddly. */
export const canRecordVoiceNotes = isStorageConfigured

/**
 * Stores one recording and answers what to save on the task, with a link to play it from straight
 * away. Anything that isn't audio by its own bytes is refused, as is anything over the ceiling.
 */
export async function storeVoiceNote(bytes: Buffer, seconds: number): Promise<VoiceNoteView> {
  if (!isStorageConfigured()) throw new UserFacingError(PROJECT_TASK_MESSAGES.voiceStorageUnavailable)
  if (bytes.length > VOICE_NOTE_MAX_BYTES) throw new UserFacingError(PROJECT_TASK_MESSAGES.voiceTooLarge)
  const contentType = bytes.length > 0 ? detectAudioMimeType(bytes) : null
  if (!contentType) throw new UserFacingError(PROJECT_TASK_MESSAGES.voiceUnsupported)
  const note: VoiceNote = { assetId: new mongoose.Types.ObjectId().toString(), contentType, seconds: Math.max(0, Math.round(seconds)) }
  await putObject(keyOf(note), bytes, contentType)
  return { ...note, url: await presignDownload(keyOf(note), contentType) }
}

/**
 * A task's voice note with a short-lived link to play it from, or null when it has none. A link
 * that cannot be signed (storage switched off since it was saved) leaves the task readable rather
 * than failing the whole list.
 */
export async function voiceNoteView(note: VoiceNote | null | undefined): Promise<VoiceNoteView | null> {
  if (!note?.assetId || !isStorageConfigured()) return null
  try {
    // Built field by field, never spread: on the create path this is still a Mongoose subdocument,
    // and spreading one copies its internals instead of the three fields the page needs
    return {
      assetId: note.assetId,
      contentType: note.contentType,
      seconds: note.seconds ?? 0,
      url: await presignDownload(keyOf(note), note.contentType),
    }
  } catch (error: unknown) {
    console.warn("⚠️ Couldn't sign a voice note link:", error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Removes the stored recordings of tasks that have gone. A voice note is an attachment, so the
 * records go first and a storage failure is logged rather than failing the delete the user asked for.
 */
export async function deleteVoiceNotes(notes: readonly (VoiceNote | null | undefined)[]): Promise<void> {
  if (!isStorageConfigured()) return
  for (const note of notes) {
    if (!note?.assetId) continue
    try {
      await deleteObject(keyOf(note))
    } catch (error: unknown) {
      console.warn("⚠️ Couldn't remove a voice note:", error instanceof Error ? error.message : error)
    }
  }
}
