import { COMMENT_TUNE_IDS, RENAMED_COMMENT_TUNES } from "@/constants/commentWriter"
import { idWithRenamesSchema } from "./renamedIds"

/**
 * A Comment Writer tune id as the routes accept it: any current tune, or a renamed tune's old id
 * (RENAMED_COMMENT_TUNES), read as its new one, so a browser or link from before the rename still works.
 */
export const commentTuneSchema = (message?: string) => idWithRenamesSchema(COMMENT_TUNE_IDS, RENAMED_COMMENT_TUNES, message)
