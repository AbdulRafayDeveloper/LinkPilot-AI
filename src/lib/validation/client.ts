import { z } from "zod"
import {
  CLIENT_COUNTRY_MAX_LENGTH,
  CLIENT_MESSAGING_MESSAGES,
  CLIENT_NAME_MAX_LENGTH,
  MESSAGE_FORMAT_MAX_LENGTH,
  SAMPLE_MESSAGE_COUNT,
  SAMPLE_MESSAGE_MAX_LENGTH,
} from "@/constants/clientMessaging"
import { CLIENT_KIND_IDS, CLIENTS_MESSAGES, MAX_CLIENTS } from "@/constants/clients"

/**
 * One client as the API accepts it: who they are, the format their messages follow, and the
 * sample messages that show it. Every client keeps SAMPLE_MESSAGE_COUNT samples, all filled in.
 */
export const ClientSchema = z.object({
  name: z
    .string({ error: CLIENT_MESSAGING_MESSAGES.missingName })
    .trim()
    .min(1, CLIENT_MESSAGING_MESSAGES.missingName)
    .max(CLIENT_NAME_MAX_LENGTH, CLIENT_MESSAGING_MESSAGES.nameTooLong),
  country: z
    .string({ error: CLIENT_MESSAGING_MESSAGES.missingCountry })
    .trim()
    .min(1, CLIENT_MESSAGING_MESSAGES.missingCountry)
    .max(CLIENT_COUNTRY_MAX_LENGTH, CLIENT_MESSAGING_MESSAGES.countryTooLong),
  // Optional, so Client Tasks Messaging's own form (which never asks) leaves it as it is
  kind: z.enum(CLIENT_KIND_IDS, { error: CLIENTS_MESSAGES.kindLabel }).optional(),
  messageFormat: z
    .string({ error: CLIENT_MESSAGING_MESSAGES.missingFormat })
    .trim()
    .min(1, CLIENT_MESSAGING_MESSAGES.missingFormat)
    .max(MESSAGE_FORMAT_MAX_LENGTH, CLIENT_MESSAGING_MESSAGES.formatTooLong),
  sampleMessages: z
    .array(z.string().trim().max(SAMPLE_MESSAGE_MAX_LENGTH, CLIENT_MESSAGING_MESSAGES.sampleTooLong))
    .length(SAMPLE_MESSAGE_COUNT, CLIENT_MESSAGING_MESSAGES.missingSamples)
    .refine((samples) => samples.every((sample) => sample.length > 0), CLIENT_MESSAGING_MESSAGES.missingSamples),
})

/** The clients in their new order after a drag, every one of them, top to bottom, each once. */
export const ClientOrderSchema = z.object({
  orderedIds: z
    .array(z.string().regex(/^[0-9a-f]{24}$/, CLIENTS_MESSAGES.orderChanged))
    .min(1, CLIENTS_MESSAGES.orderChanged)
    .max(MAX_CLIENTS, CLIENTS_MESSAGES.orderChanged)
    .refine((ids) => new Set(ids).size === ids.length, CLIENTS_MESSAGES.orderChanged),
})
