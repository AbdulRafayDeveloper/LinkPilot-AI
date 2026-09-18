"use client"

import React, { useRef, useState } from "react"
import { ExternalLink, Link2, Link2Off, Loader2, RefreshCw } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import { EMPLOYEES_ENDPOINT, EMPLOYEE_MESSAGES, PUBLIC_PLAN_PATH } from "@/constants/employees"
import type { Employee } from "@/types/employees"

/**
 * The employee's own link to their daily plan: open it without signing in, see today's tasks and
 * the history, tick tasks off and reset today. An inactive employee's link doesn't open.
 *
 * This is in three parts on purpose. The buttons that change the link sit at the top of the
 * employee, beside Edit and Delete, because that is where a manager looks for actions on this
 * person; the link itself, with Copy and Open, stays lower down where it is read and used. Keeping
 * them apart is what stopped New link and Turn off being pressed by mistake while copying the link.
 * usePlanLink holds the one piece of state both halves share, so the parent calls it once.
 */

type PlanLinkAction = "create" | "replace" | "disable"
// Making a new link stops the old one, and turning it off stops it altogether, so neither happens
// on a single click. Creating the first link takes nothing away, so it is not confirmed.
type ConfirmedAction = Exclude<PlanLinkAction, "create">

const smallButton =
  "inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
const headerButton =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant px-3 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"

export interface PlanLink {
  url: string | null
  busy: PlanLinkAction | null
  error: string | null
  confirming: ConfirmedAction | null
  ask: (action: ConfirmedAction) => void
  cancel: () => void
  run: (action: PlanLinkAction) => void
}

/**
 * The link's address and everything that changes it, held once for both halves of the UI. It takes
 * the employee who is open, which is null before anyone is chosen, so the page can call it at the
 * top level like any other hook.
 */
export function usePlanLink(employee: Employee | null, onChange: (employee: Employee) => void): PlanLink {
  const [busy, setBusy] = useState<PlanLinkAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<ConfirmedAction | null>(null)
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin))

  const run = async (action: PlanLinkAction) => {
    if (!employee) return
    setBusy(action)
    setError(null)
    try {
      const { data } = await requestApi<Employee>(
        `${EMPLOYEES_ENDPOINT}/${employee.id}/plan-link`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) },
        { idempotent: true }
      )
      onChange(data)
      setConfirming(null)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.linkFailed)
    } finally {
      setBusy(null)
    }
  }

  return {
    url: employee?.planLink ? `${origin}${PUBLIC_PLAN_PATH}/${employee.planLink}` : null,
    busy,
    error,
    confirming,
    ask: setConfirming,
    // A failed attempt leaves the popup open with its reason, so Cancel clears both
    cancel: () => {
      setConfirming(null)
      setError(null)
    },
    run: (action) => void run(action),
  }
}

/**
 * The link's actions, for the row that already holds Edit and Delete. Nothing here acts on one
 * click except creating the very first link, which takes nothing away.
 */
export const PlanLinkActions: React.FC<{ link: PlanLink }> = ({ link }) =>
  link.url ? (
    <>
      <button
        type="button"
        onClick={() => link.ask("replace")}
        disabled={link.busy !== null}
        title="Make a new link; the one in use now stops working"
        className={`${headerButton} text-on-surface hover:bg-surface-container-high`}
      >
        <RefreshCw size={14} aria-hidden="true" />
        New link
      </button>
      <button
        type="button"
        onClick={() => link.ask("disable")}
        disabled={link.busy !== null}
        title="Turn the link off until you make a new one"
        className={`${headerButton} text-outline hover:border-error/40 hover:text-error`}
      >
        <Link2Off size={14} aria-hidden="true" />
        Turn off
      </button>
    </>
  ) : (
    <button
      type="button"
      onClick={() => link.run("create")}
      disabled={link.busy !== null}
      className={`${headerButton} border-primary text-primary hover:bg-primary-fixed/40`}
    >
      {link.busy === "create" ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
      Create link
    </button>
  )

/** The link itself: what it is, what it does, and the two safe things to do with it. */
export const PlanLinkPanel: React.FC<{ employee: Employee; link: PlanLink }> = ({ employee, link }) => (
  <div className="mt-4 flex flex-col gap-2 border-t border-outline-variant/70 pt-4">
    <div>
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-on-surface">
        <Link2 size={15} className="text-primary" aria-hidden="true" />
        Employee&apos;s plan link
      </p>
      <p className="text-[12px] text-on-surface-variant">
        {link.url
          ? employee.status === "active"
            ? "Anyone with this link can see and tick off this employee's daily tasks, without signing in."
            : "The link is on, but it won't open while the employee is inactive."
          : "Share a link so the employee can tick off their daily tasks without an account."}
      </p>
    </div>

    {link.url && (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          readOnly
          value={link.url}
          aria-label="Employee's plan link"
          onFocus={(event) => event.target.select()}
          className="h-9 min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 font-code text-[12px] text-on-surface-variant"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <CopyButton text={link.url} label="Copy the employee's plan link" variant="prominent" buttonText="Copy link" />
          <a href={link.url} target="_blank" rel="noopener noreferrer" className={smallButton}>
            <ExternalLink size={13} aria-hidden="true" />
            Open
          </a>
        </div>
      </div>
    )}

    {/* A failure while the popup is closed still has to be seen, since the buttons are elsewhere now */}
    {link.error && link.confirming === null && (
      <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-[12px] text-error">
        {link.error}
      </p>
    )}
  </div>
)

/** Asks before either action that stops the link the employee is using. */
export const PlanLinkConfirmDialog: React.FC<{ employee: Employee; link: PlanLink }> = ({ employee, link }) => {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const action = link.confirming
  if (action === null) return null
  const isReplacing = action === "replace"
  const isWorking = link.busy === action

  return (
    <Modal
      title={isReplacing ? EMPLOYEE_MESSAGES.newLinkTitle : EMPLOYEE_MESSAGES.turnOffTitle}
      description={`${employee.name}${"’"}s plan link.`}
      onClose={link.cancel}
      isCloseDisabled={isWorking}
      size="compact"
      initialFocusRef={cancelRef}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] text-xs" aria-live="polite">
            {link.error && (
              <p role="alert" className="text-error">
                {link.error}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={link.cancel}
              disabled={isWorking}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => link.run(action)}
              disabled={isWorking}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                isReplacing ? "bg-primary hover:bg-on-primary-fixed-variant" : "bg-error hover:bg-error/90"
              }`}
            >
              {isWorking ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : isReplacing ? (
                <RefreshCw size={16} aria-hidden="true" />
              ) : (
                <Link2Off size={16} aria-hidden="true" />
              )}
              {isReplacing ? EMPLOYEE_MESSAGES.newLinkConfirm : EMPLOYEE_MESSAGES.turnOffConfirm}
            </button>
          </div>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-on-surface-variant">
        {isReplacing ? EMPLOYEE_MESSAGES.newLinkExplains : EMPLOYEE_MESSAGES.turnOffExplains}
      </p>
    </Modal>
  )
}
