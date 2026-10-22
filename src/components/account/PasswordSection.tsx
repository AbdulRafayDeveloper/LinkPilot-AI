"use client"

import React, { useState } from "react"
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import { ACCOUNT_ENDPOINTS, ACCOUNT_MESSAGES } from "@/constants/account"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/constants/auth"

/**
 * Changing the password this account signs in with. The current one is typed as well, so a browser
 * someone else left open can't change it, and the three fields are checked here with the same words
 * the server would use.
 *
 * It is **not** retried if the request drops (`lib/apiClient` retries no POST or PUT unless it says
 * so): a password change is not a repeat-safe write, and the person can see for themselves whether
 * it took. Changing it ends every other session; this browser stays signed in, because the route
 * re-issues its cookie.
 */

const FIELD =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-[14px] text-on-surface placeholder:text-outline focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"

export const PasswordSection: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isShown, setIsShown] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  // The same rules the schema has, so the button says what the server would
  const problemNow = (): string | null => {
    if (!currentPassword) return ACCOUNT_MESSAGES.currentRequired
    if (newPassword.length < PASSWORD_MIN_LENGTH) return ACCOUNT_MESSAGES.newTooShort
    if (newPassword.length > PASSWORD_MAX_LENGTH) return ACCOUNT_MESSAGES.newTooLong
    if (!confirmPassword) return ACCOUNT_MESSAGES.confirmRequired
    if (newPassword !== confirmPassword) return ACCOUNT_MESSAGES.confirmMismatch
    if (newPassword === currentPassword) return ACCOUNT_MESSAGES.samePassword
    return null
  }

  const change = async () => {
    const wrong = problemNow()
    setSaved(null)
    if (wrong) {
      setProblem(wrong)
      return
    }
    setIsSaving(true)
    setProblem(null)
    try {
      await requestApi<{ changed: boolean }>(ACCOUNT_ENDPOINTS.password, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setSaved(ACCOUNT_MESSAGES.passwordChanged)
    } catch (error: unknown) {
      setProblem(error instanceof Error ? error.message : ACCOUNT_MESSAGES.passwordFailed)
    } finally {
      setIsSaving(false)
    }
  }

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    autoComplete: "current-password" | "new-password"
  ) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-on-surface">
        {label}
      </label>
      <input
        id={id}
        type={isShown ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        maxLength={PASSWORD_MAX_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void change()
        }}
        className={FIELD}
      />
    </div>
  )

  return (
    <section className="rounded-2xl border border-outline-variant bg-white p-4 sm:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-on-surface">
            <KeyRound size={16} className="text-primary shrink-0" aria-hidden="true" />
            {ACCOUNT_MESSAGES.passwordTitle}
          </h2>
          <p className="mt-1 text-[13px] text-on-surface-variant">{ACCOUNT_MESSAGES.passwordHint}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsShown((shown) => !shown)}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-3 py-2 text-[12px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          {isShown ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          {isShown ? "Hide passwords" : "Show passwords"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {field("current-password", "Password now", currentPassword, setCurrentPassword, "current-password")}
        {field("new-password", "New password", newPassword, setNewPassword, "new-password")}
        {field("confirm-password", "New password again", confirmPassword, setConfirmPassword, "new-password")}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={change}
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <KeyRound size={15} aria-hidden="true" />}
          Change password
        </button>
        <p className="text-[12px] text-outline">At least {PASSWORD_MIN_LENGTH} characters.</p>
      </div>

      {saved && <p className="rounded-xl bg-success-container px-3 py-2 text-[13px] font-medium text-on-success-container">{saved}</p>}
      {problem && <p className="rounded-xl bg-error-container px-3 py-2 text-[13px] font-medium text-on-error-container">{problem}</p>}
    </section>
  )
}
