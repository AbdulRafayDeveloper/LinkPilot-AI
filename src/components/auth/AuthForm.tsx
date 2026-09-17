"use client"

import React, { useId, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, User } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import {
  AUTH_ENDPOINTS,
  AUTH_MESSAGES,
  EMAIL_MAX_LENGTH,
  LOGIN_PATH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SIGNUP_PATH,
} from "@/constants/auth"
import type { Viewer } from "@/types/auth"

type Mode = "login" | "signup"

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: React.ElementType
  trailing?: React.ReactNode
  inputRef?: React.Ref<HTMLInputElement>
  // Shown under the field; `invalid` also marks the field itself
  invalid?: boolean
  hint?: React.ReactNode
}

const Field: React.FC<FieldProps> = ({ label, icon: Icon, trailing, inputRef, invalid = false, hint, id, ...input }) => {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const hintId = `${inputId}-hint`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-semibold text-on-surface">
        {label}
      </label>
      <div className="relative">
        <Icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true" />
        <input
          id={inputId}
          ref={inputRef}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? hintId : undefined}
          {...input}
          className={`h-11 w-full rounded-xl border bg-surface-container-lowest pl-10 pr-11 text-[14px] text-on-surface transition-colors placeholder:text-outline focus:bg-white focus:outline-none focus:ring-2 ${
            invalid ? "border-error focus:border-error focus:ring-error/25" : "border-outline-variant focus:border-primary focus:ring-primary/25"
          }`}
        />
        {trailing}
      </div>
      {hint && (
        <div id={hintId} aria-live="polite">
          {hint}
        </div>
      )}
    </div>
  )
}

// Only a path inside the app, so a crafted ?next= can't send someone to another site
const safeNext = (value: string | null) => (value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/")

/**
 * The sign-in and sign-up form. On success the page reloads at the page the person was trying
 * to open, so every part of the app starts from the new account.
 */
export const AuthForm: React.FC<{ mode: Mode; signupEnabled: boolean }> = ({ mode, signupEnabled }) => {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  // A mismatch is only called out once the person has finished typing the confirmation
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const confirmRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const errorId = useId()
  const isSignup = mode === "signup"
  const passwordsMatch = confirmPassword !== "" && confirmPassword === password
  const showMismatch = confirmPassword !== "" && !passwordsMatch && (confirmTouched || confirmPassword.length >= password.length)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    setError(null)
    // Checked before anything is sent; the server checks it again
    if (isSignup && password && !passwordsMatch) {
      setConfirmTouched(true)
      setError(confirmPassword ? AUTH_MESSAGES.passwordsDontMatch : AUTH_MESSAGES.missingConfirmPassword)
      confirmRef.current?.focus()
      return
    }
    setIsSubmitting(true)
    try {
      await requestApi<Viewer>(isSignup ? AUTH_ENDPOINTS.signup : AUTH_ENDPOINTS.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isSignup ? { name, email, password, confirmPassword } : { email, password }),
      })
      window.location.assign(safeNext(new URLSearchParams(window.location.search).get("next")))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : isSignup ? AUTH_MESSAGES.signupFailed : AUTH_MESSAGES.signInFailed)
      setIsSubmitting(false)
    }
  }

  if (isSignup && !signupEnabled) {
    return (
      <div className="flex flex-col gap-5">
        <p className="flex gap-2.5 rounded-xl bg-secondary-fixed px-3.5 py-3 text-[13px] leading-snug text-on-surface">
          <AlertCircle size={17} className="mt-0.5 shrink-0 text-secondary-container" aria-hidden="true" />
          {AUTH_MESSAGES.signupClosed}
        </p>
        <Link href={LOGIN_PATH} className="text-center text-[13px] font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-describedby={error ? errorId : undefined}>
      {isSignup && (
        <Field
          label="Name"
          icon={User}
          name="name"
          autoComplete="name"
          required
          maxLength={NAME_MAX_LENGTH}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your full name"
        />
      )}
      <Field
        label="Email"
        icon={Mail}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        required
        maxLength={EMAIL_MAX_LENGTH}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@company.com"
      />
      <Field
        label="Password"
        icon={Lock}
        type={showPassword ? "text" : "password"}
        name="password"
        autoComplete={isSignup ? "new-password" : "current-password"}
        required
        minLength={isSignup ? PASSWORD_MIN_LENGTH : undefined}
        maxLength={PASSWORD_MAX_LENGTH}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value)
          // An error about the old value no longer applies once it changes
          setError(null)
        }}
        placeholder={isSignup ? `At least ${PASSWORD_MIN_LENGTH} characters` : "Your password"}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={`${showPassword ? "Hide" : "Show"} ${isSignup ? "both passwords" : "password"}`}
            aria-pressed={showPassword}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface-container hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        }
      />
      {isSignup && (
        <Field
          label="Confirm password"
          icon={ShieldCheck}
          inputRef={confirmRef}
          type={showPassword ? "text" : "password"}
          name="confirmPassword"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value)
            setError(null)
          }}
          onBlur={() => setConfirmTouched(true)}
          placeholder="Type the same password again"
          invalid={showMismatch}
          hint={
            passwordsMatch ? (
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-success">
                <CheckCircle2 size={14} aria-hidden="true" />
                {AUTH_MESSAGES.passwordsMatch}
              </p>
            ) : showMismatch ? (
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-error">
                <AlertCircle size={14} aria-hidden="true" />
                {AUTH_MESSAGES.passwordsDontMatch}
              </p>
            ) : null
          }
        />
      )}

      {error && (
        <p id={errorId} role="alert" className="flex gap-2 rounded-xl bg-error-container px-3.5 py-2.5 text-[13px] leading-snug text-error">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? (isSignup ? "Creating your account..." : "Signing in...") : isSignup ? "Create account" : "Sign in"}
        {!isSubmitting && <ArrowRight size={16} aria-hidden="true" />}
      </button>

      {(isSignup || signupEnabled) && (
        <p className="pt-2 text-center text-[13px] text-on-surface-variant">
          {isSignup ? "Already have an account? " : "New here? "}
          <Link href={isSignup ? LOGIN_PATH : SIGNUP_PATH} className="font-semibold text-primary hover:underline">
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      )}
    </form>
  )
}
