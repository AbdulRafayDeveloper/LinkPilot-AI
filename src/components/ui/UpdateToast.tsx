"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { RefreshCw, X } from "lucide-react"
import { APP_UPDATE_MESSAGES } from "@/constants/appVersion"
import { checkForUpdate, latestAppVersion, noAppVersion, subscribeToAppVersion } from "@/lib/appVersion"

/**
 * Says a new version has been deployed and offers to load it, on every page (the root layout).
 *
 * It appears only once an answer from the server names a different build (lib/appVersion.ts), and
 * the tab asks once more whenever it comes back into view, back online or out of the browser's
 * back-forward cache, so one left open overnight still finds out. **Later** hides it for that build
 * only: a deploy after that brings it back. It never takes focus, since it can arrive while someone
 * is typing; it is announced politely instead.
 */
export function UpdateToast() {
  const serverVersion = useSyncExternalStore(subscribeToAppVersion, latestAppVersion, noAppVersion)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") void checkForUpdate()
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) check()
    }
    document.addEventListener("visibilitychange", check)
    window.addEventListener("online", check)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", check)
      window.removeEventListener("online", check)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [])

  if (!serverVersion || serverVersion === dismissedVersion) return null

  const refresh = () => {
    setIsRefreshing(true)
    window.location.reload()
  }
  const later = () => setDismissedVersion(serverVersion)

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[90] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[26rem]"
    >
      <div className="relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 pr-12 shadow-xl motion-safe:animate-toast-in">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary" />
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "motion-safe:animate-spin" : ""}`} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5 text-on-surface">{APP_UPDATE_MESSAGES.title}</p>
            <p className="mt-1 text-sm leading-5 text-on-surface-variant">{APP_UPDATE_MESSAGES.body}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button
            type="button"
            onClick={later}
            disabled={isRefreshing}
            className="h-10 whitespace-nowrap rounded-lg px-4 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            {APP_UPDATE_MESSAGES.later}
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-on-primary-fixed-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-80"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            {isRefreshing ? APP_UPDATE_MESSAGES.refreshing : APP_UPDATE_MESSAGES.refresh}
          </button>
        </div>
        <button
          type="button"
          onClick={later}
          aria-label={APP_UPDATE_MESSAGES.dismiss}
          title={APP_UPDATE_MESSAGES.dismiss}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
