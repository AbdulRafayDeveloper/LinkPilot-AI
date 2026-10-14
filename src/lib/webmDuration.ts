/**
 * Writes the length of a recording into its WebM header.
 *
 * A browser's MediaRecorder writes WebM as it goes, so it can't know how long the recording will be:
 * the header has no Duration, and a player shows no length and can't seek. Once the recording has
 * stopped the length is known, so the header (which is in the first chunk) gets it before the chunks
 * are joined. This touches only the Info element at the top of the file; everything after it is the
 * same bytes. Pure and synchronous, so it is testable on its own (`tests/meetingRecording.test.mjs`).
 */

const EBML_HEADER = 0x1a45dfa3
const SEGMENT = 0x18538067
const INFO = 0x1549a966
const CLUSTER = 0x1f43b675
const TIMECODE_SCALE = 0x2ad7b1
const DURATION = 0x4489
// A Cluster's own id as bytes, to find one in the middle of a file, and its first child's id
const CLUSTER_ID_BYTES = Buffer.from([0x1f, 0x43, 0xb6, 0x75])
const CLUSTER_TIMECODE = 0xe7
// Matroska's default: one timecode unit is a millisecond
const DEFAULT_TIMECODE_SCALE = 1_000_000

interface Vint {
  length: number
  value: number
  // Every value bit set: the writer didn't know the size (a live recording's Segment and Clusters)
  unknown: boolean
}

// The number of bytes a vint takes, read from its first byte's leading zeros; 0 when it isn't one
function vintLength(first: number): number {
  for (let length = 1; length <= 8; length++) if (first & (0x80 >> (length - 1))) return length
  return 0
}

function readSize(buffer: Buffer, at: number): Vint | null {
  if (at >= buffer.length) return null
  const length = vintLength(buffer[at])
  if (length === 0 || at + length > buffer.length) return null
  let value = buffer[at] & (0xff >> length)
  let allOnes = value === 0xff >> length
  for (let index = 1; index < length; index++) {
    value = value * 256 + buffer[at + index]
    if (buffer[at + index] !== 0xff) allOnes = false
  }
  return { length, value, unknown: allOnes }
}

// Element ids keep their marker bit, which is how the ids above are written
function readId(buffer: Buffer, at: number): { length: number; id: number } | null {
  if (at >= buffer.length) return null
  const length = vintLength(buffer[at])
  if (length === 0 || length > 4 || at + length > buffer.length) return null
  let id = 0
  for (let index = 0; index < length; index++) id = id * 256 + buffer[at + index]
  return { length, id }
}

interface Element {
  id: number
  start: number
  dataStart: number
  // Null for an element of unknown size, which runs to the end of its parent
  end: number | null
}

function readElement(buffer: Buffer, at: number): Element | null {
  const id = readId(buffer, at)
  if (!id) return null
  const size = readSize(buffer, at + id.length)
  if (!size) return null
  const dataStart = at + id.length + size.length
  return { id: id.id, start: at, dataStart, end: size.unknown ? null : dataStart + size.value }
}

function readUint(buffer: Buffer, start: number, end: number): number {
  let value = 0
  for (let index = start; index < end; index++) value = value * 256 + buffer[index]
  return value
}

// A size field of exactly eight bytes, so a rewritten Info never needs its size field to grow later
function eightByteSize(value: number): Buffer {
  const size = Buffer.alloc(8)
  size[0] = 0x01
  let rest = value
  for (let index = 7; index >= 1; index--) {
    size[index] = rest % 256
    rest = Math.floor(rest / 256)
  }
  return size
}

/**
 * The same WebM with its duration set to `durationMs`. Answers null when the bytes are not a WebM
 * this can safely rewrite (no Info before the first Cluster, a Segment whose size is fixed, anything
 * malformed), in which case the file is simply joined as it was recorded.
 */
export function setWebmDuration(buffer: Buffer, durationMs: number): Buffer | null {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null
  const header = readElement(buffer, 0)
  if (!header || header.id !== EBML_HEADER || header.end === null) return null
  const segment = readElement(buffer, header.end)
  if (!segment || segment.id !== SEGMENT) return null

  // The Info element is one of the Segment's first children, always before any Cluster
  let info: Element | null = null
  for (let at = segment.dataStart; at < buffer.length; ) {
    const child = readElement(buffer, at)
    if (!child || child.id === CLUSTER) break
    if (child.id === INFO) {
      info = child
      break
    }
    if (child.end === null) break
    at = child.end
  }
  if (!info || info.end === null || info.end > buffer.length) return null

  let scale = DEFAULT_TIMECODE_SCALE
  let duration: Element | null = null
  for (let at = info.dataStart; at < info.end; ) {
    const child = readElement(buffer, at)
    if (!child || child.end === null || child.end > info.end) return null
    if (child.id === TIMECODE_SCALE) scale = readUint(buffer, child.dataStart, child.end) || DEFAULT_TIMECODE_SCALE
    if (child.id === DURATION) duration = child
    at = child.end
  }
  const units = (durationMs * 1_000_000) / scale

  // A Duration already there is overwritten in place, whichever float width it was written with
  if (duration && duration.end !== null) {
    const copy = Buffer.from(buffer)
    const width = duration.end - duration.dataStart
    if (width === 8) copy.writeDoubleBE(units, duration.dataStart)
    else if (width === 4) copy.writeFloatBE(units, duration.dataStart)
    else return null
    return copy
  }

  // Otherwise Info is rebuilt with a Duration on the end. Only a Segment of unknown size (which is what
  // a MediaRecorder writes) can grow without rewriting everything after it
  const segmentSize = readSize(buffer, segment.start + (readId(buffer, segment.start)?.length ?? 0))
  if (!segmentSize?.unknown) return null
  const durationElement = Buffer.alloc(11)
  durationElement.writeUInt16BE(DURATION, 0)
  durationElement[2] = 0x88
  durationElement.writeDoubleBE(units, 3)
  const infoData = Buffer.concat([buffer.subarray(info.dataStart, info.end), durationElement])
  const infoId = buffer.subarray(info.start, info.start + (readId(buffer, info.start)?.length ?? 4))
  const newInfo = Buffer.concat([infoId, eightByteSize(infoData.length), infoData])
  return Buffer.concat([buffer.subarray(0, info.start), newInfo, buffer.subarray(info.end)])
}

