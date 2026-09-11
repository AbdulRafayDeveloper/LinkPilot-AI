"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Long enough to read the "saved" confirmation before the editor closes
const CLOSE_AFTER_SAVE_MS = 1000

/**
 * Closes a prompt editor shortly after a successful save. While it's closing, the editor
 * should stay read-only so nothing typed in that moment is lost.
 */
export function useCloseAfterSave(onClose: () => void) {
  const [isClosing, setIsClosing] = useState(false)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isClosing) return
    const timer = window.setTimeout(() => onCloseRef.current(), CLOSE_AFTER_SAVE_MS)
    return () => window.clearTimeout(timer)
  }, [isClosing])

  const closeAfterSave = useCallback(() => setIsClosing(true), [])
  return { isClosing, closeAfterSave }
}
