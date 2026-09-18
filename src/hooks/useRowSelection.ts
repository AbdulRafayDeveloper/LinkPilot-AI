"use client"

import { useCallback, useMemo, useRef, useState } from "react"

/**
 * The rows a user has ticked in a list, for deleting or acting on several at once. A row that has
 * gone (deleted, or left behind on another page) stops counting as picked, so what the page says is
 * picked is always something it is showing. Shift picks everything between the last pick and this one.
 */
export function useRowSelection(visibleIds: readonly string[]) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const lastPicked = useRef<string | null>(null)
  const onPage = useMemo(() => new Set(visibleIds), [visibleIds])
  const pickedIds = useMemo(() => new Set([...picked].filter((id) => onPage.has(id))), [picked, onPage])

  const clear = useCallback(() => {
    setPicked(new Set())
    lastPicked.current = null
  }, [])

  const pick = useCallback(
    (id: string, isRange: boolean) => {
      setPicked((current) => {
        const next = new Set(current)
        const from = lastPicked.current ? visibleIds.indexOf(lastPicked.current) : -1
        const to = visibleIds.indexOf(id)
        if (isRange && from >= 0 && to >= 0) {
          for (const entry of visibleIds.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(entry)
        } else if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
      lastPicked.current = id
    },
    [visibleIds]
  )

  const pickAll = useCallback(() => {
    setPicked(new Set(visibleIds))
    lastPicked.current = visibleIds[visibleIds.length - 1] ?? null
  }, [visibleIds])

  return { pickedIds, pick, pickAll, clear, isPicked: (id: string) => pickedIds.has(id) }
}
