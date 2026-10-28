"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Eye, EyeOff, KeyRound, Loader2, Lock, LockKeyhole, ShieldCheck } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import {
  FINANCE_LOCKED_EVENT,
  FINANCE_LOCK_ENDPOINT,
  FINANCE_LOCK_MESSAGES,
  FINANCE_PASSWORD_MAX_LENGTH,
  FINANCE_PASSWORD_MIN_LENGTH,
  type FinanceLockAction,
} from "@/constants/financeLock"

type GateState = "checking" | "set" | "unlock" | "reset" | "open" | "error"

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
const labelClass = "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-outline"

const post = (action: FinanceLockAction, fields: Record<string, string> = {}) =>
  requestApi<{ unlocked: boolean }>(FINANCE_LOCK_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...fields }) })

const PasswordField: React.FC<{ id: string; label: string; value: string; onChange: (value: string) => void; shown: boolean; disabled: boolean; autoComplete: string; inputRef?: React.Ref<HTMLInputElement> }> = ({
  id,
  label,
  value,
  onChange,
  shown,
  disabled,
  autoComplete,
  inputRef,
}) => (
  <div>
    <label htmlFor={id} className={labelClass}>
      {label}
    </label>
    <input
      id={id}
      ref={inputRef}
      type={shown ? "text" : "password"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      maxLength={FINANCE_PASSWORD_MAX_LENGTH}
      autoComplete={autoComplete}
      disabled={disabled}
      className={fieldClass}
    />
  </div>
)

/**
 * The door in front of the whole Finance area (constants/financeLock.ts). Every Finance page renders
 * inside it, and nothing of the page is drawn until Finance is open in this browser: the first visit
 * asks the person to choose a Finance password, every visit after asks for it, and a forgotten one is
 * reset with the password they sign in with. The server refuses Finance data without the unlock
 * anyway (`requireViewer`), so this is the friendly half of a lock that does not depend on it.
 *
 * Once open, a small "Lock Finance" button stays in the corner, and Finance locks itself again when
 * the browser closes or it is left unused, at which point any request puts this screen back.
 */
export const FinanceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GateState>("checking")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [current, setCurrent] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [shown, setShown] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isChanging, setIsChanging] = useState(false)
  const firstField = useRef<HTMLInputElement>(null)

  const check = useCallback(async () => {
    try {
      const { data } = await requestApi<{ hasPassword: boolean; unlocked: boolean }>(FINANCE_LOCK_ENDPOINT)
      setState(data.unlocked ? "open" : data.hasPassword ? "unlock" : "set")
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : FINANCE_LOCK_MESSAGES.failed)
      setState("error")
    }
  }, [])

  useEffect(() => {
    const first = requestAnimationFrame(() => void check())
    // A Finance request refused for being locked brings this screen back, whichever page asked
    const onLocked = () => void check()
    window.addEventListener(FINANCE_LOCKED_EVENT, onLocked)
    return () => {
      cancelAnimationFrame(first)
      window.removeEventListener(FINANCE_LOCKED_EVENT, onLocked)
    }
  }, [check])

  const reset = (next: GateState) => {
    setCurrent("")
    setPassword("")
    setConfirm("")
    setError(null)
    setState(next)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isBusy) return
    if (state !== "unlock") {
      if (password.length < FINANCE_PASSWORD_MIN_LENGTH) return setError(FINANCE_LOCK_MESSAGES.tooShort)
      if (password !== confirm) return setError(FINANCE_LOCK_MESSAGES.mismatch)
    }
    setIsBusy(true)
    setError(null)
    try {
      if (state === "set") await post("set", { password, confirmPassword: confirm })
      else if (state === "unlock") await post("unlock", { password })
      else await post("reset", { accountPassword: current, password, confirmPassword: confirm })
      reset("open")
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : FINANCE_LOCK_MESSAGES.failed)
    } finally {
      setIsBusy(false)
    }
  }

  const lockNow = async () => {
    try {
      await post("lock")
    } finally {
      reset("unlock")
    }
  }

  if (state === "open") {
    return (
      <>
        {children}
        <div data-print-hide className="fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest p-1 shadow-lg">
          <span className="hidden items-center gap-1.5 pl-2.5 pr-1 text-[12px] font-semibold text-on-surface-variant sm:inline-flex">
            <ShieldCheck size={14} className="text-success" aria-hidden="true" /> Finance open
          </span>
          <button
            type="button"
            onClick={() => setIsChanging(true)}
            title="Finance password and devices"
            aria-label="Finance password and devices"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
          >
            <KeyRound size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void lockNow()}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3.5 text-[13px] font-semibold text-white hover:bg-primary-hover"
          >
            <Lock size={14} aria-hidden="true" /> Lock Finance
          </button>
        </div>
        {isChanging && <ChangeFinancePassword onClose={() => setIsChanging(false)} />}
      </>
    )
  }

  const title = state === "set" ? FINANCE_LOCK_MESSAGES.setTitle : state === "reset" ? "Reset your Finance password" : FINANCE_LOCK_MESSAGES.unlockTitle
  const intro =
    state === "set"
      ? FINANCE_LOCK_MESSAGES.setIntro
      : state === "reset"
        ? "Enter the password you sign in with, then choose a new Finance password."
        : FINANCE_LOCK_MESSAGES.unlockIntro

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />
      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />
        <main className="flex flex-1 items-start justify-center overflow-y-auto bg-background p-4 pt-10 md:items-center md:pt-4">
          {state === "checking" && (
            <p className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Checking Finance...
            </p>
          )}
          {state === "error" && (
            <div className="flex flex-col items-center gap-3 text-center text-sm text-on-surface-variant" role="alert">
              {error}
              <button type="button" onClick={() => void check()} className="font-semibold text-primary underline">
                Try again
              </button>
            </div>
          )}
          {(state === "set" || state === "unlock" || state === "reset") && (
            <form onSubmit={(event) => void submit(event)} className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <LockKeyhole size={24} aria-hidden="true" />
              </span>
              <h1 className="mt-4 text-xl font-bold text-on-surface">{title}</h1>
              <p className="mt-1 text-sm text-on-surface-variant">{intro}</p>
              <div className="mt-5 flex flex-col gap-3">
                {state === "reset" && (
                  <PasswordField id="finance-account-password" label="Password you sign in with" value={current} onChange={setCurrent} shown={shown} disabled={isBusy} autoComplete="current-password" inputRef={firstField} />
                )}
                <PasswordField
                  id="finance-password"
                  label={state === "unlock" ? "Finance password" : "New Finance password"}
                  value={password}
                  onChange={setPassword}
                  shown={shown}
                  disabled={isBusy}
                  autoComplete={state === "unlock" ? "current-password" : "new-password"}
                  inputRef={state === "reset" ? undefined : firstField}
                />
                {state !== "unlock" && (
                  <PasswordField id="finance-password-again" label="Type it again" value={confirm} onChange={setConfirm} shown={shown} disabled={isBusy} autoComplete="new-password" />
                )}
                <button type="button" onClick={() => setShown((value) => !value)} className="inline-flex items-center gap-1.5 self-start text-[12px] font-semibold text-on-surface-variant hover:text-on-surface">
                  {shown ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />} {shown ? "Hide passwords" : "Show passwords"}
                </button>
              </div>
              <div className="mt-2 min-h-5 text-[12px]" aria-live="polite">
                {error && (
                  <p role="alert" className="text-error">
                    {error}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={isBusy || !password || (state === "reset" && !current)}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {isBusy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}
                {state === "unlock" ? "Open Finance" : state === "set" ? "Set password and open" : "Reset and open"}
              </button>
              <p className="mt-4 text-[11px] leading-relaxed text-on-surface-variant">{FINANCE_LOCK_MESSAGES.stays}</p>
              {state === "unlock" && (
                <button type="button" onClick={() => reset("reset")} className="mt-2 text-[12px] font-semibold text-primary hover:underline">
                  {FINANCE_LOCK_MESSAGES.forgotHint}
                </button>
              )}
              {state === "reset" && (
                <button type="button" onClick={() => reset("unlock")} className="mt-2 text-[12px] font-semibold text-primary hover:underline">
                  Back to the Finance password
                </button>
              )}
            </form>
          )}
        </main>
      </div>
    </div>
  )
}

