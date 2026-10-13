"use client"

import { useEffect, useRef } from "react"
import type { DummyDataKind } from "@/constants/dummyData"
import { takeDummyHandoff } from "@/lib/dummyHandoff"

/**
 * Fills a tool's inputs with the sample data **Use** handed it, once, as the page opens.
 *
 * Every tool that has sample data calls this with its own kind and the same function its Dummy Data
 * popup used to call, so the filling itself is unchanged: only where it comes from is new. It runs
 * on mount alone (the ref), because a tool store survives switching pages and re-filling it would
 * throw away whatever the user had typed since.
 *
 * Nothing is reported back: the admin has just pressed **Use in <tool>** and the inputs they asked
 * for are in front of them, so a notice would only repeat what the page already shows.
 */
export function useDummyHandoff(kind: DummyDataKind, fill: (fields: Record<string, string>) => void): void {
  const taken = useRef(false)

  useEffect(() => {
    if (taken.current) return
    taken.current = true
    const handoff = takeDummyHandoff(kind)
    if (!handoff) return
    fill(handoff.fields)
    // `fill` closes over the page's own stores and is rebuilt on every render, so it is deliberately
    // not a dependency: this runs once, with whatever the page had when it mounted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])
}
