"use client"

import React from "react"
import { ExternalLink, Video } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"

interface JoinLinkProps {
  // The meeting's attend link, or null when it has none (nothing is rendered then)
  url: string | null
  // The meeting's name, so the copy button says which meeting's link it takes
  name: string
  // "row" sits among a list row's controls; "panel" is the block on the meeting's own page
  variant?: "row" | "panel"
}

/**
 * Where a meeting is attended, wherever a meeting is shown: **Join**, which opens the Meet, Zoom or
 * Teams link in a new tab, and **Copy**, which puts the address on the clipboard to paste into a
 * message or another calendar.
 *
 * Copy is beside Join rather than hidden behind it because the two are wanted at different moments:
 * Join as the call starts, Copy when the link is being sent to someone. It is one component so the
 * three places that show a meeting (today's list, the day panel and the meeting's own page) can
 * never drift apart on what the link looks like or what the copy button copies.
 */
export const JoinLink: React.FC<JoinLinkProps> = ({ url, name, variant = "row" }) => {
  if (!url) return null
  const copyLabel = `Copy the attend link for ${name}`

  if (variant === "row") {
    return (
      <span className="flex shrink-0 items-center gap-0.5">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open the attend link"
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-primary/40 bg-primary/5 px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/10"
        >
          <Video size={12} aria-hidden="true" />
          Join
        </a>
        <CopyButton text={url} label={copyLabel} />
      </span>
    )
  }

  return (
    <section
      aria-label="How to attend this meeting"
      className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Video size={16} className="shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-outline">Attend link</span>
          {/* The address itself, so it can be read and checked before the call rather than only opened */}
          <span className="block truncate text-[12px] text-on-surface-variant" title={url}>
            {url}
          </span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <CopyButton text={url} label={copyLabel} variant="prominent" buttonText="Copy link" />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant"
        >
          <ExternalLink size={13} aria-hidden="true" />
          Join the meeting
        </a>
      </div>
    </section>
  )
}
