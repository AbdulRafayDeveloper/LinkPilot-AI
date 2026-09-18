"use client"

import { useEffect } from "react"

/**
 * Registers `public/sw.js`, which shows LinkPilot's own offline screen when a page can't load.
 *
 * Only in a production build: in `next dev` a service worker sitting between the page and the dev
 * server gets in the way of hot reloading, and there is nothing offline to show while developing.
 * A browser without service workers simply keeps its own offline page.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
      // Registering is only an improvement: the app works exactly the same without it
      console.warn("Offline screen not available:", error instanceof Error ? error.message : error)
    })
  }, [])
  return null
}
