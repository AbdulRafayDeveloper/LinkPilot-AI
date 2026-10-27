import { z } from "zod"
import { ACTIVITY_ACTION_IDS, ACTIVITY_OUTCOME_IDS, ACTIVITY_STATE_IDS } from "@/constants/activityLogs"
import { BulkDeleteSchema, DATE_ORDER_ISSUE, blankToEmpty, choiceParam, dayBoundParam, inDateOrder, searchParam } from "./listFilters"

/**
 * What an activity list may be asked for: a page, a search over what was done and from where, the
 * module, the action, the outcome and a date range, all applied in the database. An admin's list
 * also takes `state`, since only an admin ever sees what a person deleted.
 */

// A module is a tool id or a part of the app: a short word of letters, digits and hyphens
const moduleParam = z.preprocess(blankToEmpty, z.union([z.literal(""), z.string().regex(/^[a-z0-9-]{1,60}$/)]))

const ActivityQueryFields = {
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
  search: searchParam,
  module: moduleParam,
  action: choiceParam(ACTIVITY_ACTION_IDS),
  outcome: choiceParam(ACTIVITY_OUTCOME_IDS),
  from: dayBoundParam,
  to: dayBoundParam,
}

export const ActivityQuerySchema = z.object(ActivityQueryFields).refine(inDateOrder, DATE_ORDER_ISSUE)

export const AdminActivityQuerySchema = z
  .object({ ...ActivityQueryFields, state: choiceParam(ACTIVITY_STATE_IDS) })
  .refine(inDateOrder, DATE_ORDER_ISSUE)

export type ActivityQuery = z.infer<typeof ActivityQuerySchema>
export type AdminActivityQuery = z.infer<typeof AdminActivityQuerySchema>

// Deleting picked activities, or every one the filters cover: the shared bulk-delete body
export const ActivityDeleteSchema = BulkDeleteSchema
