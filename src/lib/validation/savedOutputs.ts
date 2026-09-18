import { z } from "zod"
import type { SavedOutputTool } from "@/constants/savedOutputs"
import { IN_ANY_FOLDER, UNFILED_FOLDER } from "@/constants/promptFolders"
import { dependencyStateParam } from "./promptDependencies"
import { DATE_ORDER_ISSUE, blankToEmpty, choiceParam, dayBoundParam, inDateOrder, searchParam } from "./listFilters"
import { HISTORY_PAGE_SIZE } from "@/constants/historyFilters"

// The ids one of the tool's filters accepts, or none when the tool has no such filter
function filterIds(tool: SavedOutputTool, key: "option" | "context"): [string, ...string[]] | null {
  const ids = tool.filters.find((filter) => filter.key === key)?.options.map((option) => option.id) ?? []
  return ids.length > 0 ? (ids as [string, ...string[]]) : null
}

const noChoice = z.preprocess(blankToEmpty, z.literal(""))
// A client id or a language name: whatever the records hold, so only its length is checked
const recordChoice = z.preprocess(blankToEmpty, z.string().max(80))

function filterParam(tool: SavedOutputTool, key: "option" | "context") {
  if (tool.filters.find((filter) => filter.key === key)?.fromServer) return recordChoice
  const ids = filterIds(tool, key)
  return ids ? choiceParam(ids) : noChoice
}

/**
 * The query string of one tool's saved outputs. The tone, type, style or context must be one the
 * tool really has, so a mistyped filter is refused instead of quietly matching nothing, and an
 * unreadable page number is page 1.
 */
export function savedOutputsQuerySchema(tool: SavedOutputTool) {
  return z
    .object({
      page: z.coerce.number().int().min(1).max(100_000).catch(1),
      search: searchParam,
      option: filterParam(tool, "option"),
      context: filterParam(tool, "context"),
      // A folder id, "in-folder" for the records in any folder, "none" for the records in no folder,
      // and nothing at all for a tool without folders
      folder: tool.folders
        ? z.preprocess(
            blankToEmpty,
            z
              .union([z.literal(""), z.literal(IN_ANY_FOLDER), z.literal(UNFILED_FOLDER), z.string().regex(/^[0-9a-f]{24}$/)])
              .catch("")
          )
        : z.preprocess(blankToEmpty, z.literal("")),
      // Independent, ready or blocked, and nothing at all for a tool whose records never wait
      dependencies: tool.dependencies
        ? dependencyStateParam.catch("")
        : z.preprocess(blankToEmpty, z.literal("")),
      from: dayBoundParam,
      to: dayBoundParam,
    })
    .refine(inDateOrder, DATE_ORDER_ISSUE)
}

// At most one page of records can be ticked at a time, so a named delete is never unbounded
const RecordId = z.string().regex(/^[0-9a-f]{24}$/)

/**
 * What a bulk delete covers: the records named by `ids`, or every record the filters cover when
 * `all` is true. One or the other, never neither, so a delete always says what it means.
 */
export const savedOutputsDeleteSchema = z
  .object({ ids: z.array(RecordId).min(1).max(HISTORY_PAGE_SIZE).optional(), all: z.boolean().optional() })
  .refine((body) => (body.ids === undefined) !== (body.all !== true), "Choose the records to delete, or delete everything the filters cover.")
