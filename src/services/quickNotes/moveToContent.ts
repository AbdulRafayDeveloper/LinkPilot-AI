import { connectDatabase } from "@/lib/db"
import { CONTENT_IMAGES } from "@/lib/contentImages"
import { NOTE_IMAGES } from "@/lib/noteImages"
import { QuickNote as QuickNoteModel } from "@/models/QuickNote"
import { createEntry } from "@/services/importantContent/entries"
import { copyImagesInto } from "@/services/storage/storedImages"
import { visibleById } from "@/services/auth/viewer"
import type { ImportantContentInput } from "@/types/importantContent"
import type { MovedNote } from "@/types/quickNotes"
import type { Viewer } from "@/types/auth"
import { deleteNote } from "./notes"

/**
 * A Quick Note taken into Important Content: the entry is saved with the name, type, text and folder
 * the dialog chose (the text as the user left it, which started as the note), and then the note goes.
 *
 * **The images go with it, as copies.** A note's images are attachments of the note and are removed
 * when it is deleted, and an entry's images are served by Important Content's own route, so the
 * entry names copies made under that module's store (`copyImagesInto`) and never the note's own.
 * The order is what makes a failure safe: the copies and the entry come first, and the note is
 * deleted last, so a move that fails part way leaves the note where it was. A note that is still
 * there after the entry was saved (its delete failed) is reported as kept rather than hidden, since
 * a retry would make a second entry.
 */
export async function moveNoteToContent(viewer: Viewer, noteId: string, input: ImportantContentInput): Promise<MovedNote | null> {
  const filter = visibleById(viewer, noteId)
  if (!filter) return null
  await connectDatabase()
  if (!(await QuickNoteModel.exists(filter))) return null
  const description = await copyImagesInto(NOTE_IMAGES, CONTENT_IMAGES, viewer, input.description)
  const entry = await createEntry(viewer, { ...input, description })
  let noteDeleted = false
  try {
    noteDeleted = await deleteNote(viewer, noteId)
  } catch (error: unknown) {
    console.error("Moved note could not be deleted from Quick Notes:", error instanceof Error ? error.message : error)
  }
  return { entry, noteDeleted }
}
