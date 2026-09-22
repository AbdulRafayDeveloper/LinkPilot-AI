import { z } from "zod"
import { COMMENT_TUNE_IDS, currentTuneId } from "@/constants/commentWriter"

/**
 * A Comment Writer tune id as the routes accept it: any current tune, or a renamed tune's old id
 * (RENAMED_COMMENT_TUNES), read as its new one, so a browser or link from before the rename still works.
 */
export const commentTuneSchema = (message?: string) =>
  z.preprocess((value) => (typeof value === "string" ? currentTuneId(value) : value), z.enum(COMMENT_TUNE_IDS, message ? { error: message } : undefined))
