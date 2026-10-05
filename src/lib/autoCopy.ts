"use client"

import { useSyncExternalStore } from "react"

/**
 * Putting a finished result on the clipboard without the user clicking Copy, so a comment can be
 * pasted straight into LinkedIn.
 *
 * **A browser refuses a clipboard write from a page it is not showing**, and a comment lands 10 to 40
 * seconds after the click that asked for it, by which time the click no longer counts as permission.
 * So the copy is tried at once and, when that is refused, held and tried again the moment the page is
 * in front of the user again (it comes back into view, or they click or type on it). That is exactly
 * the case this is for: the comment is written while the user is on LinkedIn, and it is on the
 * clipboard by the time they look at the page.
 *
 * The browser is kept out of the rule (`createAutoCopier` takes what it needs), so the waiting and
 * retrying are testable on their own; `autoCopyText` is the one instance the app uses.
 */

export type AutoCopyStatus = "idle" | "waiting" | "copied" | "failed"

export interface AutoCopyState {
  status: AutoCopyStatus
  // What was put on the clipboard, or is waiting to be
  text: string
}

export interface AutoCopyTools {
  write: (text: string) => Promise<void>
  // True while a write can succeed at all: the page is the one the browser is showing
  isReady: () => boolean
  // Calls back when the page comes back in front of the user; returns the way to stop listening
  listen: (onReady: () => void) => () => void
}

// After this many refusals the page stops trying and says to use the Copy button instead
export const AUTO_COPY_MAX_ATTEMPTS = 3

const IDLE: AutoCopyState = { status: "idle", text: "" }

export function createAutoCopier(tools: AutoCopyTools) {
  let state: AutoCopyState = IDLE
  let attempts = 0
  let stopListening: (() => void) | null = null
  const listeners = new Set<() => void>()

  const announce = () => listeners.forEach((listener) => listener())
  const set = (next: AutoCopyState) => {
    state = next
    announce()
  }
  const stopWaiting = () => {
    stopListening?.()
    stopListening = null
  }

  const attempt = () => {
    const { text } = state
    if (state.status !== "waiting" || !text) return
    if (!tools.isReady()) return
    attempts += 1
    void tools
      .write(text)
      .then(() => {
        // A newer comment may have arrived while this was in flight; that one is the one to copy
        if (state.text !== text) return
        stopWaiting()
        set({ status: "copied", text })
      })
      .catch(() => {
        if (state.text !== text) return
        if (attempts < AUTO_COPY_MAX_ATTEMPTS) return
        stopWaiting()
        set({ status: "failed", text })
      })
  }

  return {
    /** Put this text on the clipboard, now or as soon as the browser allows it. */
    copy(text: string) {
      if (!text) return
      attempts = 0
      stopWaiting()
      set({ status: "waiting", text })
      stopListening = tools.listen(attempt)
      attempt()
    },
    /** A new generation started, so the last result's "Copied" no longer belongs on the page. */
    reset() {
      attempts = 0
      stopWaiting()
      set(IDLE)
    },
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const browserTools: AutoCopyTools = {
  write: async (text) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) throw new Error("This browser has no clipboard access")
    await navigator.clipboard.writeText(text)
  },
  // A write from a page the browser is not showing is refused, so it is not even tried
  isReady: () => typeof document !== "undefined" && document.hasFocus() && document.visibilityState === "visible",
  listen: (onReady) => {
    if (typeof window === "undefined") return () => undefined
    const events: Array<[EventTarget, string]> = [
      [window, "focus"],
      [document, "visibilitychange"],
      [window, "pointerdown"],
      [window, "keydown"],
    ]
    for (const [target, event] of events) target.addEventListener(event, onReady)
    return () => {
      for (const [target, event] of events) target.removeEventListener(event, onReady)
    }
  },
}

const autoCopier = createAutoCopier(browserTools)

/** Copy a finished result as soon as the browser allows it (see the rule above). */
export const autoCopyText = (text: string) => autoCopier.copy(text)
export const resetAutoCopy = () => autoCopier.reset()

export function useAutoCopy(): AutoCopyState {
  return useSyncExternalStore(autoCopier.subscribe, autoCopier.getState, () => IDLE)
}
