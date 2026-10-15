"use client"

import { useSyncExternalStore } from "react"

/**
 * Putting a finished result on the clipboard without the user clicking Copy, so a comment can be
 * pasted straight into LinkedIn.
 *
 * **A browser refuses a clipboard write from a page it is not showing**, and a comment lands 10 to 40
 * seconds after the click that asked for it, by which time the click no longer counts as permission.
 * Waiting for the page to come back in front of the user is not enough on its own: a page can sit
 * there plainly visible on a second screen, or beside the window the user is typing in, with
 * `document.hasFocus()` false the whole time, and then nothing is ever copied until they click
 * something, which is usually the Copy button. That is the owner's own case, and what this is for.
 *
 * **So the clipboard is claimed on the click that asks for the comment** (`claim`), while that click
 * still counts as permission: the browser is handed a promise instead of text, and the text is put
 * in 10 to 40 seconds later when it exists. Chrome and Safari both honour that, so the comment lands
 * on the clipboard **while the user is still on LinkedIn**, with the page in the background. Checked
 * against a real browser: filled after 60 seconds with the page unfocused, it is on the clipboard,
 * and a generation that fails never touches whatever the user had copied themselves.
 *
 * Waiting for the page is still there underneath, for a browser that will not claim (`claim` returns
 * null) or one that refuses the claim once it is filled. Firefox wants a click of its own for any
 * clipboard write, so it lands there.
 *
 * The browser is kept out of the rule (`createAutoCopier` takes what it needs), so the claiming,
 * waiting and retrying are testable on their own; `autoCopyText` is the one instance the app uses.
 */

export type AutoCopyStatus = "idle" | "waiting" | "copied" | "failed"

export interface AutoCopyState {
  status: AutoCopyStatus
  // What was put on the clipboard, or is waiting to be
  text: string
}

/**
 * A clipboard write the browser has agreed to, on the strength of the click that started the work,
 * and that is filled in once there is something to put in it.
 */
export interface ClipboardClaim {
  // Puts the finished text in, which is when the browser really writes it
  fill: (text: string) => void
  // Nothing is coming, so the write is dropped and what the user had copied is left alone
  giveUp: () => void
  // True once the browser has written it, false when it would not; it never rejects
  done: Promise<boolean>
}

export interface AutoCopyTools {
  write: (text: string) => Promise<void>
  // True while a write can succeed at all: the page is the one the browser is showing
  isReady: () => boolean
  // Calls back when the page comes back in front of the user; returns the way to stop listening
  listen: (onReady: () => void) => () => void
  // Claims the clipboard inside the click that started the work; null where that is not possible
  claim?: () => ClipboardClaim | null
}

// After this many refusals the page stops trying and says to use the Copy button instead
export const AUTO_COPY_MAX_ATTEMPTS = 3

const IDLE: AutoCopyState = { status: "idle", text: "" }

export function createAutoCopier(tools: AutoCopyTools) {
  let state: AutoCopyState = IDLE
  let attempts = 0
  let stopListening: (() => void) | null = null
  // The clipboard the browser has already agreed to, waiting for the text (see the rule above)
  let claimed: ClipboardClaim | null = null
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
  const dropClaim = () => {
    claimed?.giveUp()
    claimed = null
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

  /** Wait for the page to be in front of the user, and copy the moment it is. */
  const waitForThePage = () => {
    stopListening = tools.listen(attempt)
    attempt()
  }

  return {
    /**
     * The user has just asked for something, so the clipboard is claimed while their click still
     * counts as permission. Nothing is on screen yet, so this says nothing to the page.
     */
    start() {
      attempts = 0
      stopWaiting()
      dropClaim()
      set(IDLE)
      claimed = tools.claim?.() ?? null
    },
    /** Put this text on the clipboard, now or as soon as the browser allows it. */
    copy(text: string) {
      if (!text) return
      attempts = 0
      stopWaiting()
      set({ status: "waiting", text })
      const claim = claimed
      claimed = null
      if (claim) {
        claim.fill(text)
        void claim.done.then((written) => {
          // A newer comment may have arrived while this was in flight; that one is the one to copy
          if (state.text !== text) return
          if (written) set({ status: "copied", text })
          // The browser would not take the claim after all, so the page is waited for instead
          else waitForThePage()
        })
        return
      }
      waitForThePage()
    },
    /** A new generation started, so the last result's "Copied" no longer belongs on the page. */
    reset() {
      attempts = 0
      stopWaiting()
      dropClaim()
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
  /**
   * Hands the browser a promise in place of the text, inside the click that asked for the comment.
   * The write is then the browser's to finish whenever the promise is filled, which is why a comment
   * lands on the clipboard with the page in the background.
   *
   * `done` never rejects: a browser that will not take the claim, and a generation that fails, both
   * come back as false so the caller falls back to waiting for the page.
   */
  claim: () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.write) return null
    if (typeof ClipboardItem === "undefined") return null
    let fill: (value: Blob) => void = () => undefined
    let giveUp: (reason: Error) => void = () => undefined
    const text = new Promise<Blob>((resolve, reject) => {
      fill = resolve
      giveUp = reject
    })
    try {
      const done = navigator.clipboard
        .write([new ClipboardItem({ "text/plain": text })])
        .then(() => true)
        .catch(() => false)
      return {
        fill: (value: string) => fill(new Blob([value], { type: "text/plain" })),
        giveUp: () => giveUp(new Error("nothing to copy")),
        done,
      }
    } catch {
      // A browser that refuses the claim outright leaves the waiting path to do the work
      giveUp(new Error("the browser would not claim the clipboard"))
      return null
    }
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

/**
 * Claim the clipboard for what the user has just asked for, **inside their own click**, so the
 * result can be put on it later even with the page in the background (see the rule above).
 */
export const startAutoCopy = () => autoCopier.start()

/** Copy a finished result as soon as the browser allows it (see the rule above). */
export const autoCopyText = (text: string) => autoCopier.copy(text)
export const resetAutoCopy = () => autoCopier.reset()

export function useAutoCopy(): AutoCopyState {
  return useSyncExternalStore(autoCopier.subscribe, autoCopier.getState, () => IDLE)
}
