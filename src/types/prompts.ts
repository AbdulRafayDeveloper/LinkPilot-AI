/**
 * A user-editable prompt as served by the API: the saved custom value when one exists,
 * otherwise the default template.
 */
export interface StoredPrompt {
  prompt: string
  isCustom: boolean
  updatedAt: string | null
}

export interface EditablePrompt extends StoredPrompt {
  defaultPrompt: string
}