/**
 * How far into the recording the last Cluster in these bytes begins, in milliseconds.
 *
 * **This is the recording's own timeline, read from the media rather than from a clock**, which is
 * what is left when the browser cannot say how long it ran: a recording whose tab closed is finished
 * from the meeting's page, where nobody knows how long it was. A Cluster's Timecode is counted from
 * the start of the whole file, so scanning only the **last** chunk gives the length of everything
 * before it, and the answer is short of the true end by that last Cluster's own length (under a
 * second on the recordings this app makes).
 *
 * The bytes are searched rather than walked, because a chunk is a cut through the middle of a file
 * and has no element to start from. Each hit is then checked against the shape a Cluster really has
 * (a size, then a Timecode of one to eight bytes), so the four-byte id turning up inside compressed
 * video is passed over rather than read as a time.
 */
export function lastClusterTimecodeMs(buffer: Buffer, timecodeScale = DEFAULT_TIMECODE_SCALE): number | null {
  let latest: number | null = null
  for (let at = buffer.indexOf(CLUSTER_ID_BYTES); at !== -1; at = buffer.indexOf(CLUSTER_ID_BYTES, at + 1)) {
    const size = readSize(buffer, at + CLUSTER_ID_BYTES.length)
    if (!size) continue
    const timecodeAt = at + CLUSTER_ID_BYTES.length + size.length
    if (timecodeAt + 1 >= buffer.length || buffer[timecodeAt] !== CLUSTER_TIMECODE) continue
    const width = readSize(buffer, timecodeAt + 1)
    // One byte says how long the time is, which is all a Timecode ever needs
    if (!width || width.length !== 1 || width.value < 1 || width.value > 8) continue
    const end = timecodeAt + 2 + width.value
    if (end > buffer.length) continue
    const units = readUint(buffer, timecodeAt + 2, end)
    if (latest === null || units > latest) latest = units
  }
  return latest === null ? null : (latest * timecodeScale) / 1_000_000
}

/** The unit a WebM counts its times in, read from its header. Null when these bytes have no header. */
export function readTimecodeScale(buffer: Buffer): number | null {
  const header = readElement(buffer, 0)
  if (!header || header.id !== EBML_HEADER || header.end === null) return null
  const segment = readElement(buffer, header.end)
  if (!segment || segment.id !== SEGMENT) return null
  for (let at = segment.dataStart; at < buffer.length; ) {
    const child = readElement(buffer, at)
    if (!child || child.id === CLUSTER) return null
    if (child.id === INFO && child.end !== null) {
      for (let inner = child.dataStart; inner < child.end; ) {
        const field = readElement(buffer, inner)
        if (!field || field.end === null) return null
        if (field.id === TIMECODE_SCALE) return readUint(buffer, field.dataStart, field.end) || null
        inner = field.end
      }
      return DEFAULT_TIMECODE_SCALE
    }
    if (child.end === null) return null
    at = child.end
  }
  return null
}

/** The duration written in a WebM's header, in milliseconds, or null when it has none. For tests and checks. */
export function readWebmDuration(buffer: Buffer): number | null {
  const header = readElement(buffer, 0)
  if (!header || header.end === null) return null
  const segment = readElement(buffer, header.end)
  if (!segment) return null
  for (let at = segment.dataStart; at < buffer.length; ) {
    const child = readElement(buffer, at)
    if (!child || child.id === CLUSTER) return null
    if (child.id === INFO && child.end !== null) {
      let scale = DEFAULT_TIMECODE_SCALE
      let units: number | null = null
      for (let inner = child.dataStart; inner < child.end; ) {
        const field = readElement(buffer, inner)
        if (!field || field.end === null) return null
        if (field.id === TIMECODE_SCALE) scale = readUint(buffer, field.dataStart, field.end)
        if (field.id === DURATION) units = field.end - field.dataStart === 8 ? buffer.readDoubleBE(field.dataStart) : buffer.readFloatBE(field.dataStart)
        inner = field.end
      }
      return units === null ? null : (units * scale) / 1_000_000
    }
    if (child.end === null) return null
    at = child.end
  }
  return null
}
