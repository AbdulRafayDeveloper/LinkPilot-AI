import { z } from "zod"

/**
 * An option id (a tone, a tune) as a route accepts it: any current id, or the old id of one that was
 * renamed, read as its new id. A browser that remembered the old choice, or a caller written before the
 * rename, keeps working instead of being refused, and an id that was never an option is still refused.
 */
export function idWithRenamesSchema<Id extends string>(
  ids: readonly [Id, ...Id[]],
  renamed: Readonly<Record<string, Id>>,
  message?: string
) {
  return z.preprocess(
    (value) => (typeof value === "string" ? (renamed[value] ?? value) : value),
    z.enum(ids, message ? { error: message } : undefined)
  )
}
