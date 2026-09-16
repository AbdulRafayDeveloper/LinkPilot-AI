import { z } from "zod"
import {
  CLIENT_COUNTRY_MAX_LENGTH,
  CLIENT_MESSAGING_MESSAGES,
  CLIENT_NAME_MAX_LENGTH,
  MESSAGE_FORMAT_MAX_LENGTH,
  SAMPLE_MESSAGE_COUNT,
  SAMPLE_MESSAGE_MAX_LENGTH,
} from "@/constants/clientMessaging"

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
