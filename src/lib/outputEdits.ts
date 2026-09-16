"use client"

import { useCallback } from "react"
import { createToolStore, useToolStore } from "@/lib/toolStore"

/**
 * The user's edits to generated text, for every tool in one store: the text as the user changed
 * it, keyed by the tool and the generated text it started from. Edits survive switching tools
 * and refreshes like the rest of a tool's state, and a new generation (different text) starts
 * clean. The oldest edits are dropped once there are many.
 */
const MAX_EDITS = 60

const store = createToolStore<{ edits: Record<string, string> }>("output-edits", { edits: {} }, { version: 1 })

// FNV-1a: a short, stable key for the generated text an edit belongs to
function hashText(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export interface EditableText {
  // What to show and copy: the user's version when they edited it, otherwise the generated text
  value: string
  isEdited: boolean
  setValue: (next: string) => void
  // Back to the generated text
  reset: () => void
}

export function useEditableText(scope: string, original: string): EditableText {
  const { edits } = useToolStore(store)
  const key = `${scope}:${hashText(original)}`
  const edited = edits[key]

  const setValue = useCallback(
    (next: string) =>
      store.update(({ edits: current }) => {
        const rest = { ...current }
        delete rest[key]
        // Re-added last, so the most recently edited texts are the ones kept
        if (next !== original) rest[key] = next
        const keys = Object.keys(rest)
        for (const stale of keys.slice(0, Math.max(0, keys.length - MAX_EDITS))) delete rest[stale]
        return { edits: rest }
      }),
    [key, original]
  )

  return { value: edited ?? original, isEdited: edited !== undefined, setValue, reset: () => setValue(original) }
}
