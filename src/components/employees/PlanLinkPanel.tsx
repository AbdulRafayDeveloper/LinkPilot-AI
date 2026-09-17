"use client"

import React, { useState } from "react"
import { ExternalLink, Link2, Link2Off, Loader2, RefreshCw } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { requestApi } from "@/lib/apiClient"
import { EMPLOYEES_ENDPOINT, EMPLOYEE_MESSAGES, PUBLIC_PLAN_PATH } from "@/constants/employees"
import type { Employee } from "@/types/employees"

const smallButton =
  "inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"

/**
 * The employee's own link to their daily plan: open it without signing in, see today's tasks and
 * the history, tick tasks off and reset today. Replacing the link stops the old one; turning it off
 * stops it until a new one is made. An inactive employee's link doesn't open.
 */
export const PlanLinkPanel: React.FC<{ employee: Employee; onChange: (employee: Employee) => void }> = ({ employee, onChange }) => {
  const [busy, setBusy] = useState<"create" | "replace" | "disable" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin))
  const url = employee.planLink ? `${origin}${PUBLIC_PLAN_PATH}/${employee.planLink}` : null

  const act = async (action: "create" | "replace" | "disable") => {
    setBusy(action)
    setError(null)
    try {
      const { data } = await requestApi<Employee>(`${EMPLOYEES_ENDPOINT}/${employee.id}/plan-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      onChange(data)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.linkFailed)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-outline-variant/70 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-on-surface">
            <Link2 size={15} className="text-primary" aria-hidden="true" />
            Employee&apos;s plan link
          </p>
          <p className="text-[12px] text-on-surface-variant">
            {url
              ? employee.status === "active"
                ? "Anyone with this link can see and tick off this employee's daily tasks, without signing in."
                : "The link is on, but it won't open while the employee is inactive."
              : "Share a link so the employee can tick off their daily tasks without an account."}
          </p>
        </div>
        {!url && (
          <button type="button" onClick={() => act("create")} disabled={busy !== null} className={`${smallButton} border-primary text-primary`}>
            {busy === "create" ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Link2 size={13} aria-hidden="true" />}
            Create link
          </button>
        )}
      </div>

      {url && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            readOnly
            value={url}
            aria-label="Employee's plan link"
            onFocus={(event) => event.target.select()}
            className="h-9 min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 font-code text-[12px] text-on-surface-variant"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <CopyButton text={url} label="Copy the employee's plan link" variant="prominent" buttonText="Copy link" />
            <a href={url} target="_blank" rel="noopener noreferrer" className={smallButton}>
              <ExternalLink size={13} aria-hidden="true" />
              Open
            </a>
            <button type="button" onClick={() => act("replace")} disabled={busy !== null} className={smallButton} title="Make a new link; the current one stops working">
              {busy === "replace" ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />}
              New link
            </button>
            <button type="button" onClick={() => act("disable")} disabled={busy !== null} className={`${smallButton} text-outline hover:text-error`}>
              {busy === "disable" ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Link2Off size={13} aria-hidden="true" />}
              Turn off
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-[12px] text-error">
          {error}
        </p>
      )}
    </div>
  )
}
