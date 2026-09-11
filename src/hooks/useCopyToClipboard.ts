"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const COPIED_RESET_MS = 1500

/**
 * Copies text to the clipboard and exposes a short-lived `copied` flag for confirmation UI.
 */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS)
      return true
    } catch {
      return false
    }
  }, [])

  return { copied, copy }
}
