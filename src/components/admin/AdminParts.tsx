"use client"

import React from "react"
import { Bot, HelpCircle, Monitor, Smartphone, Tablet, type LucideIcon } from "lucide-react"
import { loginEventLabel, type LoginEventType } from "@/constants/admin"
import { deviceLabel } from "@/lib/userAgent"
import type { DeviceSummary } from "@/types/admin"

/** The small pieces both admin pages share: the summary cards, the device line and the event badge. */

export const StatCard: React.FC<{ icon: LucideIcon; label: string; value: number | null; hint?: string; tone?: "primary" | "success" | "error" }> = ({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
}) => {
  const tile = { primary: "bg-primary-fixed text-on-primary-fixed-variant", success: "bg-success-container text-on-success-container", error: "bg-error-container text-error" }[tone]
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tile}`}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-on-surface-variant">{label}</p>
        <p className="text-2xl font-bold leading-tight text-on-surface">{value === null ? "…" : value.toLocaleString()}</p>
        {hint && <p className="truncate text-[11px] text-outline">{hint}</p>}
      </div>
    </div>
  )
}

const DEVICE_ICONS: Record<string, LucideIcon> = { Desktop: Monitor, Mobile: Smartphone, Tablet, Automated: Bot }

export const DeviceLine: React.FC<{ device: DeviceSummary | null }> = ({ device }) => {
  if (!device) return <span className="text-[12px] text-outline">No sign-in yet</span>
  const Icon = DEVICE_ICONS[device.device] ?? HelpCircle
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] text-on-surface">
      <Icon size={14} className="shrink-0 text-outline" aria-label={device.device} />
      <span className="truncate">{deviceLabel(device)}</span>
    </span>
  )
}

const EVENT_STYLE: Record<LoginEventType, string> = {
  "sign-in": "bg-success-container text-on-success-container",
  "sign-up": "bg-primary-fixed text-on-primary-fixed-variant",
  "sign-out": "bg-surface-container-high text-on-surface-variant",
  failed: "bg-secondary-fixed text-on-surface",
  locked: "bg-error-container text-error",
  "account-deleted": "bg-error text-white",
}

export const EventBadge: React.FC<{ event: LoginEventType }> = ({ event }) => (
  <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${EVENT_STYLE[event]}`}>{loginEventLabel(event)}</span>
)

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })

/** "3 minutes ago", "2 days ago": how long since something happened, for the activity columns. */
export function timeAgo(iso: string | null): string {
  if (!iso) return "Never"
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  const steps: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
  ]
  let value = seconds
  for (const [size, unit] of steps) {
    if (value < size) return `${value} ${unit}${value === 1 ? "" : "s"} ago`
    value = Math.floor(value / size)
  }
  return `${value} year${value === 1 ? "" : "s"} ago`
}
