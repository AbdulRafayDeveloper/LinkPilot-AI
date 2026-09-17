import { z } from "zod"
import type { SavedOutputTool } from "@/constants/savedOutputs"
import { UNFILED_FOLDER } from "@/constants/promptFolders"
import { DATE_ORDER_ISSUE, blankToEmpty, choiceParam, dayBoundParam, inDateOrder, searchParam } from "./listFilters"

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
      // A folder id, "none" for the records in no folder, and nothing at all for a tool without folders
      folder: tool.folders
        ? z.preprocess(blankToEmpty, z.union([z.literal(""), z.literal(UNFILED_FOLDER), z.string().regex(/^[0-9a-f]{24}$/)]).catch(""))
        : z.preprocess(blankToEmpty, z.literal("")),
      from: dayBoundParam,
      to: dayBoundParam,
    })
    .refine(inDateOrder, DATE_ORDER_ISSUE)
}
