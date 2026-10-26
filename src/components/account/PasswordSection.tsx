"use client"

import React, { useState } from "react"
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import { ACCOUNT_ENDPOINTS, ACCOUNT_MESSAGES } from "@/constants/account"
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/constants/auth"
import { SETTINGS_FIELD, SETTINGS_LABEL, SETTINGS_PRIMARY_BUTTON, SettingsCard } from "./SettingsCard"

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
    <div>
      <label htmlFor={id} className={SETTINGS_LABEL}>
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
        className={SETTINGS_FIELD}
      />
    </div>
  )

  return (
    <SettingsCard
      title={ACCOUNT_MESSAGES.passwordTitle}
      description={ACCOUNT_MESSAGES.passwordHint}
      icon={KeyRound}
      notice={problem ? { tone: "problem", text: problem } : saved ? { tone: "saved", text: saved } : null}
      footer={
        <button type="button" onClick={change} disabled={isSaving} className={SETTINGS_PRIMARY_BUTTON}>
          {isSaving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <KeyRound size={15} aria-hidden="true" />}
          Update password
        </button>
      }
    >
      <div className="flex max-w-md flex-col gap-4">
        {field("current-password", "Current password", currentPassword, setCurrentPassword, "current-password")}
        <div className="border-t border-outline-variant/60" aria-hidden="true" />
        {field("new-password", "New password", newPassword, setNewPassword, "new-password")}
        {field("confirm-password", "Confirm new password", confirmPassword, setConfirmPassword, "new-password")}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-outline">At least {PASSWORD_MIN_LENGTH} characters.</p>
          <button
            type="button"
            onClick={() => setIsShown((shown) => !shown)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            {isShown ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
            {isShown ? "Hide passwords" : "Show passwords"}
          </button>
        </div>
      </div>
    </SettingsCard>
  )
}
