"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import { ADMIN_ENDPOINTS, ADMIN_MESSAGES } from "@/constants/admin"
import { ROLE_LABELS } from "@/constants/auth"
import type { AccountDeletion, AdminUser, UserActivity } from "@/types/admin"

interface DeleteAccountDialogProps {
  user: AdminUser
  onClose: () => void
  onDeleted: (deletion: AccountDeletion) => void
}

/**
 * Asks before deleting an account for good. It says whose account it is and what goes with it, tool
 * by tool, and Delete stays off until the account's email is typed, so the wrong account can't go on
 * a slip of the mouse. Escape, the backdrop and Cancel all close it without deleting; while the
 * delete runs it can't be closed.
 */
export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({ user, onClose, onDeleted }) => {
  const [activity, setActivity] = useState<UserActivity | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [typed, setTyped] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const inputId = useId()
  const hintId = useId()

  useEffect(() => {
    const controller = new AbortController()
    requestApi<UserActivity>(`${ADMIN_ENDPOINTS.users}/${user.id}`, { signal: controller.signal })
      .then(({ data }) => setActivity(data))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setLoadError(reason instanceof Error ? reason.message : ADMIN_MESSAGES.usersLoadFailed)
      })
    return () => controller.abort()
  }, [user.id])

  const matches = typed.trim().toLowerCase() === user.email.toLowerCase()
  const used = activity?.tools.filter((tool) => tool.count > 0) ?? []
  const total = used.reduce((sum, tool) => sum + tool.count, 0)

  const confirm = async () => {
    if (!matches || isDeleting) return
    setIsDeleting(true)
    setError(null)
    try {
      const { data } = await requestApi<AccountDeletion>(`${ADMIN_ENDPOINTS.users}/${user.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: typed.trim() }),
      })
      onDeleted(data)
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : ADMIN_MESSAGES.deleteFailed
      // Already gone counts as done: the list only needs to catch up
      if (message === ADMIN_MESSAGES.userNotFound) {
        onDeleted({ name: user.name, email: user.email, records: 0, files: 0, tools: [] })
        return
      }
      setError(message)
      setIsDeleting(false)
    }
  }

  return (
    <Modal
      title="Delete this account?"
      description="This deletes the account and everything it made. It cannot be undone."
      onClose={onClose}
      isCloseDisabled={isDeleting}
      initialFocusRef={cancelRef}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] text-xs" aria-live="polite">
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!matches || isDeleting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
              {isDeleting ? "Deleting account..." : "Delete account and all data"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/60 p-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-on-surface">{user.name}</p>
            <p className="truncate text-[13px] text-on-surface-variant">{user.email}</p>
            <p className="mt-0.5 text-[12px] text-on-surface-variant">
              {ROLE_LABELS[user.role]} · signed in {user.loginCount.toLocaleString()} {user.loginCount === 1 ? "time" : "times"}
            </p>
          </div>
        </div>

        <section aria-label="What will be deleted" className="flex flex-col gap-2">
          <h3 className="text-[13px] font-bold text-on-surface">What will be deleted</h3>
          {loadError ? (
            <p className="text-[13px] text-error">{loadError}</p>
          ) : !activity ? (
            <p role="status" className="flex items-center gap-2 text-[13px] text-on-surface-variant">
              <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />
              Counting what this account has made...
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-1 text-[13px] text-on-surface">
                <li>• The account itself, so it can no longer sign in, and any open session ends</li>
                {used.length === 0 ? (
                  <li>• Nothing else: it hasn&apos;t made anything in any tool</li>
                ) : (
                  <li>
                    • {total.toLocaleString()} {total === 1 ? "record" : "records"} across {used.length} {used.length === 1 ? "tool" : "tools"}, including stored files and images
                  </li>
                )}
              </ul>
              {used.length > 0 && (
                <ul className="custom-scrollbar max-h-40 overflow-y-auto rounded-xl border border-outline-variant divide-y divide-outline-variant/60">
                  {used.map((tool) => (
                    <li key={tool.title} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[12px]">
                      <span className="truncate text-on-surface">{tool.title}</span>
                      <span className="shrink-0 font-semibold text-on-surface">{tool.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[12px] text-outline">Its sign-in history stays in Audit Management, with a note of who deleted the account.</p>
            </>
          )}
        </section>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-[13px] font-semibold text-on-surface">
            Type <span className="select-all font-code text-error">{user.email}</span> to confirm
          </label>
          <input
            id={inputId}
            type="email"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void confirm()
              }
            }}
            disabled={isDeleting}
            aria-describedby={hintId}
            placeholder={user.email}
            className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[13px] text-on-surface placeholder:text-outline/60 focus:border-error focus:outline-none focus:ring-2 focus:ring-error/25 disabled:opacity-60"
          />
          <p id={hintId} className={`text-[12px] ${typed && !matches ? "text-error" : "text-outline"}`}>
            {typed && !matches ? "That doesn't match the account's email yet." : "Delete turns on once the email matches."}
          </p>
        </div>
      </div>
    </Modal>
  )
}
