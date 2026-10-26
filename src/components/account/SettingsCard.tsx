"use client"

import React from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"

/**
 * One block of Account Settings, the way a settings page is usually laid out: what it is and why at
 * the top, the fields in the middle, and the action with what happened to it along the bottom. Every
 * block on the page is one of these, so the page reads as one piece rather than as a stack of forms.
 */

export type SettingsNotice = { tone: "saved" | "problem"; text: string } | null

interface SettingsCardProps {
  title: string
  description: string
  icon: React.ElementType
  children: React.ReactNode
  // The action along the bottom (a Save button), with the outcome of the last one beside it
  footer?: React.ReactNode
  notice?: SettingsNotice
  // A card whose own menu opens over the cards below it must not clip it
  allowOverflow?: boolean
}

/** What happened to the last save, in words as well as colour. */
export const SettingsNoticeLine: React.FC<{ notice: SettingsNotice }> = ({ notice }) => {
  if (!notice) return null
  const isSaved = notice.tone === "saved"
  const Icon = isSaved ? CheckCircle2 : AlertCircle
  return (
    <p role={isSaved ? "status" : "alert"} className={`flex min-w-0 items-start gap-1.5 text-[13px] font-medium ${isSaved ? "text-success" : "text-error"}`}>
      <Icon size={15} className="mt-px shrink-0" aria-hidden="true" />
      <span>{notice.text}</span>
    </p>
  )
}

export const SettingsCard: React.FC<SettingsCardProps> = ({ title, description, icon: Icon, children, footer, notice = null, allowOverflow = false }) => (
  <section className={`rounded-2xl border border-outline-variant bg-white shadow-sm ${allowOverflow ? "" : "overflow-hidden"}`}>
    <header className="flex items-start gap-3 border-b border-outline-variant/70 px-5 py-4 sm:px-6">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-on-surface">{title}</h2>
        <p className="mt-0.5 text-[13px] leading-relaxed text-on-surface-variant">{description}</p>
      </div>
    </header>
    <div className="px-5 py-5 sm:px-6">{children}</div>
    {(footer || notice) && (
      <footer className="flex flex-col-reverse gap-3 rounded-b-2xl border-t border-outline-variant/70 bg-surface-container-lowest px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <SettingsNoticeLine notice={notice} />
        </div>
        {footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{footer}</div>}
      </footer>
    )}
  </section>
)

/** One read-only line of the account's details: a label on the left and its value on the right. */
export const SettingsRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6">
    <dt className="w-40 shrink-0 text-[13px] font-medium text-outline">{label}</dt>
    <dd className="min-w-0 text-[14px] text-on-surface">{children}</dd>
  </div>
)

// The look every field on the page shares, so they line up with one another
export const SETTINGS_FIELD =
  "w-full rounded-xl border border-outline-variant bg-white px-3.5 py-2.5 text-[14px] text-on-surface placeholder:text-outline transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"

export const SETTINGS_LABEL = "mb-1.5 block text-[13px] font-semibold text-on-surface"

export const SETTINGS_PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"

export const SETTINGS_SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-3.5 py-2 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
