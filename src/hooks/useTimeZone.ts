"use client"

import { useSyncExternalStore } from "react"
import { subscribeToTimeZone, timeZoneRedraws } from "@/lib/timeZone"

/** How many times the page has had to be redrawn for the account's zone; the root layout keys on it. */
export function useTimeZoneRedraws(): number {
  return useSyncExternalStore(subscribeToTimeZone, timeZoneRedraws, () => 0)
}
