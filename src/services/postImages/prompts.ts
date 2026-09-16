import { getStoredPrompt, saveStoredPrompt } from "@/services/promptStore"
import type { PostImagePrompt } from "@/types/postImages"

/**
 * The module's one editable prompt: how a post image is designed. Every image goes through it,
 * with the brand defaults and the post content placed inside it, and the fixed rules in
 * post-image-system wrapped around it.
 */
export function getPostImagePrompt(): Promise<PostImagePrompt> {
  return getStoredPrompt("post-image")
}

export function savePostImagePrompt(prompt: string): Promise<PostImagePrompt> {
  return saveStoredPrompt("post-image", prompt)
}
