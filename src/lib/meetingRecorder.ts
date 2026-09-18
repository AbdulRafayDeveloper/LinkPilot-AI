"use client"

import { requestApi } from "@/lib/apiClient"
import { cutChunks } from "@/lib/recordingParts"
import { sleep } from "@/lib/retry"
import {
  AUDIO_BITS_PER_SECOND,
  AUDIO_MIME_TYPES,
  AUDIO_SEGMENT_MAX_BYTES,
  AUDIO_SEGMENT_MS,
  CAMERA_BITS_PER_SECOND,
  CAMERA_MIME_TYPES,
  RECORDER_TIMESLICE_MS,
  RECORDING_CHUNK_MAX_BYTES,
  RECORDING_ENDPOINT,
  RECORDING_FLUSH_MS,
  RECORDING_MESSAGES,
  SCREEN_BITS_PER_SECOND,
  UPLOAD_RETRY_MS,
  VIDEO_MIME_TYPES,
  recordingEndpoint,
  type UploadTrackId,
  LAPTOP_HEARD_LEVEL,
  MEETING_SILENCE_WARN_MS,
  VOICE_HEARD_LEVEL,
  type RecordingSoundMode,
} from "@/constants/meetingRecording"

/**
 * The recorder behind "Record a meeting", in the browser only.
 *
 * It lives outside React, in this module, so moving to another page of the app doesn't stop a
 * recording: the page only shows it (`hooks/useMeetingRecorder`). Three recorders run side by side:
 * - **screen**: the shared screen or tab with the meeting's own sound and the microphone mixed in,
 *   one continuous file uploaded in chunks as it grows;
 * - **camera**, when asked for: its own continuous file, because a recorder takes one video track and
 *   drawing two into one needs a canvas that a browser stops painting while its tab is in the background;
 * - **audio**: the same mixed sound again, restarted every `AUDIO_SEGMENT_MS` so each piece is a whole
 *   small file the transcription can read on its own.
 *
 * Every chunk is at most `RECORDING_CHUNK_MAX_BYTES` and goes up the moment it exists (or at least
 * every `RECORDING_FLUSH_MS`), in one PUT to the app's own route, which stores it and records it. At
 * 4 MB it fits a serverless request, and going through the app means it works from any origin. A chunk
 * that fails waits and is sent again; none is ever dropped, and Stop waits until every one has landed.
 * Pausing pauses the recorders and the uploads together.
 */

export type RecorderStatus = "idle" | "starting" | "recording" | "paused" | "stopping" | "finishing" | "done" | "error"

export interface RecorderSnapshot {
  status: RecorderStatus
  meetingId: string | null
  // Recording time with the pauses left out
  elapsedMs: number
  recordedBytes: number
  uploadedBytes: number
  chunksWaiting: number
  chunksUploaded: number
  // True while a chunk is waiting to be sent again after a failure
  retrying: boolean
  uploadsPaused: boolean
  hasCamera: boolean
  hasMicrophone: boolean
  hasMeetingSound: boolean
  // How loud the meeting (everyone else) and your microphone are right now, from 0 to 1
  levels: { meeting: number; mic: number }
  // The other people haven't been heard for a while although you have: their sound may not be reaching it
  meetingSilent: boolean
  // Worth saying, not worth stopping for (the microphone was refused)
  notices: string[]
  error: string | null
  // The shared screen, for a small preview on the page
  preview: MediaStream | null
}

interface QueuedChunk {
  track: UploadTrackId
  index: number
  blob: Blob
  startMs?: number
}

// A continuous recording, cut into chunks as it grows
interface ContinuousTrack {
  track: "screen" | "camera"
  recorder: MediaRecorder
  pending: Blob
  nextIndex: number
  lastFlushAt: number
  stopped: Promise<void>
}

const IDLE: RecorderSnapshot = {
  status: "idle",
  meetingId: null,
  elapsedMs: 0,
  recordedBytes: 0,
  uploadedBytes: 0,
  chunksWaiting: 0,
  chunksUploaded: 0,
  retrying: false,
  uploadsPaused: false,
  hasCamera: false,
  hasMicrophone: false,
  hasMeetingSound: false,
  levels: { meeting: 0, mic: 0 },
  meetingSilent: false,
  notices: [],
  error: null,
  preview: null,
}

// Uploads running at once; enough to keep up with a screen recording, few enough to stay polite
const UPLOAD_CONCURRENCY = 2

