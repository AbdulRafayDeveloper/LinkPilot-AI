import { z } from "zod"
import {
  PERSON_FIELD_MAX_LENGTH,
  PERSON_TYPE_IDS,
  PROFILE_SCHEDULER_MESSAGES,
  PROFILE_URL_MAX_LENGTH,
  WEEK_DAY_IDS,
  type PersonTypeId,
  type WeekDayId,
} from "@/constants/profileScheduler"
import { normalizeProfileUrl } from "@/lib/linkedinProfile"
import { choiceParam, searchParam } from "./listFilters"

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : value)

// A blank link is no link, kept as null; anything else must be a LinkedIn profile, kept in its one form
const ProfileUrl = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? null : trimmed(value)),
  z
    .string({ error: PROFILE_SCHEDULER_MESSAGES.badUrl })
    .max(PROFILE_URL_MAX_LENGTH, PROFILE_SCHEDULER_MESSAGES.urlTooLong)
    .transform((value, ctx) => {
      const url = normalizeProfileUrl(value)
      if (!url) ctx.addIssue({ code: "custom", message: PROFILE_SCHEDULER_MESSAGES.badUrl })
      return url ?? z.NEVER
    })
    .nullable()
)

// One line of text, its spaces tidied
const Line = z.preprocess(
  (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value),
  z.string().max(PERSON_FIELD_MAX_LENGTH, PROFILE_SCHEDULER_MESSAGES.fieldTooLong)
)

const Types = z
  .array(z.enum(PERSON_TYPE_IDS, { error: PROFILE_SCHEDULER_MESSAGES.badType }))
  .max(PERSON_TYPE_IDS.length * 2, PROFILE_SCHEDULER_MESSAGES.badType)
  .transform((types) => PERSON_TYPE_IDS.filter((type) => types.includes(type)) as PersonTypeId[])

const Days = z
  .array(z.enum(WEEK_DAY_IDS, { error: PROFILE_SCHEDULER_MESSAGES.badDay }), { error: PROFILE_SCHEDULER_MESSAGES.missingDays })
  .min(1, PROFILE_SCHEDULER_MESSAGES.missingDays)
  .max(WEEK_DAY_IDS.length * 2, PROFILE_SCHEDULER_MESSAGES.badDay)
  .transform((days) => WEEK_DAY_IDS.filter((day) => days.includes(day)) as WeekDayId[])

/**
 * A person as an edit takes it. Only the days are required; a field left out stays as it was, so a
 * caller written before people had details (`{ profileUrl, days }`) keeps working, and the service
 * checks that what it would save still names the person somehow.
 */
export const ProfilePersonEditSchema = z.object({
  profileUrl: ProfileUrl.optional(),
  name: Line.optional(),
  role: Line.optional(),
  location: Line.optional(),
  sector: Line.optional(),
  types: Types.optional(),
  days: Days,
})

/** A new person: a name, a LinkedIn link or both, and at least one day. */
export const ProfileScheduleSchema = ProfilePersonEditSchema.refine((person) => Boolean(person.profileUrl || person.name), {
  message: PROFILE_SCHEDULER_MESSAGES.missingPerson,
  path: ["name"],
})

export const ProfileScheduleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
  search: searchParam,
  // One day of the week, or "" for every profile
  day: choiceParam(WEEK_DAY_IDS),
  // One type, or "" for every type
  type: choiceParam(PERSON_TYPE_IDS),
})
