"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import { AlertTriangle, Eye, EyeOff, KeyRound, Loader2, Lock } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { PromptLoading } from "./PromptModalParts"
import {
  PROMPT_ACCESS_ENDPOINT,
  PROMPT_ACCESS_LOCK_HOURS,
  PROMPT_ACCESS_MAX_ATTEMPTS,
  PROMPT_ACCESS_MESSAGES,
  PROMPT_ACCESS_SESSION_HOURS,
  PROMPT_PASSWORD_MAX_LENGTH,
} from "@/constants/promptAccess"
import type { ApiEnvelope } from "@/types/api"
import { fetchWithRetry } from "@/lib/apiClient"
import type { PromptAccessStatus } from "@/types/promptAccess"

const CHECK_FAILED_MESSAGE = "Couldn't check prompt access. Please try again."

// The access API answers with the current status even when it rejects a password. The status check
// (GET) is retried on a dropped connection; a password (POST) never is, since every attempt counts.
async function callAccessApi(init?: RequestInit): Promise<{ status: PromptAccessStatus | null; message: string | null }> {
  const response = await fetchWithRetry(PROMPT_ACCESS_ENDPOINT, { cache: "no-store", ...init })
  const body = (await response.json().catch(() => null)) as ApiEnvelope<PromptAccessStatus> | null
  return { status: body?.data ?? null, message: body?.message ?? null }
}

const secondaryButton =
  "flex-1 sm:flex-none px-4 py-2 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"

const CloseFooter: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="flex justify-end">
    <button type="button" onClick={onClose} className={secondaryButton}>
      Close
    </button>
  </div>
)

const Notice: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex items-start gap-3 py-2 text-sm text-on-surface-variant leading-relaxed">
    <span className="shrink-0 mt-0.5">{icon}</span>
    <div className="space-y-1">{children}</div>
  </div>
)

interface PasswordPromptProps {
  attemptsLeft: number
  onStatus: (status: PromptAccessStatus) => void
  onClose: () => void
}

const PasswordPrompt: React.FC<PasswordPromptProps> = ({ attemptsLeft, onStatus, onClose }) => {
  const formId = useId()
  const inputId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState("")
  const [isVisible, setIsVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!password) {
      setError(PROMPT_ACCESS_MESSAGES.missingPassword)
      inputRef.current?.focus()
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const { status, message } = await callAccessApi({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (!status) {
        setError(message ?? CHECK_FAILED_MESSAGE)
        return
      }
      if (status.state === "password_required") {
        setError(message ?? CHECK_FAILED_MESSAGE)
        setPassword("")
        inputRef.current?.focus()
      }
      onStatus(status)
    } catch {
      setError(CHECK_FAILED_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      title="Enter prompt password"
      description={`Prompts are password protected. After the correct password, no tool asks again in this browser for ${PROMPT_ACCESS_SESSION_HOURS} hours.`}
      onClose={onClose}
      isCloseDisabled={isSubmitting}
      initialFocusRef={inputRef}
      size="compact"
      footer={
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={isSubmitting} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap gap-2 px-4 py-2 bg-primary hover:bg-on-primary-fixed-variant text-white rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound size={16} aria-hidden="true" />
            )}
            {isSubmitting ? "Checking..." : "Unlock"}
          </button>
        </div>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor={inputId} className="text-[10px] font-bold text-outline uppercase tracking-wider">
          Password
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            id={inputId}
            type={isVisible ? "text" : "password"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              if (error) setError(null)
            }}
            maxLength={PROMPT_PASSWORD_MAX_LENGTH}
            autoComplete="current-password"
            disabled={isSubmitting}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-3 pr-10 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setIsVisible((visible) => !visible)}
            aria-label={isVisible ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 px-3 text-on-surface-variant hover:text-on-surface"
          >
            {isVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        </div>
        <div className="min-h-[20px] text-xs" aria-live="polite">
          {error ? (
            <p id={errorId} role="alert" className="flex items-start gap-1.5 text-error">
              <AlertTriangle size={14} className="shrink-0 mt-px" aria-hidden="true" />
              <span>{error}</span>
            </p>
          ) : (
            <p className="text-outline">
              {attemptsLeft < PROMPT_ACCESS_MAX_ATTEMPTS
                ? `${attemptsLeft} of ${PROMPT_ACCESS_MAX_ATTEMPTS} attempts left.`
                : `${PROMPT_ACCESS_MAX_ATTEMPTS} wrong attempts lock prompt editing for ${PROMPT_ACCESS_LOCK_HOURS} hours.`}
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}

interface PromptAccessGateProps {
  onClose: () => void
  // The prompt editor; rendered (and allowed to load prompts) only once access is granted
  children: React.ReactNode
}

/**
 * Wraps every Update Prompt editor: asks for the prompt password unless this browser
 * already unlocked prompt editing within the last 48 hours, and shows the lockout after
 * too many wrong attempts. The server enforces the same rules on the prompt APIs.
 */
export const PromptAccessGate: React.FC<PromptAccessGateProps> = ({ onClose, children }) => {
  const [checkAttempt, setCheckAttempt] = useState(0)
  const [status, setStatus] = useState<PromptAccessStatus | null>(null)
  const [checkFailed, setCheckFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    callAccessApi({ signal: controller.signal })
      .then((response) => {
        if (!response.status) throw new Error(response.message ?? CHECK_FAILED_MESSAGE)
        setStatus(response.status)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error("Prompt access check failed:", error)
        setCheckFailed(true)
      })
    return () => controller.abort()
  }, [checkAttempt])

  if (status?.state === "unlocked") return <>{children}</>

  if (status?.state === "password_required") {
    return <PasswordPrompt attemptsLeft={status.attemptsLeft} onStatus={setStatus} onClose={onClose} />
  }

  if (status?.state === "locked") {
    return (
      <Modal title="Prompt editing locked" onClose={onClose} size="compact" footer={<CloseFooter onClose={onClose} />}>
        <Notice icon={<Lock size={18} className="text-error" aria-hidden="true" />}>
          <p>{PROMPT_ACCESS_MESSAGES.locked}</p>
          {status.lockedUntil && (
            <p className="font-semibold text-on-surface">
              You can try again after {new Date(status.lockedUntil).toLocaleString()}.
            </p>
          )}
        </Notice>
      </Modal>
    )
  }

  if (status?.state === "disabled") {
    return (
      <Modal title="Prompt editing unavailable" onClose={onClose} size="compact" footer={<CloseFooter onClose={onClose} />}>
        <Notice icon={<Lock size={18} className="text-outline" aria-hidden="true" />}>
          <p>{PROMPT_ACCESS_MESSAGES.disabled}</p>
        </Notice>
      </Modal>
    )
  }

  return (
    <Modal title="Update Prompt" onClose={onClose} size="compact">
      {checkFailed ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-on-surface-variant">{CHECK_FAILED_MESSAGE}</p>
          <button
            type="button"
            onClick={() => {
              setCheckFailed(false)
              setCheckAttempt((attempt) => attempt + 1)
            }}
            className={secondaryButton}
          >
            Try again
          </button>
        </div>
      ) : (
        <PromptLoading text="Checking prompt access..." />
      )}
    </Modal>
  )
}