const pickType = (candidates: readonly string[]) =>
  typeof MediaRecorder === "undefined" ? null : (candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null)

const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach((track) => track.stop())

interface MeetingSoundConstraints extends MediaTrackConstraints {
  suppressLocalAudioPlayback?: boolean
}

// The screen picker's hints that Chrome and Edge understand and TypeScript's DOM types don't list yet
interface MeetingShareOptions extends DisplayMediaStreamOptions {
  audio?: boolean | MeetingSoundConstraints
  systemAudio?: "include" | "exclude"
  selfBrowserSurface?: "include" | "exclude"
  surfaceSwitching?: "include" | "exclude"
  monitorTypeSurfaces?: "include" | "exclude"
  preferCurrentTab?: boolean
}

/**
 * How the meeting is shared. Its sound is the only way the other people's voices reach the
 * recording, so the picker is asked to offer it for every kind of share it can: the tab's own sound,
 * and the whole system's sound when an entire screen is shared (Zoom or Teams in their own apps).
 * This tab is left out of the list, since it has no meeting sound in it. And the meeting's sound is
 * taken as it plays: echo cancelling, noise suppression and gain control are made for a microphone,
 * and on other people's voices they thin them out or cut them off.
 */
const SHARE_OPTIONS: MeetingShareOptions = {
  video: { frameRate: { ideal: 15, max: 30 } },
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
  systemAudio: "include",
  selfBrowserSurface: "exclude",
  surfaceSwitching: "include",
  monitorTypeSurfaces: "include",
  preferCurrentTab: false,
}

// Only your voice: the screen is still shared (the recording keeps it), but no sound is asked for
const VOICE_ONLY_SHARE: MeetingShareOptions = {
  video: SHARE_OPTIONS.video,
  audio: false,
  selfBrowserSurface: "exclude",
  surfaceSwitching: "include",
  monitorTypeSurfaces: "include",
  preferCurrentTab: false,
}

// What to fix when a share came without sound, which depends on what was shared
function noSoundMessage(surface: string | undefined): string {
  if (surface === "window") return RECORDING_MESSAGES.noSoundWindow
  if (surface === "browser") return RECORDING_MESSAGES.noSoundTab
  if (surface === "monitor") return RECORDING_MESSAGES.noSoundScreen
  return RECORDING_MESSAGES.noSoundShared
}

// The longest window a meter can hold, about 0.7s at 48 kHz, so each half-second tick sees everything since the last
const METER_SAMPLES = 32768

// The loudest moment a meter heard since the last look, from 0 (silence) to 1
function peakOf(meter: AnalyserNode | null, buffer: Float32Array<ArrayBuffer>): number {
  if (!meter) return 0
  meter.getFloatTimeDomainData(buffer)
  let peak = 0
  for (const sample of buffer) peak = Math.max(peak, Math.abs(sample))
  return peak
}

// A peak shown the way loudness is heard: -70 dB and quieter is empty, full scale is full
const SHOWN_FLOOR_DB = 70
const shownLevel = (peak: number) => (peak <= 0 ? 0 : Math.max(0, Math.min(1, (20 * Math.log10(peak) + SHOWN_FLOOR_DB) / SHOWN_FLOOR_DB)))

/** Where each meter shows sound rather than silence, so the page and the recorder agree on "heard". */
export const HEARD_LEVELS_SHOWN = { laptop: shownLevel(LAPTOP_HEARD_LEVEL), voice: shownLevel(VOICE_HEARD_LEVEL) } as const

class MeetingRecorder {
  private snapshot: RecorderSnapshot = IDLE
  private listeners = new Set<() => void>()

  private display: MediaStream | null = null
  private microphone: MediaStream | null = null
  private camera: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private mixedAudio: MediaStreamTrack | null = null
  // One meter on each side of the mix, and when each side was last heard
  private meetingMeter: AnalyserNode | null = null
  private micMeter: AnalyserNode | null = null
  private meterData = new Float32Array(METER_SAMPLES)
  private meetingHeardAt = 0
  private micHeardAt = 0
  private continuous: ContinuousTrack[] = []

  private audioRecorder: MediaRecorder | null = null
  private audioMime = ""
  private audioParts: Blob[] = []
  private audioBytes = 0
  private audioIndex = 0
  private audioSegmentStartMs = 0
  private audioStopped: Promise<void> = Promise.resolve()

  private queue: QueuedChunk[] = []
  private inFlight = new Map<string, number>()
  private uploadedDone = 0
  private workers = 0

