import { loadPrompt } from "@/services/prompts"
import { getStoredPrompt, getStoredPrompts, saveStoredPrompt, type PromptEntry } from "@/services/promptStore"
import {
  CONNECTION_NOTE_TONES,
  connectionNotePromptKey,
  type ConnectionNoteToneId,
} from "@/constants/connectionNote"
import type { ConnectionNoteTonePrompt } from "@/types/connectionNote"

/**
 * Each tone has its own Setting record and its own default template, so editing one
 * tone's prompt can never change another's.
 */
function tonePromptEntry(tone: ConnectionNoteToneId): PromptEntry {
  return { key: connectionNotePromptKey(tone), defaultPrompt: loadPrompt(`connection-note-${tone}`) }
}

export async function getConnectionNotePrompts(): Promise<ConnectionNoteTonePrompt[]> {
  const entries = CONNECTION_NOTE_TONES.map((tone) => ({ tone: tone.id, entry: tonePromptEntry(tone.id) }))
  const stored = await getStoredPrompts(entries.map(({ entry }) => entry))
  return entries.map(({ tone, entry }, index) => ({ tone, ...stored[index], defaultPrompt: entry.defaultPrompt }))
}

export async function getActiveTonePrompt(tone: ConnectionNoteToneId): Promise<string> {
  const { prompt } = await getStoredPrompt(tonePromptEntry(tone))
  return prompt
}

export async function saveTonePrompt(tone: ConnectionNoteToneId, prompt: string): Promise<ConnectionNoteTonePrompt> {
  const entry = tonePromptEntry(tone)
  const saved = await saveStoredPrompt(entry, prompt)
  return { tone, ...saved, defaultPrompt: entry.defaultPrompt }
}
