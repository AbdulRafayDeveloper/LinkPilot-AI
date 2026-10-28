"use client"

import React, { useRef, useState } from "react"
import { Pause, Play } from "lucide-react"

// A minute and its seconds, "1:53"; an hour long recording reads "61:05", which a voice never reaches
const clock = (seconds: number) => {
  // Rounded rather than cut, so a recording the file says is 112.8s reads 1:53, the length kept with it
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}

interface VoicePlayerProps {
  src: string
  // The length kept with the recording, shown until (or instead of) what the file itself says
  knownSeconds?: number | null
  label: string
  // "none" waits for Play before asking for anything, for a long list of players
  preload?: "none" | "metadata"
}

/**
 * One recording to play: a single play and pause button, where it is against how long it runs
 * ("0:12 / 1:53"), and a bar to jump anywhere in it.
 *
 * It exists because the browser's own player says "0:00 / 0:00" for a recording made in a browser:
 * MediaRecorder never writes a length into the file. So the total comes from the length kept with
 * the recording (`knownSeconds`) until the file says otherwise, and when the file does not say, it is
 * made to work its length out (asking for a time far past the end, which a browser answers by reading
 * to the end and setting the real length), so jumping along the bar works as well as the total shows.
 */
export const VoicePlayer: React.FC<VoicePlayerProps> = ({ src, knownSeconds = null, label, preload = "metadata" }) => {
  const audio = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [fileSeconds, setFileSeconds] = useState<number | null>(null)
  // Set while the length is being worked out, so the jump to the end that does it is never shown
  const measuring = useRef(false)

  // A caller keys the player by the recording, so a new one always starts from the beginning
  const total = fileSeconds ?? (knownSeconds && knownSeconds > 0 ? knownSeconds : 0)

  const readLength = () => {
    const element = audio.current
    if (!element) return
    if (Number.isFinite(element.duration) && element.duration > 0) {
      setFileSeconds(element.duration)
      if (measuring.current) {
        measuring.current = false
        element.currentTime = 0
      }
      return
    }
    // No length in the file: ask for a time far past the end, and the browser sets the real one
    if (!measuring.current && element.duration === Infinity) {
      measuring.current = true
      element.currentTime = Number.MAX_SAFE_INTEGER
    }
  }

  const toggle = async () => {
    const element = audio.current
    if (!element) return
    if (element.paused) {
      try {
        await element.play()
      } catch {
        setIsPlaying(false)
      }
    } else {
      element.pause()
    }
  }

  const seek = (seconds: number) => {
    const element = audio.current
    if (!element) return
    element.currentTime = seconds
    setCurrent(seconds)
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-surface-container-high px-2 py-1.5">
      <audio
        ref={audio}
        src={src}
        preload={preload}
        onLoadedMetadata={readLength}
        onDurationChange={readLength}
        onTimeUpdate={(event) => {
          if (!measuring.current) setCurrent(event.currentTarget.currentTime)
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false)
          setCurrent(0)
        }}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
        title={isPlaying ? "Pause" : "Play"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover"
      >
        {isPlaying ? <Pause size={14} aria-hidden="true" /> : <Play size={14} className="ml-0.5" aria-hidden="true" />}
      </button>
      <span className="shrink-0 font-mono text-[12px] tabular-nums text-on-surface" aria-label={`${clock(current)} of ${clock(total)}`}>
        {clock(current)} / {clock(total)}
      </span>
      <input
        type="range"
        min={0}
        max={total > 0 ? total : 1}
        step={0.1}
        value={Math.min(current, total || 1)}
        onChange={(event) => seek(Number(event.target.value))}
        disabled={total <= 0}
        aria-label={`Where to play ${label} from`}
        className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary disabled:cursor-default"
      />
    </div>
  )
}
