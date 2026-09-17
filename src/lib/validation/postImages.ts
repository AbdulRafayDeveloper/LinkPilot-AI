import { z } from "zod"
import {
  ASSET_MAX_BYTES,
  ASSET_NAME_MAX_LENGTH,
  ASSET_POSE_IDS,
  DISPLAY_NAME_MAX_LENGTH,
  HEX_COLOR_PATTERN,
  IMAGE_SIZE_IDS,
  MAX_BRAND_ASSETS,
  MAX_BRAND_COLORS,
  NO_PHOTO_FILTER,
  POST_CONTENT_MAX_LENGTH,
  POST_IMAGES_MESSAGES,
} from "@/constants/postImages"
import { DATE_ORDER_ISSUE, choiceParam, cursorParam, dayBoundParam, inDateOrder, searchParam } from "./listFilters"

/** One brand colour, as a designer writes it. */
const HexColor = z
  .string({ error: POST_IMAGES_MESSAGES.badColor })
  .trim()
  .regex(HEX_COLOR_PATTERN, POST_IMAGES_MESSAGES.badColor)
  // Stored one way, so the same colour typed twice is the same colour
  .transform((value) => value.toLowerCase())

/**
 * The brand defaults as the API accepts them. Photos are named by the id they were uploaded
 * under, so this never carries a storage key from the browser.
 */
export const BrandSettingsSchema = z.object({
  displayName: z
    .string({ error: POST_IMAGES_MESSAGES.missingName })
    .trim()
    .max(DISPLAY_NAME_MAX_LENGTH, POST_IMAGES_MESSAGES.nameTooLong)
    .optional()
    .default(""),
  colors: z.array(HexColor).max(MAX_BRAND_COLORS, POST_IMAGES_MESSAGES.tooManyColors).optional().default([]),
  assets: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(64),
        name: z
          .string({ error: POST_IMAGES_MESSAGES.missingAssetName })
          .trim()
          .min(1, POST_IMAGES_MESSAGES.missingAssetName)
          .max(ASSET_NAME_MAX_LENGTH, POST_IMAGES_MESSAGES.missingAssetName),
        // Only for a photo uploaded in this save; a photo already saved is matched by id
        contentType: z.string().trim().max(60).optional(),
        size: z.number().int().positive().max(ASSET_MAX_BYTES, POST_IMAGES_MESSAGES.assetTooLarge).optional(),
      })
    )
    .max(MAX_BRAND_ASSETS, POST_IMAGES_MESSAGES.tooManyAssets)
    .optional()
    .default([]),
})

/** Where a new photo should go. The server builds the key from what this says. */
export const AssetUploadSchema = z.object({
  contentType: z.string({ error: POST_IMAGES_MESSAGES.unsupportedAsset }).trim().min(1).max(60),
  size: z.number({ error: POST_IMAGES_MESSAGES.assetTooLarge }).int().positive().max(ASSET_MAX_BYTES, POST_IMAGES_MESSAGES.assetTooLarge),
})

/** One image to draw. The colours and the name come from the saved defaults, never from here. */
export const GenerateImageSchema = z.object({
  postContent: z
    .string({ error: POST_IMAGES_MESSAGES.missingContent })
    .trim()
    .min(1, POST_IMAGES_MESSAGES.missingContent)
    .max(POST_CONTENT_MAX_LENGTH, POST_IMAGES_MESSAGES.contentTooLong),
  assetId: z.string().trim().max(64).nullable().optional().default(null),
  pose: z.enum(ASSET_POSE_IDS).optional().default("standing"),
  size: z.enum(IMAGE_SIZE_IDS).optional().default("square"),
})

/** The gallery's query string: a cursor, a search, the shape, the photo and a date range. */
export const PostImagesQuerySchema = z
  .object({
    cursor: cursorParam,
    search: searchParam,
    size: choiceParam(IMAGE_SIZE_IDS),
    photo: choiceParam([NO_PHOTO_FILTER, ...ASSET_POSE_IDS]),
    from: dayBoundParam,
    to: dayBoundParam,
  })
  .refine(inDateOrder, DATE_ORDER_ISSUE)
