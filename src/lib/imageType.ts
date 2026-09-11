export type SupportedImageMimeType = "image/png" | "image/jpeg" | "image/webp"

// An uploaded image whose type was verified from its bytes
export interface VerifiedImage {
  data: Buffer
  mimeType: SupportedImageMimeType
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]

function startsWith(buffer: Buffer, signature: number[], offset = 0): boolean {
  return buffer.length >= offset + signature.length && signature.every((byte, index) => buffer[offset + index] === byte)
}

/**
 * Detects PNG, JPEG and WEBP from the file's magic bytes rather than trusting the
 * client-provided MIME type. Returns null for anything else.
 */
export function detectImageMimeType(buffer: Buffer): SupportedImageMimeType | null {
  if (startsWith(buffer, PNG_SIGNATURE)) return "image/png"
  if (startsWith(buffer, JPEG_SIGNATURE)) return "image/jpeg"
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp"
  }
  return null
}
