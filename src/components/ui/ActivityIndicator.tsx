"use client"

import React from "react"
import { usePathname, useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { LINKEDIN_TOOLS } from "@/constants/linkedinTools"
import { useToolActivity, type ToolActivity } from "@/lib/toolActivity"

const titleOf = (href: string) => LINKEDIN_TOOLS.find((tool) => tool.href === href)?.title ?? "A tool"

const STYLE = {
  running: "border-primary/20 bg-primary-fixed/40 text-primary",
  ready: "border-primary/25 bg-primary-fixed/60 text-on-primary-fixed-variant",
  failed: "border-error/25 bg-error-container text-on-error-container",
} as const

function describe({ href, state }: ToolActivity): string {
  const title = titleOf(href)
  if (state === "running") return `${title} is writing`
  return state === "ready" ? `${title} is ready` : `${title} didn't finish`
}

/**
 * Header status for work happening on other pages: a generation still running there, or one
 * that finished (or failed) while the user was elsewhere. One click opens that tool. Nothing
 * shows when there's nothing to report.
 */
export const ActivityIndicator: React.FC = () => {
  const router = useRouter()
  const pathname = usePathname()
  const elsewhere = useToolActivity().filter((entry) => entry.href !== pathname)
  // Finished results first: they're waiting for the user; running ones only need patience
  const ordered = [...elsewhere.filter((entry) => entry.state !== "running"), ...elsewhere.filter((entry) => entry.state === "running")]
  const [primary] = ordered
  const more = ordered.length - 1

  return (
    <div aria-live="polite" className="min-w-0">
      {primary && (
        <button
          type="button"
          onClick={() => router.push(primary.href)}
          title={ordered.map(describe).join("\n")}
          className={`inline-flex h-9 max-w-full items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${STYLE[primary.state]}`}
        >
          {primary.state === "running" ? (
            <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden="true" />
          ) : primary.state === "ready" ? (
            <CheckCircle2 size={14} className="shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">{describe(primary)}</span>
          {more > 0 && <span className="shrink-0 rounded-md bg-surface-container-lowest/70 px-1.5 py-0.5 text-[10px]">+{more}</span>}
        </button>
      )}
    </div>
  )
}
