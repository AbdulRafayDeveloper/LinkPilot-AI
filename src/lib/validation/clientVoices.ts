import { z } from "zod"
import {
  BATCH_TITLE_MAX_LENGTH,
  CLEAR_POINTS_MAX,
  CLEAR_POINT_MAX_LENGTH,
  QUESTION_LIST_MAX,
  TASK_LIST_MAX,
  TRANSCRIPT_MAX_LENGTH,
  VOICE_BATCH_MAX,
} from "@/constants/clientVoices"
import { DATE_ORDER_ISSUE, dayBoundParam, inDateOrder, searchParam } from "./listFilters"

/**
 * What crosses the boundary into Client Voices. Only text and the audio itself ever do: the
 * transcripts go to the task step in the body, and a recording goes to its own route as bytes.
 *
 * Every batch is kept, so the client is **optional** everywhere here: it says whose batch it is,
 * not whether one is saved.
 */

const ID = /^[0-9a-f]{24}$/
const batchId = z.string().regex(ID)
/** A client's id, or "" for a batch kept under no client. */
const clientId = z.union([z.literal(""), z.string().regex(ID)])
/** The batch's own name. Empty is ordinary: a title is then written from the voices. */
const title = z.string().trim().max(BATCH_TITLE_MAX_LENGTH)

/** Starting a batch: how many voices went in, whose batch it is, and what it is called. */
export const StartBatchSchema = z.object({
  clientId: clientId.optional().default(""),
  title: title.optional().default(""),
  voiceCount: z.coerce.number().int().min(1).max(VOICE_BATCH_MAX),
})

/**
 * What the task step accepts: the transcripts, each with the voice it came from, and the batch they
 * belong to. `batchId` is optional, so a page written before batches existed still works: with a
 * client and no batch, one is started for it.
 */
export const TranscriptBatchSchema = z.object({
  voices: z
    .array(
      z.object({
        voice: z.number().int().min(1).max(VOICE_BATCH_MAX),
        transcript: z.string().trim().min(1).max(TRANSCRIPT_MAX_LENGTH),
        // The kept voice this transcript belongs to, so its clear words are written onto it. Left
        // out by a page from before, which simply gets the clear words in the answer and no more
        voiceId: z.string().regex(ID).optional(),
      })
    )
    .min(1, "There are no transcripts to take tasks from.")
    .max(VOICE_BATCH_MAX, `Up to ${VOICE_BATCH_MAX} voice messages at a time.`),
  // Voices that failed, so the answer can say the lists were made without them
  missingVoices: z.array(z.number().int().min(1).max(VOICE_BATCH_MAX)).max(VOICE_BATCH_MAX).optional().default([]),
  // The batch these transcripts belong to: the lists are written onto it
  batchId: batchId.optional(),
  // The client the batch is kept under, when one was chosen
  clientId: clientId.optional(),
  // The voices already kept, so the batch points back at the recordings its lists were made from
  voiceIds: z.array(z.string().trim().max(60)).max(VOICE_BATCH_MAX).optional().default([]),
  // The user's own name for the batch, which wins over the one written from the voices
  title: title.optional().default(""),
  // True runs the batch without writing anything down: no batch, no recordings, no lists
  temporary: z.boolean().optional().default(false),
})

/**
 * The page's own choices: the client a batch is kept under ("" for none), and whether a batch is
 * kept at all. Either may be sent on its own, so changing one never says anything about the other.
 */
export const VoiceChoicesSchema = z
  .object({ clientId: clientId.optional(), isTemporary: z.boolean().optional() })
  .refine((body) => body.clientId !== undefined || body.isTemporary !== undefined, "There is no choice in that.")

/**
 * The user's own wording of a kept batch: its name, its tasks, its questions. **Each is written only
 * when it is named**, so renaming a batch can never carry a stale list over what another tab saved,
 * the rule a client project's items follow.
 */
export const EditTasksSchema = z
  .object({
    title: title.optional(),
    tasks: z
      .array(
        z.object({
          task: z.string().trim().min(1, "A task can not be empty.").max(TRANSCRIPT_MAX_LENGTH),
          voices: z.array(z.number().int().min(1).max(VOICE_BATCH_MAX)).max(VOICE_BATCH_MAX).optional().default([]),
        })
      )
      .max(TASK_LIST_MAX)
      .optional(),
    questions: z
      .array(
        z.object({
          question: z.string().trim().min(1, "A question can not be empty.").max(TRANSCRIPT_MAX_LENGTH),
          voices: z.array(z.number().int().min(1).max(VOICE_BATCH_MAX)).max(VOICE_BATCH_MAX).optional().default([]),
        })
      )
      .max(QUESTION_LIST_MAX)
      .optional(),
  })
  .refine((body) => body.title !== undefined || body.tasks !== undefined || body.questions !== undefined, "There is nothing to change in that.")

/**
 * The user's own wording of what one voice said: the transcript, the clear points, or both. Each is
 * written only when it is named, and emptying either is allowed; the recording stays either way.
 */
export const EditTranscriptSchema = z
  .object({
    transcript: z.string().trim().max(TRANSCRIPT_MAX_LENGTH).optional(),
    clearPoints: z.array(z.string().trim().max(CLEAR_POINT_MAX_LENGTH)).max(CLEAR_POINTS_MAX).optional(),
  })
  .refine((body) => body.transcript !== undefined || body.clearPoints !== undefined, "There is nothing to change in that.")

/**
 * The "view all" page's query: a search over what the client asked for and whose batch it is, one
 * client, and a date range the page builds from the viewer's own start and end of day. A backwards
 * range is refused rather than quietly returning nothing.
 */
export const BatchesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    search: searchParam.default(""),
    // A client's id, or "none" for the batches kept under no client, or "" for every batch
    client: z.preprocess((value) => (typeof value === "string" ? value.trim() : ""), z.string().max(24)).default(""),
    from: dayBoundParam.default(null),
    to: dayBoundParam.default(null),
  })
  .refine(inDateOrder, DATE_ORDER_ISSUE)
