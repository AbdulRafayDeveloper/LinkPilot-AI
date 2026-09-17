"use client"

import { requestApi } from "@/lib/apiClient"
import {
  ACCEPTED_AUDIO_EXTENSIONS,
  CLIENT_VOICES_MESSAGES,
  TRANSCRIBE_CONCURRENCY,
  TRANSCRIBE_ENDPOINT,
  VOICE_MAX_BYTES,
} from "@/constants/clientVoices"

/**
 * Running one batch of voice messages from the browser.
 *
 * Each voice is its own request to the app's shared transcription endpoint, for three reasons
 * that all come from where this runs. A serverless function takes a 4.5 MB body, so one request
 * per voice keeps every one of them well inside it. A function has a time limit, so fifteen
 * voices in one request would be the thing that runs out of it. And a failure then belongs to
 * one voice instead of the whole batch, which is what lets a single voice be tried again
 * without touching the ones that worked.
 *
 * The audio never goes anywhere else: no upload to storage, no record, nothing kept on the
 * server between requests.
 */

/** Whether the browser handed us something that looks like a voice message. */
export function checkAudioFile(file: File): string | null {
  const name = file.name.toLowerCase()
  const looksLikeAudio = file.type.startsWith("audio/") || ACCEPTED_AUDIO_EXTENSIONS.some((extension) => name.endsWith(extension))
  // Some browsers hand over a voice file with no type at all, so the name decides instead
  if (!looksLikeAudio) return CLIENT_VOICES_MESSAGES.unsupported
  if (file.size === 0) return CLIENT_VOICES_MESSAGES.emptyFile
  if (file.size > VOICE_MAX_BYTES) return CLIENT_VOICES_MESSAGES.tooLarge
  return null
}

/**
 * Sends one voice to be written out. The file goes as the body of its own request and is never
 * held anywhere after the answer comes back.
 */
export async function transcribeVoice(file: File, signal: AbortSignal): Promise<string> {
  const form = new FormData()
  form.append("audio", file, file.name || "voice")
  // Read in Client Voices' own provider order
  form.append("for", "client-voices")
  // Writing out a recording stores nothing, so a dropped request is safe to send again
  const { data } = await requestApi<{ text: string }>(
    TRANSCRIBE_ENDPOINT,
    { method: "POST", body: form, signal },
    { retry: true }
  )
  return data.text
}

interface RunOptions<T> {
  items: T[]
  limit?: number
  signal: AbortSignal
  run: (item: T) => Promise<void>
}

/**
 * Works through the batch a few at a time. Firing fifteen transcription requests at once is how
 * a batch runs into the provider's rate limit, and every one of them fails together.
 */
export async function runWithLimit<T>({ items, limit = TRANSCRIBE_CONCURRENCY, signal, run }: RunOptions<T>): Promise<void> {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(Math.max(1, limit), queue.length) }, async () => {
    while (queue.length > 0) {
      if (signal.aborted) return
      const item = queue.shift()
      if (item === undefined) return
      await run(item)
    }
  })
  await Promise.all(workers)
}