/** Changes the Finance password from inside Finance, with the one in use now. */
const ChangeFinancePassword: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [current, setCurrent] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [shown, setShown] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const firstField = useRef<HTMLInputElement>(null)

  const [everywhere, setEverywhere] = useState<string | null>(null)
  const lockEverywhere = async () => {
    setIsBusy(true)
    setError(null)
    try {
      const { message } = await post("lock-all")
      setEverywhere(message ?? FINANCE_LOCK_MESSAGES.lockedEverywhere)
      // This device is one of them, so the page goes back to the lock screen
      window.dispatchEvent(new Event(FINANCE_LOCKED_EVENT))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : FINANCE_LOCK_MESSAGES.failed)
    } finally {
      setIsBusy(false)
    }
  }

  const save = async () => {
    if (password.length < FINANCE_PASSWORD_MIN_LENGTH) return setError(FINANCE_LOCK_MESSAGES.tooShort)
    if (password !== confirm) return setError(FINANCE_LOCK_MESSAGES.mismatch)
    setIsBusy(true)
    setError(null)
    try {
      await post("change", { currentPassword: current, password, confirmPassword: confirm })
      setDone(true)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : FINANCE_LOCK_MESSAGES.failed)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Modal
      title="Finance password and devices"
      description="Changing the password locks Finance on every other device. Each one needs the new password."
      onClose={onClose}
      isCloseDisabled={isBusy}
      initialFocusRef={firstField}
      size="compact"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 text-xs" aria-live="polite">
            {error && <p role="alert" className="text-error">{error}</p>}
            {done && <p className="text-on-surface-variant">{FINANCE_LOCK_MESSAGES.changed}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isBusy} className="whitespace-nowrap rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50">
              {done ? "Close" : "Cancel"}
            </button>
            {!done && (
              <button type="button" onClick={() => void save()} disabled={isBusy || !current || !password} className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
                {isBusy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Change password
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex max-w-md flex-col gap-3">
        <PasswordField id="finance-current" label="Finance password now" value={current} onChange={setCurrent} shown={shown} disabled={isBusy || done} autoComplete="current-password" inputRef={firstField} />
        <PasswordField id="finance-new" label="New Finance password" value={password} onChange={setPassword} shown={shown} disabled={isBusy || done} autoComplete="new-password" />
        <PasswordField id="finance-new-again" label="Type it again" value={confirm} onChange={setConfirm} shown={shown} disabled={isBusy || done} autoComplete="new-password" />
        <button type="button" onClick={() => setShown((value) => !value)} className="inline-flex items-center gap-1.5 self-start text-[12px] font-semibold text-on-surface-variant hover:text-on-surface">
          {shown ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />} {shown ? "Hide passwords" : "Show passwords"}
        </button>
        <div className="mt-2 rounded-xl border border-error/30 bg-error-container/40 p-3">
          <p className="text-[13px] font-semibold text-on-surface">Lock Finance on every device</p>
          <p className="mt-0.5 text-[12px] text-on-surface-variant">
            If someone else may have Finance open on this account, this ends it everywhere at once, this device included. Each device needs the password again.
          </p>
          {everywhere ? (
            <p className="mt-2 text-[12px] font-semibold text-on-surface">{everywhere}</p>
          ) : (
            <button
              type="button"
              onClick={() => void lockEverywhere()}
              disabled={isBusy}
              className="mt-2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-error px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              <Lock size={13} aria-hidden="true" /> Lock on every device
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
