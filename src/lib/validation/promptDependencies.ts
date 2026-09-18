import { z } from "zod"
import { DEPENDENCY_FILTERS, MAX_DEPENDENCIES, PROMPT_DEPENDENCY_MESSAGES } from "@/constants/promptDependencies"
import { blankToEmpty, choiceParam, searchParam } from "./listFilters"

/**
 * What a prompt may be told to wait for, and what the history page may ask for. The ids are checked
 * for shape here and for existence, ownership and loops in the service, which is the only place that
 * can know them.
 */

const RecordId = z.string().regex(/^[0-9a-f]{24}$/, PROMPT_DEPENDENCY_MESSAGES.missing)

/** The prompts one prompt waits for: record ids, at most MAX_DEPENDENCIES of them. */
export const DependencyIdsSchema = z.array(RecordId).max(MAX_DEPENDENCIES, PROMPT_DEPENDENCY_MESSAGES.tooMany)

const DEPENDENCY_STATES = DEPENDENCY_FILTERS.map((filter) => filter.id) as [string, ...string[]]

/** The dependency filter: one of the three states, or "" for prompts in any state. */
export const dependencyStateParam = choiceParam(DEPENDENCY_STATES)

/** What the picker asks for: a search, the prompt being edited (never offered), and what it waits for already. */
export const DependencyChoicesQuerySchema = z.object({
  search: searchParam,
  exclude: z.preprocess(blankToEmpty, z.union([z.literal(""), RecordId]).catch("")),
  // The ids it already waits for, so they are shown as picked even when the search hides them
  include: z.preprocess(
    (value) => (typeof value === "string" && value ? value.split(",").slice(0, MAX_DEPENDENCIES) : []),
    z.array(z.string()).transform((ids) => ids.filter((id) => RecordId.safeParse(id).success))
  ),
})