  // Recording time: what has run before the current stretch, and when the current stretch began
  private activeBeforeMs = 0
  private activeSinceMs: number | null = null
  private ticker: ReturnType<typeof setInterval> | null = null

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  getServerSnapshot = () => IDLE

  private update(changes: Partial<RecorderSnapshot>) {
    const inFlightBytes = [...this.inFlight.values()].reduce((sum, bytes) => sum + bytes, 0)
    this.snapshot = {
      ...this.snapshot,
      ...changes,
      uploadedBytes: this.uploadedDone + inFlightBytes,
      chunksWaiting: this.queue.length + this.inFlight.size,
      elapsedMs: this.activeMs(),
    }
    this.listeners.forEach((listener) => listener())
  }

  private activeMs() {
    return this.activeBeforeMs + (this.activeSinceMs === null ? 0 : Date.now() - this.activeSinceMs)
  }

  isBusy() {
    return ["starting", "recording", "paused", "stopping", "finishing"].includes(this.snapshot.status)
  }

  /** Back to nothing, once a finished recording has been handed over or a failed one given up. */
  reset() {
    if (this.isBusy()) return
    this.release()
    this.queue = []
    this.inFlight.clear()
    this.uploadedDone = 0
    this.snapshot = IDLE
    this.listeners.forEach((listener) => listener())
  }

