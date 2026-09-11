import { z } from "zod"
import {
  DUMMY_DATA_KIND_IDS,
  DUMMY_ITEM_NAME_MAX_LENGTH,
  dummyDataMessages,
  dummyKindConfig,
  type DummyDataKind,
} from "@/constants/dummyData"

export const DummyDataKindSchema = z.enum(DUMMY_DATA_KIND_IDS)

// Each kind has its own fields, and each field the limit of the input it fills
export function dummyItemInputSchema(kind: DummyDataKind) {
  const messages = dummyDataMessages(kind)
  const shape: Record<string, z.ZodType<string>> = {}
  for (const field of dummyKindConfig(kind).fields) {
    const text = z
      .string({ error: messages.missingField(field) })
      .trim()
      .max(field.maxLength, messages.fieldTooLong(field))
    shape[field.key] = field.required ? text.min(1, messages.missingField(field)) : text.optional().transform((value) => value ?? "")
  }
  return z.object({
    name: z
      .string({ error: messages.missingName })
      .trim()
      .min(1, messages.missingName)
      .max(DUMMY_ITEM_NAME_MAX_LENGTH, messages.nameTooLong),
    fields: z.object(shape, { error: messages.missingField(dummyKindConfig(kind).fields[0]) }),
  })
}
