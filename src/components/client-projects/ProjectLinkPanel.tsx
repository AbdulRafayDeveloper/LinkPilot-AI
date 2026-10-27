"use client"

import React, { useState } from "react"
import { ExternalLink, Link2, Loader2, RefreshCw, X } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { requestApi } from "@/lib/apiClient"
import { CLIENT_PROJECTS_ENDPOINT, PROJECT_TASK_MESSAGES, PUBLIC_PROJECT_PATH } from "@/constants/clientProjectTasks"

interface ProjectLinkPanelProps {
  projectId: string
  // The token of the link that is on, or null when there is none
  token: string | null
  onChanged: (token: string | null) => void
}

/**
 * The link one project is shared by, as **one row**: what it is, and the three or four things to do
 * about it. The server holds only a version, never the link itself, so **New link** stops every
 * earlier one at once and **Turn off** stops them all. The address is built here from the page's own
 * origin, so it is right on localhost and on the live site without the server knowing either.
 *
 * **The address itself is not shown, and neither is what the link allows** (at the owner's request:
 * the panel used to be the tallest thing on the page, above the work it is a footnote to). Copy puts
 * it on the clipboard and Open opens it, which is all either is ever used for. The two tabs a client
 * never sees (`PROJECT_TASK_MESSAGES.privateTabs`) are still refused in three places on the server;
 * they are simply not restated here.
 */
export const ProjectLinkPanel: React.FC<ProjectLinkPanelProps> = ({ projectId, token, onChanged }) => {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const url = token && typeof window !== "undefined" ? `${window.location.origin}${PUBLIC_PROJECT_PATH}/${token}` : null

  const change = async (action: "create" | "replace" | "disable") => {
    if (busy) return
    setBusy(action)
    setError(null)
    try {
      const { data } = await requestApi<{ publicToken: string | null }>(`${CLIENT_PROJECTS_ENDPOINT}/${projectId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      onChanged(data.publicToken)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.linkFailed)
    } finally {
      setBusy(null)
    }
  }

  const buttonClass =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"

  return (
    <section aria-label="The link for this project" className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-outline">
          <Link2 size={14} aria-hidden="true" />
          Share this project
        </h3>
        {url ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <CopyButton text={url} label="Copy the link to this project" showLabel />
            <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass}>
              <ExternalLink size={13} aria-hidden="true" />
              Open
            </a>
            <button type="button" onClick={() => change("replace")} disabled={busy !== null} className={buttonClass}>
              {busy === "replace" ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />}
              New link
            </button>
            <button type="button" onClick={() => change("disable")} disabled={busy !== null} className={`${buttonClass} hover:text-error`}>
              {busy === "disable" ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
              Turn off
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => change("create")} disabled={busy !== null} className={buttonClass}>
            {busy === "create" ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Link2 size={13} aria-hidden="true" />}
            Make a link
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
          {error}
        </p>
      )}
    </section>
  )
}
