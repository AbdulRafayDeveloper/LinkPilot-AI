import {
  VOICE_MAX_BYTES,
  VOICE_PART_MAX_SECONDS,
  VOICE_PART_MIN_SECONDS,
  VOICE_PART_SAMPLE_RATE,
} from "@/constants/voiceInput"

/**
 * Cuts a recording into parts small enough to send and to write out in one answer each.
 *
 * A long recording can't go to the transcription endpoint whole: a serverless host refuses a
 * request body over a few megabytes, and a transcription model stops writing after a couple of
 * thousand tokens. So the browser decodes the recording, cuts it at pauses, and sends each part
 * on its own. Browser only (Web Audio).
 */

// The stretch compared when looking for a pause to cut at
const QUIET_WINDOW_SECONDS = 0.25
const WAV_HEADER_BYTES = 44

// One channel of samples, whatever the recording had: speech needs no stereo
function toMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0)
  const mono = new Float32Array(buffer.length)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let index = 0; index < data.length; index++) mono[index] += data[index] / buffer.numberOfChannels
  }
  return mono
}

// The quietest window between two points, so a cut lands in a pause rather than inside a word
function quietestPoint(samples: Float32Array, from: number, to: number): number {
  const window = Math.round(QUIET_WINDOW_SECONDS * VOICE_PART_SAMPLE_RATE)
  let best = to
  let bestEnergy = Number.POSITIVE_INFINITY
  for (let start = from; start + window <= to; start += window) {
    let energy = 0
    for (let index = start; index < start + window; index++) energy += samples[index] * samples[index]
    if (energy < bestEnergy) {
      bestEnergy = energy
      best = start + Math.floor(window / 2)
    }
  }
  return best
}

// 16-bit PCM WAV: every transcription provider reads it, and its size is exact and predictable
function encodeWav(samples: Float32Array): Blob {
  const view = new DataView(new ArrayBuffer(WAV_HEADER_BYTES + samples.length * 2))
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index++) view.setUint8(offset + index, text.charCodeAt(index))
  }
  writeText(0, "RIFF")
  view.setUint32(4, 36 + samples.length * 2, true)
  writeText(8, "WAVE")
  writeText(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, VOICE_PART_SAMPLE_RATE, true)
  view.setUint32(28, VOICE_PART_SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, "data")
  view.setUint32(40, samples.length * 2, true)
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(WAV_HEADER_BYTES + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return new Blob([view.buffer], { type: "audio/wav" })
}

/**
 * The recording as the parts to send, in order. A short recording goes as it is. Throws when the
 * browser can't decode a recording that is also too large to send whole.
 */
export async function splitRecording(recording: Blob): Promise<Blob[]> {
  let samples: Float32Array
  try {
    // Decoding into a 16 kHz context resamples on the way in, which keeps a six-minute recording
    // to a few tens of megabytes in memory instead of a hundred
    const context = new OfflineAudioContext({ numberOfChannels: 1, length: 1, sampleRate: VOICE_PART_SAMPLE_RATE })
    samples = toMono(await context.decodeAudioData(await recording.arrayBuffer()))
  } catch {
    if (recording.size <= VOICE_MAX_BYTES) return [recording]
    throw new Error("undecodable")
  }

  const maxSamples = VOICE_PART_MAX_SECONDS * VOICE_PART_SAMPLE_RATE
  if (samples.length <= maxSamples && recording.size <= VOICE_MAX_BYTES) return [recording]

  const minSamples = VOICE_PART_MIN_SECONDS * VOICE_PART_SAMPLE_RATE
  const parts: Blob[] = []
  let start = 0
  while (start < samples.length) {
    const end = samples.length - start <= maxSamples ? samples.length : quietestPoint(samples, start + minSamples, start + maxSamples)
    parts.push(encodeWav(samples.subarray(start, end)))
    start = end
  }
  return parts
}
