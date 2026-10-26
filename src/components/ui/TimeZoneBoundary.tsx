"use client"

import React, { Fragment } from "react"
import { useTimeZoneRedraws } from "@/hooks/useTimeZone"

/**
 * Draws the page again, once, when the signed-in person's timezone turns out to differ from the one
 * the page was first drawn in (a first visit in this browser, or a zone changed on another device),
 * so no time on screen is left in the wrong zone. It only reads a counter in this tab and asks no
 * server, so pages anyone may open (the help page, the shared links) are drawn exactly as before.
 * Tool stores live outside React, so a redraw keeps every draft and result.
 */
export const TimeZoneBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const redraws = useTimeZoneRedraws()
  return <Fragment key={redraws}>{children}</Fragment>
}
