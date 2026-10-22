"use client"

/**
 * How long a voice message runs, and how to say it.
 *
 * The length is measured in the browser, from the file itself, as the voice is added: nothing on
 * the server can read it without decoding the audio, and the browser has already decoded enough to
 * play it. It is then kept with the voice, so a batch's page can say how long each recording is
 * **without the player having to load anything**, which is what pressing play used to be for.
 */

// A recording whose length the browser cannot work out in this long was never going to say
const MEASURE_TIMEOUT_MS = 5000
// What a browser reports for a stream with no length in its header; seeking past the end fixes it
const SEEK_PAST_THE_END = 1e101

/** "0:07", "1:23", "1:02:05". Nothing at all for a length nobody knows. */
export function durationLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ""
  const whole = Math.round(seconds)
  const minutes = Math.floor(whole / 60) % 60
  const hours = Math.floor(whole / 3600)
  const pad = (value: number) => String(value).padStart(2, "0")
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(whole % 60)}` : `${minutes}:${pad(whole % 60)}`
}

/**
 * The length of a recording the browser has in hand. Answers 0 rather than failing: a length is
 * worth having and never worth losing a voice over.
 *
 * A file written by a `MediaRecorder` carries no length in its header, and a browser reports that
 * as `Infinity`. Seeking past the end makes it read the stream to the finish and settle on the
 * real one, which is the only way to learn it without decoding the whole file ourselves.
 */
export function measureDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof Audio === "undefined") {
      resolve(0)
      return
    }
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    let done = false
    const finish = (seconds: number) => {
      if (done) return
      done = true
      clearTimeout(timer)
      audio.removeAttribute("src")
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : 0)
    }
    const timer = setTimeout(() => finish(0), MEASURE_TIMEOUT_MS)

    audio.addEventListener("loadedmetadata", () => {
      if (audio.duration !== Infinity) {
        finish(audio.duration)
        return
      }
      // Reading to the end is what makes a stream with no header length report its own
      audio.currentTime = SEEK_PAST_THE_END
    })
    audio.addEventListener("durationchange", () => {
      if (audio.duration !== Infinity) finish(audio.duration)
    })
    audio.addEventListener("error", () => finish(0))
    audio.preload = "metadata"
    audio.src = url
  })
}
