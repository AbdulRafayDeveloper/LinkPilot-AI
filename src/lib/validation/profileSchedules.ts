import { z } from "zod"
import { PROFILE_SCHEDULER_MESSAGES, PROFILE_URL_MAX_LENGTH, WEEK_DAY_IDS, type WeekDayId } from "@/constants/profileScheduler"
import { normalizeProfileUrl } from "@/lib/linkedinProfile"
import { choiceParam, searchParam } from "./listFilters"

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : value)

/** One profile and its days. The link is kept in its one form, and the days in week order, each once. */
export const ProfileScheduleSchema = z.object({
  profileUrl: z.preprocess(
    trimmed,
    z
      .string({ error: PROFILE_SCHEDULER_MESSAGES.missingUrl })
      .min(1, PROFILE_SCHEDULER_MESSAGES.missingUrl)
      .max(PROFILE_URL_MAX_LENGTH, PROFILE_SCHEDULER_MESSAGES.urlTooLong)
      .transform((value, ctx) => {
        const url = normalizeProfileUrl(value)
        if (!url) ctx.addIssue({ code: "custom", message: PROFILE_SCHEDULER_MESSAGES.badUrl })
        return url ?? z.NEVER
      })
  ),
  days: z
    .array(z.enum(WEEK_DAY_IDS, { error: PROFILE_SCHEDULER_MESSAGES.badDay }), { error: PROFILE_SCHEDULER_MESSAGES.missingDays })
    .min(1, PROFILE_SCHEDULER_MESSAGES.missingDays)
    .max(WEEK_DAY_IDS.length * 2, PROFILE_SCHEDULER_MESSAGES.badDay)
    .transform((days) => WEEK_DAY_IDS.filter((day) => days.includes(day)) as WeekDayId[]),
})

export const ProfileScheduleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
  search: searchParam,
  // One day of the week, or "" for every profile
  day: choiceParam(WEEK_DAY_IDS),
})
