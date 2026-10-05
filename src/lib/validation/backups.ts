import { z } from "zod"
import { BACKUP_STATUS_IDS, BACKUP_TRIGGER_IDS } from "@/constants/backups"
import { DATE_ORDER_ISSUE, choiceParam, dayBoundParam, inDateOrder, searchParam } from "./listFilters"

/**
 * What the Database Backup list may be asked for: a page, a search over the file name, the reason a
 * run failed and who ran it, and the status, trigger and date filters. Built from the same pieces
 * every other list uses, so a date range the wrong way round is refused here too.
 */
export const BackupsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100_000).catch(1),
    search: searchParam,
    status: choiceParam(BACKUP_STATUS_IDS),
    trigger: choiceParam(BACKUP_TRIGGER_IDS),
    from: dayBoundParam,
    to: dayBoundParam,
  })
  .refine(inDateOrder, DATE_ORDER_ISSUE)
