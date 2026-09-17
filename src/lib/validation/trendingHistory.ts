import { z } from "zod"
import {
  NO_FORMAT_FILTER,
  SAVED_TOPIC_STATUS_IDS,
  SAVED_TOPIC_TITLE_MAX_LENGTH,
  TRENDING_HISTORY_CATEGORY_MAX_LENGTH,
  TRENDING_HISTORY_MESSAGES,
  TRENDING_POST_FORMAT_IDS,
} from "@/constants/trending"
import { DATE_ORDER_ISSUE, blankToEmpty, choiceParam, dayBoundParam, inDateOrder, searchParam } from "./listFilters"

/**
 * The query string of the saved topics list. Every field is optional, and anything unreadable
 * is refused with a message rather than silently ignored, so a filter never looks applied when
 * it was not.
 */
export const SavedTopicsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100_000).catch(1),
    search: searchParam,
    category: z.preprocess(blankToEmpty, z.string().max(TRENDING_HISTORY_CATEGORY_MAX_LENGTH)),
    format: choiceParam([NO_FORMAT_FILTER, ...TRENDING_POST_FORMAT_IDS]),
    status: choiceParam(SAVED_TOPIC_STATUS_IDS),
    from: dayBoundParam,
    to: dayBoundParam,
  })
  .refine(inDateOrder, DATE_ORDER_ISSUE)

/** Names one saved topic within its search, for opening it in full or deleting it. */
export const SavedTopicKeySchema = z.object({
  title: z.string({ error: TRENDING_HISTORY_MESSAGES.topicGone }).min(1, TRENDING_HISTORY_MESSAGES.topicGone).max(SAVED_TOPIC_TITLE_MAX_LENGTH, TRENDING_HISTORY_MESSAGES.topicGone),
})
