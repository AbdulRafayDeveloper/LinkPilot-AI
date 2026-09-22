"use client"

import React, { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Square } from "lucide-react"
import { profileHandle } from "@/lib/linkedinProfile"
import { OPEN_ALL_GAP_MS, PROFILE_SCHEDULER_MESSAGES, allowPopupsSteps } from "@/constants/profileScheduler"

interface OpenAllProfilesProps {
  // The profile links on the page, in the order shown
  urls: string[]
  // Which list they are: a run belongs to the list it started on, so another page or filter never shows it
  listKey: string
  disabled: boolean
  buttonClassName: string
}

type Mode = "timed" | "step" | "done" | "stopped"

interface Run {
  list: string
  urls: string[]
  // How many of `urls`, from the first, have been opened
  opened: number
  mode: Mode
}

/** One LinkedIn tab, cut off from this page; false when the browser refused it. */
const openTab = (url: string) => {
  const tab = window.open(url, "_blank")
  if (!tab) return false
  tab.opener = null
  return true
}

const next = (run: Run, mode: Mode): Run => {
  const opened = run.opened + 1
  return { ...run, opened, mode: opened >= run.urls.length ? "done" : mode }
}

/**
 * Open all, done the way a browser allows. The click opens the first profile at once (one click may
 * always open one tab); the rest follow one every OPEN_ALL_GAP_MS, which a browser lets a page do
 * only once the site is allowed pop-ups. When it isn't, the first refused tab switches to opening
 * the rest one click each (a plain link, so Ctrl+click keeps you on this page), with the steps to
 * allow pop-ups beside it. Stop ends a run at any point, and Open all carries on from where it stopped.
 */
export const OpenAllProfiles: React.FC<OpenAllProfilesProps> = ({ urls, listKey, disabled, buttonClassName }) => {
  const [run, setRun] = useState<Run | null>(null)
  const active = run?.list === listKey ? run : null
  const remaining = active && (active.mode === "step" || active.mode === "stopped") ? active.urls.length - active.opened : 0

  // The timed run: one tab per tick, until the list is done, the browser refuses one, or it is stopped
  useEffect(() => {
    if (!active || active.mode !== "timed") return
    const timer = window.setTimeout(() => {
      const ok = openTab(active.urls[active.opened])
      setRun((current) => (current === active ? (ok ? next(active, "timed") : { ...active, mode: "step" }) : current))
    }, OPEN_ALL_GAP_MS)
    return () => window.clearTimeout(timer)
  }, [active])

  const start = () => {
    if (disabled || active?.mode === "timed") return
    // A run that stopped or fell back to one click each carries on with the profiles still to open
    const from = remaining > 0 && active ? active : { list: listKey, urls, opened: 0, mode: "timed" as Mode }
    if (!openTab(from.urls[from.opened])) {
      setRun({ ...from, mode: "step" })
      return
    }
    setRun(next(from, "timed"))
  }

  const stop = () => setRun((current) => (current && current.mode !== "done" ? { ...current, mode: "stopped" } : current))

  const host = typeof window === "undefined" ? "this site" : window.location.host
  const nextUrl = active?.mode === "step" ? active.urls[active.opened] : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="min-w-0 flex-1 text-[12px]">
          {!active ? (
            <span className="text-on-surface-variant">{PROFILE_SCHEDULER_MESSAGES.openAllHint(urls.length)}</span>
          ) : active.mode === "timed" ? (
            <span className="flex items-center gap-1.5 text-on-surface-variant">
              <Loader2 size={14} className="shrink-0 animate-spin text-primary" aria-hidden="true" />
              {PROFILE_SCHEDULER_MESSAGES.opening(active.opened, active.urls.length)}
            </span>
          ) : active.mode === "step" ? (
            <span className="flex gap-1.5 rounded-lg bg-secondary-fixed px-2.5 py-1.5 text-on-secondary-fixed-variant">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              {PROFILE_SCHEDULER_MESSAGES.popupsBlocked(active.opened, active.urls.length)}
            </span>
          ) : active.mode === "stopped" ? (
            <span className="text-on-surface-variant">{PROFILE_SCHEDULER_MESSAGES.stopped(active.opened, active.urls.length)}</span>
          ) : (
            <span className="flex items-center gap-1.5 text-on-success-container">
              <CheckCircle2 size={14} className="text-success" aria-hidden="true" />
              {PROFILE_SCHEDULER_MESSAGES.openedAll(active.opened)}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {(active?.mode === "timed" || active?.mode === "step") && (
            <button type="button" onClick={stop} className={`${buttonClassName} whitespace-nowrap`}>
              <Square size={12} aria-hidden="true" />
              Stop
            </button>
          )}
          <button
            type="button"
            onClick={start}
            disabled={disabled || active?.mode === "timed"}
            className={`${buttonClassName} whitespace-nowrap disabled:opacity-60`}
          >
            <ExternalLink size={14} aria-hidden="true" />
            {remaining > 0 ? `Open the other ${remaining}` : `Open all ${urls.length} on LinkedIn`}
          </button>
        </div>
      </div>

      {active && nextUrl && (
        <div className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-white p-3 sm:flex-row sm:items-start sm:justify-between">
          <details className="min-w-0 flex-1 text-[12px] text-on-surface-variant">
            <summary className="cursor-pointer py-1 font-semibold text-on-surface">Let this site open them all by itself</summary>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              {allowPopupsSteps(host).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
          <a
            href={nextUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setRun((current) => (current === active ? next(active, "step") : current))}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant"
          >
            <ExternalLink size={15} aria-hidden="true" />
            Open next: {profileHandle(nextUrl)} ({active.opened + 1} of {active.urls.length})
          </a>
        </div>
      )}
    </div>
  )
}