  /**
   * Asks for the screen (and the microphone and camera), saves the meeting, and starts recording.
   * Must be called from a click: browsers only open the screen picker for one.
   */
  async start(options: { title: string; withMicrophone: boolean; withCamera: boolean; sound: RecordingSoundMode }) {
    // Only your voice: there is no laptop sound to share, and the microphone is the whole recording
    const onlyVoice = options.sound === "voice"
    const withMicrophone = onlyVoice || options.withMicrophone
    if (this.isBusy()) return
    const screenMime = pickType(VIDEO_MIME_TYPES)
    const audioMime = pickType(AUDIO_MIME_TYPES)
    if (!navigator.mediaDevices?.getDisplayMedia || !screenMime || !audioMime) {
      this.update({ ...IDLE, status: "error", error: RECORDING_MESSAGES.unsupported })
      return
    }
    this.queue = []
    this.inFlight.clear()
    this.uploadedDone = 0
    this.activeBeforeMs = 0
    this.activeSinceMs = null
    this.update({ ...IDLE, status: "starting" })
    const notices: string[] = []

    try {
      // The screen picker first, while the click still counts as the user's own
      this.display = await navigator.mediaDevices.getDisplayMedia(onlyVoice ? VOICE_ONLY_SHARE : SHARE_OPTIONS)
    } catch {
      this.update({ status: "error", error: RECORDING_MESSAGES.shareCancelled })
      return
    }
    // What the laptop plays (the other people, a call, a video) is only ever heard through the share's
    // own sound. Without it the recording would hold nobody but you, so it stops here, before anything
    // is saved, and says what to share
    if (!onlyVoice && this.display.getAudioTracks().length === 0) {
      const surface = this.display.getVideoTracks()[0]?.getSettings().displaySurface
      this.release()
      this.update({ status: "error", error: noSoundMessage(surface) })
      return
    }
    if (withMicrophone) {
      try {
        this.microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      } catch {
        notices.push(RECORDING_MESSAGES.micDenied)
      }
    }
    const cameraMime = options.withCamera ? pickType(CAMERA_MIME_TYPES) : null
    if (cameraMime) {
      try {
        this.camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 360 } } })
      } catch {
        notices.push(RECORDING_MESSAGES.cameraDenied)
      }
    }

    // The meeting's sound and the microphone become one track, which both the video and the audio pieces carry
    const meetingSound = onlyVoice ? [] : this.display.getAudioTracks()
    const micSound = this.microphone?.getAudioTracks() ?? []
    if (onlyVoice && micSound.length === 0) {
      this.release()
      this.update({ status: "error", error: RECORDING_MESSAGES.micRequired })
      return
    }
    this.audioContext = new AudioContext()
    await this.audioContext.resume().catch(() => undefined)
    const mix = this.audioContext.createMediaStreamDestination()
    // Each side goes into the mix through its own meter, so the page can show both are coming through
    this.meetingMeter = meetingSound.length > 0 ? this.connectMetered(this.audioContext, meetingSound, mix) : null
    this.micMeter = micSound.length > 0 ? this.connectMetered(this.audioContext, micSound, mix) : null
    this.meetingHeardAt = Date.now()
    this.micHeardAt = 0
    this.mixedAudio = mix.stream.getAudioTracks()[0]

    let meetingId: string
    try {
      const { data } = await requestApi<{ id: string }>(
        RECORDING_ENDPOINT,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: options.title.trim() || undefined,
            screenMime,
            audioMime,
            ...(this.camera && cameraMime ? { cameraMime } : {}),
          }),
        },
        { idempotent: true }
      )
      meetingId = data.id
    } catch (error: unknown) {
      this.release()
      this.update({ status: "error", error: error instanceof Error ? error.message : RECORDING_MESSAGES.startFailed })
      return
    }

    const screenStream = new MediaStream([...this.display.getVideoTracks(), this.mixedAudio])
    this.continuous = [this.startContinuous("screen", screenStream, screenMime, { videoBitsPerSecond: SCREEN_BITS_PER_SECOND, audioBitsPerSecond: AUDIO_BITS_PER_SECOND })]
    if (this.camera && cameraMime) {
      this.continuous.push(this.startContinuous("camera", new MediaStream(this.camera.getVideoTracks()), cameraMime, { videoBitsPerSecond: CAMERA_BITS_PER_SECOND }))
    }
    this.audioMime = audioMime
    this.audioIndex = 0
    this.startAudioSegment()

    // Ending the share from the browser's own bar is the same as pressing Stop
    this.display.getVideoTracks()[0]?.addEventListener("ended", () => void this.stop(), { once: true })
    this.activeSinceMs = Date.now()
    this.ticker = setInterval(() => this.tick(), 500)
    window.addEventListener("beforeunload", this.warnBeforeLeaving)
    window.addEventListener("online", this.kick)
    this.update({
      status: "recording",
      meetingId,
      hasCamera: Boolean(this.camera && cameraMime),
      hasMicrophone: micSound.length > 0,
      hasMeetingSound: meetingSound.length > 0,
      notices,
      preview: this.display,
    })
  }

  // One side of the sound into the mix, with a meter listening to it on the way
  private connectMetered(context: AudioContext, tracks: MediaStreamTrack[], mix: MediaStreamAudioDestinationNode): AnalyserNode {
    const meter = context.createAnalyser()
    meter.fftSize = METER_SAMPLES
    for (const track of tracks) {
      const source = context.createMediaStreamSource(new MediaStream([track]))
      source.connect(mix)
      source.connect(meter)
    }
    return meter
  }

  /**
   * How loud each side is now, and whether the other people have gone quiet while you haven't. That
   * is the sign their sound has stopped reaching the recording (the shared tab muted, or the share
   * changed to something without sound), and it is only raised while you are heard, so a quiet
   * room where nobody is talking is never mistaken for it.
   */
  private measure(): Pick<RecorderSnapshot, "levels" | "meetingSilent"> {
    const now = Date.now()
    const meeting = peakOf(this.meetingMeter, this.meterData)
    const mic = peakOf(this.micMeter, this.meterData)
    if (meeting >= LAPTOP_HEARD_LEVEL) this.meetingHeardAt = now
    if (mic >= VOICE_HEARD_LEVEL) this.micHeardAt = now
    const meetingSilent =
      this.meetingMeter !== null && now - this.meetingHeardAt >= MEETING_SILENCE_WARN_MS && now - this.micHeardAt < MEETING_SILENCE_WARN_MS
    return { levels: { meeting: shownLevel(meeting), mic: shownLevel(mic) }, meetingSilent }
  }

  private startContinuous(track: "screen" | "camera", stream: MediaStream, mimeType: string, bits: MediaRecorderOptions): ContinuousTrack {
    const recorder = new MediaRecorder(stream, { mimeType, ...bits })
    const entry: ContinuousTrack = { track, recorder, pending: new Blob([]), nextIndex: 0, lastFlushAt: Date.now(), stopped: Promise.resolve() }
    entry.stopped = new Promise((resolve) => recorder.addEventListener("stop", () => resolve(), { once: true }))
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size === 0) return
      this.update({ recordedBytes: this.snapshot.recordedBytes + event.data.size })
      const { chunks, rest } = cutChunks(new Blob([entry.pending, event.data]), RECORDING_CHUNK_MAX_BYTES)
      for (const chunk of chunks) this.enqueue({ track, index: entry.nextIndex++, blob: chunk })
      if (chunks.length > 0) entry.lastFlushAt = Date.now()
      entry.pending = rest
    })
    recorder.start(RECORDER_TIMESLICE_MS)
    return entry
  }

  // Sends whatever a continuous track has gathered, however small, as its next chunk
  private flush(entry: ContinuousTrack) {
    if (entry.pending.size === 0) return
    this.enqueue({ track: entry.track, index: entry.nextIndex++, blob: entry.pending })
    entry.pending = new Blob([])
    entry.lastFlushAt = Date.now()
  }

  private startAudioSegment() {
    if (!this.mixedAudio) return
    const recorder = new MediaRecorder(new MediaStream([this.mixedAudio]), { mimeType: this.audioMime, audioBitsPerSecond: AUDIO_BITS_PER_SECOND })
    const index = this.audioIndex++
    const startMs = this.activeMs()
    this.audioParts = []
    this.audioBytes = 0
    this.audioSegmentStartMs = startMs
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size === 0) return
      this.audioParts.push(event.data)
      this.audioBytes += event.data.size
    })
    this.audioStopped = new Promise((resolve) =>
      recorder.addEventListener(
        "stop",
        () => {
          // A whole piece, header and all, so it can be written out on its own
          const blob = new Blob(this.audioParts, { type: this.audioMime })
          if (blob.size > 0) this.enqueue({ track: "audio", index, blob, startMs })
          resolve()
        },
        { once: true }
      )
    )
    recorder.start(RECORDER_TIMESLICE_MS)
    this.audioRecorder = recorder
  }

  // Closes the current audio piece and starts the next, with no gap worth hearing
  private async rotateAudio() {
    const current = this.audioRecorder
    if (!current || current.state === "inactive") return
    const stopped = this.audioStopped
    current.stop()
    await stopped
    if (this.snapshot.status === "recording") this.startAudioSegment()
  }

  private tick() {
    if (this.snapshot.status === "recording") {
      for (const entry of this.continuous) if (Date.now() - entry.lastFlushAt >= RECORDING_FLUSH_MS) this.flush(entry)
      const segmentMs = this.activeMs() - this.audioSegmentStartMs
      if (segmentMs >= AUDIO_SEGMENT_MS || this.audioBytes >= AUDIO_SEGMENT_MAX_BYTES) void this.rotateAudio()
    }
    this.update(this.snapshot.status === "recording" ? this.measure() : { levels: { meeting: 0, mic: 0 }, meetingSilent: false })
  }

  pause() {
    if (this.snapshot.status !== "recording") return
    for (const entry of this.continuous) if (entry.recorder.state === "recording") entry.recorder.pause()
    if (this.audioRecorder?.state === "recording") this.audioRecorder.pause()
    this.activeBeforeMs = this.activeMs()
    this.activeSinceMs = null
    this.update({ status: "paused", uploadsPaused: true })
  }

  resume() {
    if (this.snapshot.status !== "paused") return
    for (const entry of this.continuous) if (entry.recorder.state === "paused") entry.recorder.resume()
    if (this.audioRecorder?.state === "paused") this.audioRecorder.resume()
    this.activeSinceMs = Date.now()
    this.meetingHeardAt = Date.now()
    this.update({ status: "recording", uploadsPaused: false })
    this.kick()
  }

  /**
   * Stops recording, sends everything still waiting, and tells the app the recording is complete. It
   * only reports done once every chunk has landed, so nothing recorded is left behind.
   */
  async stop() {
    if (this.snapshot.status !== "recording" && this.snapshot.status !== "paused") return
    this.activeBeforeMs = this.activeMs()
    this.activeSinceMs = null
    this.update({ status: "stopping", uploadsPaused: false })
    for (const entry of this.continuous) if (entry.recorder.state !== "inactive") entry.recorder.stop()
    if (this.audioRecorder && this.audioRecorder.state !== "inactive") this.audioRecorder.stop()
    await Promise.all([...this.continuous.map((entry) => entry.stopped), this.audioStopped])
    for (const entry of this.continuous) this.flush(entry)
    this.release()
    this.update({ status: "finishing", preview: null })
    this.kick()
    await this.drained()

    const meetingId = this.snapshot.meetingId as string
    const counts = {
      screen: this.continuous.find((entry) => entry.track === "screen")?.nextIndex ?? 0,
      camera: this.continuous.find((entry) => entry.track === "camera")?.nextIndex ?? 0,
      audio: this.audioIndex,
    }
    // Every chunk has been confirmed by now; a slow confirmation only means asking again shortly
    for (let attempt = 0; ; attempt++) {
      try {
        await requestApi(`${recordingEndpoint(meetingId)}/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationMs: Math.round(this.activeBeforeMs), counts }),
        }, { retry: true })
        break
      } catch (error: unknown) {
        if (attempt >= 20) {
          this.update({ status: "error", error: error instanceof Error ? error.message : RECORDING_MESSAGES.processFailed })
          return
        }
        await sleep(UPLOAD_RETRY_MS)
        this.kick()
        await this.drained()
      }
    }
    this.update({ status: "done" })
  }

  // Resolves once nothing is waiting or on its way
  private async drained() {
    while (this.queue.length > 0 || this.inFlight.size > 0) await sleep(300)
  }

  private enqueue(chunk: QueuedChunk) {
    this.queue.push(chunk)
    this.update({})
    this.kick()
  }

  private kick = () => {
    while (this.workers < UPLOAD_CONCURRENCY && this.queue.length > 0 && !this.snapshot.uploadsPaused) {
      this.workers++
      void this.work().finally(() => {
        this.workers--
      })
    }
  }

  private async work() {
    for (let chunk = this.queue.shift(); chunk; chunk = this.snapshot.uploadsPaused ? undefined : this.queue.shift()) {
      const id = `${chunk.track}:${chunk.index}`
      this.inFlight.set(id, 0)
      try {
        await this.upload(chunk, (bytes) => {
          this.inFlight.set(id, bytes)
          this.update({})
        })
        this.inFlight.delete(id)
        this.uploadedDone += chunk.blob.size
        this.update({ chunksUploaded: this.snapshot.chunksUploaded + 1, retrying: false })
      } catch (error: unknown) {
        this.inFlight.delete(id)
        // The recording has already been finished elsewhere: this chunk has nowhere to go
        if (error instanceof Error && error.message === RECORDING_MESSAGES.notRecording) {
          this.update({ error: error.message })
          continue
        }
        // Anything else waits and goes again; a chunk is never dropped
        this.update({ retrying: true, notices: [...new Set([...this.snapshot.notices, RECORDING_MESSAGES.uploadRetrying])] })
        await sleep(UPLOAD_RETRY_MS)
        this.queue.unshift(chunk)
      }
    }
  }

  /**
   * One PUT of one chunk to the app, with its progress as it goes. An XHR rather than fetch, because only
   * an XHR reports how much of the body has been sent. Rejects with the server's own message.
   */
  private upload(chunk: QueuedChunk, onBytes: (bytes: number) => void) {
    const query = new URLSearchParams({ track: chunk.track, index: String(chunk.index) })
    if (chunk.startMs !== undefined) query.set("startMs", String(Math.round(chunk.startMs)))
    const url = `${recordingEndpoint(this.snapshot.meetingId as string)}/chunks?${query}`
    return new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest()
      request.open("PUT", url, true)
      request.setRequestHeader("Content-Type", "application/octet-stream")
      request.upload.onprogress = (event) => onBytes(event.loaded)
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) return resolve()
        let message = RECORDING_MESSAGES.uploadRetrying as string
        try {
          message = (JSON.parse(request.responseText) as { message?: string }).message || message
        } catch {
          // Not JSON: the host refused it before the route ran
        }
        reject(new Error(message))
      }
      request.onerror = () => reject(new Error(RECORDING_MESSAGES.uploadRetrying))
      request.send(chunk.blob)
    })
  }

  private warnBeforeLeaving = (event: BeforeUnloadEvent) => {
    if (!this.isBusy()) return
    event.preventDefault()
    event.returnValue = RECORDING_MESSAGES.leaveWarning
  }

  // Lets go of the screen, the microphone, the camera and the sound mixer
  private release() {
    if (this.ticker) clearInterval(this.ticker)
    this.ticker = null
    stopStream(this.display)
    stopStream(this.microphone)
    stopStream(this.camera)
    this.mixedAudio?.stop()
    void this.audioContext?.close().catch(() => undefined)
    this.display = null
    this.microphone = null
    this.camera = null
    this.mixedAudio = null
    this.audioContext = null
    this.meetingMeter = null
    this.micMeter = null
    if (!this.isBusy()) {
      window.removeEventListener("beforeunload", this.warnBeforeLeaving)
      window.removeEventListener("online", this.kick)
    }
  }
}

/** The one recorder of this browser tab. */
export const meetingRecorder = new MeetingRecorder()
