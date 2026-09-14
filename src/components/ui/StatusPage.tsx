import React from "react"
import Image from "next/image"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { SITE_LOGO_PNG, SITE_NAME } from "@/config/site"
import { BrandLogo } from "./BrandLogo"

export type StatusAction = { label: string; icon: LucideIcon } & ({ href: string } | { onClick: () => void })

interface StatusPageProps {
  // A short code shown large, e.g. "404"
  code: string
  title: string
  message: string
  primaryAction: StatusAction
  secondaryAction?: StatusAction
}

const ACTION_BASE =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
const ACTION_STYLES = {
  primary: `${ACTION_BASE} bg-primary text-white shadow-sm hover:bg-on-primary-fixed-variant`,
  secondary: `${ACTION_BASE} border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-high`,
}

const ActionButton: React.FC<{ action: StatusAction; variant: keyof typeof ACTION_STYLES }> = ({ action, variant }) => {
  const { label, icon: Icon } = action
  const content = (
    <>
      <Icon size={16} aria-hidden="true" />
      {label}
    </>
  )
  return "href" in action ? (
    <Link href={action.href} className={ACTION_STYLES[variant]}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={ACTION_STYLES[variant]}>
      {content}
    </button>
  )
}

/**
 * A branded full-page state (not found, unexpected error): the logo, what happened, a way
 * forward, and a footer with the mark, so no framework default page ever shows.
 */
export const StatusPage: React.FC<StatusPageProps> = ({ code, title, message, primaryAction, secondaryAction }) => (
  <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 text-on-surface">
    <BrandLogo className="mb-8" priority />

    <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 text-center shadow-lg md:p-10">
      <p className="font-mono text-4xl font-extrabold tracking-wider text-primary">{code}</p>
      <div className="space-y-2">
        <h1 className="text-lg font-bold text-on-surface">{title}</h1>
        <p className="text-sm leading-relaxed text-on-surface-variant">{message}</p>
      </div>
      <div className="flex w-full flex-col gap-2 pt-1">
        <ActionButton action={primaryAction} variant="primary" />
        {secondaryAction && <ActionButton action={secondaryAction} variant="secondary" />}
      </div>
    </div>

    <footer className="mt-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-outline">
      <Image alt="" className="h-4 w-4" src={SITE_LOGO_PNG} width={16} height={16} />
      {SITE_NAME} © {new Date().getFullYear()}
    </footer>
  </main>
)
