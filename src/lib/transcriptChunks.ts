import { createHash } from "node:crypto"
import { CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS } from "@/constants/meetings"

/**
 * Splitting a transcript for analysis. A meeting is cut where a speaker changes or a paragraph
 * ends, never mid-sentence where it can be helped, and every character of the transcript lands in
 * exactly one chunk: nothing is dropped, however long the meeting ran.
 */
export interface TranscriptChunk {
  index: number
  // The part of the transcript this chunk is responsible for
  text: string
  // The tail of the chunk before it, given as context only, never extracted twice
  context: string
}

// "Sara Malik:", "Sara Malik (00:12):", "[00:12] Sara:", "Sara Malik  10:20 AM"
const SPEAKER_LINE = /^\s*(?:\[[^\]\n]{1,20}\]\s*)?[\p{Lu}][\p{L}'.-]*(?:\s+[\p{L}'.-]+){0,3}\s*(?:\([^)\n]{1,20}\))?\s*(?::|\s{2,}\d{1,2}:\d{2})/u

const sentenceEnd = /(?<=[.!?])\s+/

/**
 * A transcript as its natural blocks: one speaker turn, or one paragraph. A block longer than a
 * whole chunk is broken at sentence ends, so even a wall of text without speakers stays readable.
 */
function toBlocks(transcript: string): string[] {
  const blocks: string[] = []
  let current: string[] = []
  const flush = () => {
    if (current.length > 0) blocks.push(current.join("\n"))
    current = []
  }

  for (const line of transcript.split("\n")) {
    const startsTurn = SPEAKER_LINE.test(line) || line.trim() === ""
    if (startsTurn && current.length > 0) flush()
    current.push(line)
  }
  flush()

  return blocks.flatMap((block) => (block.length <= CHUNK_MAX_CHARS ? [block] : splitLongBlock(block)))
}

// A single block bigger than one chunk: split at sentence ends, and only then at raw length
function splitLongBlock(block: string): string[] {
  const parts: string[] = []
  let current = ""
  for (const sentence of block.split(sentenceEnd)) {
    const piece = sentence.length > CHUNK_MAX_CHARS ? "" : sentence
    if (!piece) {
      // A single "sentence" longer than a chunk (no punctuation at all): cut it by length
      for (let at = 0; at < sentence.length; at += CHUNK_MAX_CHARS) parts.push(sentence.slice(at, at + CHUNK_MAX_CHARS))
      continue
    }
    if (current && current.length + piece.length + 1 > CHUNK_MAX_CHARS) {
      parts.push(current)
      current = piece
    } else {
      current = current ? `${current} ${piece}` : piece
    }
  }
  if (current) parts.push(current)
  return parts
}

/**
 * The transcript as ordered chunks, each with the tail of the one before it for context.
 */
export function splitTranscript(transcript: string): TranscriptChunk[] {
  const normalized = transcript.replace(/\r\n?/g, "\n")
  if (!normalized.trim()) return []

  const chunks: string[] = []
  let current = ""
  for (const block of toBlocks(normalized)) {
    if (current && current.length + block.length + 1 > CHUNK_MAX_CHARS) {
      chunks.push(current)
      current = block
    } else {
      current = current ? `${current}\n${block}` : block
    }
  }
  if (current.trim()) chunks.push(current)

  return chunks.map((text, index) => ({
    index,
    text,
    context: index === 0 ? "" : chunks[index - 1].slice(-CHUNK_OVERLAP_CHARS),
  }))
}

/**
 * How many chunks a transcript needs, without building them all.
 */
export const countChunks = (transcript: string): number => splitTranscript(transcript).length

/**
 * A short fingerprint of the transcript. The analysis records the fingerprint it was built from,
 * so an edited transcript is spotted at once and its old analysis is marked out of date.
 */
export const hashTranscript = (transcript: string): string =>
  createHash("sha256").update(transcript.replace(/\r\n?/g, "\n")).digest("hex").slice(0, 32)
