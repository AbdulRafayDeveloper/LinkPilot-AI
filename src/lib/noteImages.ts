import { defineStoredImages } from "./storedImages"

/**
 * Images inside a Quick Note, served by `/api/quick-notes/images/<owner>/<file>` and kept under
 * `LinkPilot/quick-notes/<owner>/`. Named the same way as Important Content's (lib/storedImages.ts).
 */
export const NOTE_IMAGES = defineStoredImages("/api/quick-notes/images", "LinkPilot/quick-notes")
