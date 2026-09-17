"use client"

import { useEffect, useState } from "react"

/** The value once it has stopped changing for `delayMs`, so a search runs when typing settles. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return settled
}
