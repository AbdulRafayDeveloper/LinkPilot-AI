"use client"

import React from "react"
import { PromptTabsModal } from "@/components/prompts/PromptTabsModal"
import { requestApi } from "@/lib/apiClient"
import { POST_IMAGES_ENDPOINT, POST_IMAGES_PROMPT_ID, POST_IMAGES_PROMPT_TABS } from "@/constants/postImages"
import type { EditablePrompt } from "@/types/prompts"

const PROMPT_ENDPOINT = `${POST_IMAGES_ENDPOINT}/prompt`
const VARIABLES = [
  { name: "aspect", description: "the shape you picked, for example 1024 x 1024" },
  { name: "brand_colors", description: "your saved colours" },
  { name: "display_name", description: "the name on your posts" },
  { name: "post_content", description: "what the post is about" },
  { name: "person", description: "the chosen photo and how it should be posed" },
]

async function loadPrompt(signal: AbortSignal): Promise<Record<string, EditablePrompt>> {
  const { data } = await requestApi<EditablePrompt>(PROMPT_ENDPOINT, { signal })
  return { [POST_IMAGES_PROMPT_ID]: data }
}

function savePrompt(_id: string, prompt: string) {
  return requestApi<EditablePrompt>(PROMPT_ENDPOINT, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
}

const renderHint = () => (
  <div className="space-y-1 leading-relaxed">
    <p className="font-semibold text-on-surface-variant">This prompt decides how a post image is designed.</p>
    <ul className="space-y-0.5">
      {VARIABLES.map((variable) => (
        <li key={variable.name}>
          <code className="font-code text-on-surface-variant">{`{{${variable.name}}}`}</code> {variable.description}
        </li>
      ))}
    </ul>
    <p>
      The app always adds the rules it will not bend on. Only your saved colours may be used for the design, a person in
      a photo keeps their own face and skin, and the post itself never goes on the image. Each image keeps the words it
      was drawn from, so changing this never rewrites an image you already made.
    </p>
  </div>
)

interface PostImagePromptModalProps {
  onClose: () => void
}

/** Edits the module's one prompt: how a post image is designed. */
export const PostImagePromptModal: React.FC<PostImagePromptModalProps> = ({ onClose }) => (
  <PromptTabsModal
    title="Update Post Image Prompt"
    description="This prompt decides the style of every post image. Your colours, your name and the post content are placed inside it."
    tabs={POST_IMAGES_PROMPT_TABS}
    initialTab={POST_IMAGES_PROMPT_ID}
    loadPrompts={loadPrompt}
    savePrompt={savePrompt}
    renderHint={renderHint}
    loadingText="Loading the saved post image prompt..."
    onClose={onClose}
  />
)
