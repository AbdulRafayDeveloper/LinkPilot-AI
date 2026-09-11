/**
 * Shared limits and messages for tools that take a LinkedIn post as pasted text or as a
 * screenshot (Comment Writer, Post Comment Replies).
 */
export type PostInputMode = "text" | "image"

export const POST_TEXT_MAX_LENGTH = 10000
// Stays under Vercel's 4.5 MB request body limit
export const POST_IMAGE_MAX_BYTES = 4 * 1024 * 1024
export const POST_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]

export const POST_INPUT_MESSAGES = {
  postTooLong: `The post must be under ${POST_TEXT_MAX_LENGTH.toLocaleString()} characters.`,
  unsupportedImage: "Upload a PNG, JPG or WEBP image.",
  imageTooLarge: `Images must be ${POST_IMAGE_MAX_BYTES / (1024 * 1024)} MB or smaller.`,
  unreadableImage:
    "We couldn't find a readable LinkedIn post in that image. Try a clearer screenshot or paste the text instead.",
} as const
