import { z } from "zod"
import { FIELD_LIMITS, PROFILE_SEARCH_MAX_LENGTH, type ProfileField, type ProfileSection } from "@/constants/profileSections"
import { limitOf, type EntryFields } from "@/lib/profileSections"

/**
 * A My AI Profile entry as the API accepts it, built from its section's own fields, so a field added
 * in constants/profileSections.ts is checked here with no change. Unknown keys are dropped, every
 * value is trimmed and held to its length, lists are kept once each, and a field a toggle clears is
 * emptied while that toggle is on.
 */

const MONTH = /^(\d{4}-(0[1-9]|1[0-2]))?$/

const tooLong = (field: ProfileField) => `${field.label} is too long.`

/** A web address as typed, with https:// added when it was left off; anything not http(s) is refused. */
const webAddress = (field: ProfileField) =>
  z
    .string()
    .trim()
    .max(limitOf(field), tooLong(field))
    .transform((value) => (value && !/^[a-z][a-z0-9+.-]*:/i.test(value) ? `https://${value}` : value))
    .refine((value) => {
      if (!value) return true
      try {
        return ["http:", "https:"].includes(new URL(value).protocol)
      } catch {
        return false
      }
    }, `${field.label} must be a web address.`)

const uniqueList = (field: ProfileField, maxItems: number, caseless: boolean) =>
  z
    .array(z.string().trim().max(limitOf(field), tooLong(field)), { error: `${field.label} must be a list.` })
    .max(maxItems, `${field.label} can hold up to ${maxItems}.`)
    .transform((items) => {
      const seen = new Set<string>()
      return items.filter((item) => {
        const key = caseless ? item.toLowerCase() : item
        if (!item || seen.has(key)) return false
        seen.add(key)
        return true
      })
    })

function fieldSchema(field: ProfileField): z.ZodType {
  switch (field.kind) {
    case "toggle":
      return z.boolean().default(false)
    case "number":
      return z
        .number({ error: `${field.label} must be a number.` })
        .int()
        .min(field.min ?? 0)
        .max(field.upTo ?? 1_000_000)
        .nullable()
        .default(null)
    case "month":
      return z.string().trim().regex(MONTH, `${field.label} must be a month.`).default("")
    case "choice":
      return z.union([z.enum(field.options as [string, ...string[]]), z.literal("")], { error: `${field.label} is not one of its choices.` }).default("")
    case "url":
      return webAddress(field).default("")
    case "lines":
      return uniqueList(field, FIELD_LIMITS.listItems, false).default([])
    case "chips":
      return uniqueList(field, FIELD_LIMITS.chips, true).default([])
    case "pairs":
      return z
        .array(z.object({ first: z.string().trim().max(limitOf(field), tooLong(field)), second: z.string().trim().max(limitOf(field), tooLong(field)) }))
        .max(FIELD_LIMITS.pairs, `${field.label} can hold up to ${FIELD_LIMITS.pairs}.`)
        .transform((pairs) => pairs.filter((pair) => pair.first && pair.second))
        .default([])
    default: {
      // A required field left out reads the same as one left empty
      const text = z.string({ error: field.required ? `${field.label} is needed.` : `${field.label} must be text.` }).trim().max(limitOf(field), tooLong(field))
      return field.required ? text.min(1, `${field.label} is needed.`) : text.default("")
    }
  }
}

/** The schema for one section's entries. */
export function entrySchema(section: ProfileSection): z.ZodType<EntryFields> {
  const shape = Object.fromEntries(section.fields.map((field) => [field.key, fieldSchema(field)]))
  return z.object(shape).transform((fields) => {
    const clean = { ...fields } as EntryFields
    for (const field of section.fields) if (field.kind === "toggle" && field.clears && clean[field.key] === true) clean[field.clears] = ""
    return clean
  })
}

const fieldsRecord = z.record(z.string(), z.unknown())

/** The body of an edit: the entry's fields. */
export const EntryBodySchema = z.object({ fields: fieldsRecord }, { error: "Send the entry's fields." })

/** The body of a create: one entry's fields, or several at once (projects kept in a browser, brought over). */
export const EntryCreateSchema = z.union([EntryBodySchema, z.object({ entries: z.array(fieldsRecord).min(1).max(200) })], { error: "Send the entry's fields." })

/** The whole order of one section, every entry once. */
export const EntryOrderSchema = z.object({
  orderedIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(10_000),
})

export const ProfileSearchSchema = z.object({
  q: z.string().trim().min(1, "Type what to look for.").max(PROFILE_SEARCH_MAX_LENGTH),
})
