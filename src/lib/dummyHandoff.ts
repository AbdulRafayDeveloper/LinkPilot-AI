import type { DummyDataKind } from "@/constants/dummyData"

/**
 * Handing one piece of sample data from the Dummy Data module to the tool it belongs to.
 *
 * Dummy Data lives in one place now (Administration), so **Use** has to open another page with the
 * item already in its inputs. The item is left in the tab's own `sessionStorage` and the browser is
 * sent to the tool, which picks it up as it mounts and clears it. The tab's storage rather than the
 * address, because a profile or a conversation runs to tens of thousands of characters, which no
 * URL would carry, and because what is handed over is nobody else's business.
 *
 * It is taken exactly once: reading it clears it, so a reload or a later visit to the same tool
 * starts from whatever the user had, never from sample data they have forgotten about.
 */

const KEY = "linkpilot:dummy-handoff"
// A handoff is for the page that opens next; anything older was abandoned
const GOOD_FOR_MS = 60_000

interface DummyHandoff {
  kind: DummyDataKind
  // The item's fields, keyed as the kind's own fields are (constants/dummyData.ts)
  fields: Record<string, string>
  name: string
  at: number
}

/** Leaves the item for the tool that opens next. */
export function putDummyHandoff(kind: DummyDataKind, name: string, fields: Record<string, string>): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ kind, name, fields, at: Date.now() } satisfies DummyHandoff))
  } catch {
    // A browser with storage switched off simply opens the tool with nothing filled in
  }
}

/**
 * The item waiting for this tool, or null. It is cleared whether or not it was for this kind, so a
 * handoff can never sit in the tab waiting to surprise another tool later.
 */
export function takeDummyHandoff(kind: DummyDataKind): DummyHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const handoff = JSON.parse(raw) as DummyHandoff
    if (handoff.kind !== kind || Date.now() - handoff.at > GOOD_FOR_MS) return null
    return handoff
  } catch {
    return null
  }
}
