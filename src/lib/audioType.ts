export type SupportedAudioMimeType = "audio/wav" | "audio/ogg" | "audio/webm" | "audio/mp4" | "audio/mpeg" | "audio/flac"

// A recording whose container was verified from its bytes
export interface VerifiedAudio {
  data: Buffer
  mimeType: SupportedAudioMimeType
}

const WEBM_SIGNATURE = [0x1a, 0x45, 0xdf, 0xa3]
const MP3_FRAME = [0xff]

const startsWith = (buffer: Buffer, signature: number[], offset = 0): boolean =>
  buffer.length >= offset + signature.length && signature.every((byte, index) => buffer[offset + index] === byte)

const ascii = (buffer: Buffer, start: number, end: number) =>
  buffer.length >= end ? buffer.toString("ascii", start, end) : ""

/**
 * Detects the recording's container from its magic bytes rather than trusting the browser's
 * MIME type, so only audio the models can read is ever sent on. Returns null for anything else.
 */
export function detectAudioMimeType(buffer: Buffer): SupportedAudioMimeType | null {
  if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 12) === "WAVE") return "audio/wav"
  if (ascii(buffer, 0, 4) === "OggS") return "audio/ogg"
  if (ascii(buffer, 0, 4) === "fLaC") return "audio/flac"
  if (ascii(buffer, 4, 8) === "ftyp") return "audio/mp4"
  if (startsWith(buffer, WEBM_SIGNATURE)) return "audio/webm"
  if (ascii(buffer, 0, 3) === "ID3") return "audio/mpeg"
  // MPEG frame sync: 11 set bits
  if (startsWith(buffer, MP3_FRAME) && buffer.length > 1 && (buffer[1] & 0xe0) === 0xe0) return "audio/mpeg"
  return null
}
