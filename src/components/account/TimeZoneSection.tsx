"use client"

import React, { useEffect, useState } from "react"
import { Clock3 } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import { browserTimeZone, setDisplayTimeZone } from "@/lib/timeZone"
import { updateCurrentUser } from "@/hooks/useCurrentUser"
import { ACCOUNT_ENDPOINTS, ACCOUNT_MESSAGES } from "@/constants/account"
import type { Viewer } from "@/types/auth"
import { SETTINGS_LABEL, SettingsCard, type SettingsNotice } from "./SettingsCard"
import { TimeZonePicker } from "./TimeZonePicker"

/**
 * The timezone every time in the app is shown in. It is saved the moment one is chosen, on the
 * account, so it follows the person to every browser and device; and it is put into effect in this
 * tab at once (`setDisplayTimeZone`), so every page opened from here shows times in it.
 */

// What a clock reads in a zone right now, for the line under the picker
const clockIn = (zone: string, now: Date) => now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZone: zone })
const dateIn = (zone: string, now: Date) => now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", timeZone: zone })

export const TimeZoneSection: React.FC<{ user: Viewer }> = ({ user }) => {
  const [zone, setZone] = useState<string | null>(user.timeZone)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<SettingsNotice>(null)
  const [browserZone] = useState(browserTimeZone)
  const [now, setNow] = useState(() => new Date())

  // The clock under the picker moves on with the minute
  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(tick)
  }, [])

  const choose = async (next: string | null) => {
    if (next === zone) return
    const previous = zone
    setZone(next)
    setIsSaving(true)
    setNotice(null)
    try {
      const { data } = await requestApi<{ timeZone: string | null }>(ACCOUNT_ENDPOINTS.profile, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeZone: next }),
      })
      setDisplayTimeZone(data.timeZone)
      updateCurrentUser({ timeZone: data.timeZone })
      setNotice({ tone: "saved", text: ACCOUNT_MESSAGES.timeZoneSaved })
    } catch (error: unknown) {
      setZone(previous)
      setNotice({ tone: "problem", text: error instanceof Error ? error.message : ACCOUNT_MESSAGES.timeZoneFailed })
    } finally {
      setIsSaving(false)
    }
  }

  const shown = zone ?? browserZone

  return (
    <SettingsCard title={ACCOUNT_MESSAGES.timeZoneTitle} description={ACCOUNT_MESSAGES.timeZoneHint} icon={Clock3} notice={notice} allowOverflow>
      <div className="flex max-w-xl flex-col gap-4">
        <div>
          <span className={SETTINGS_LABEL}>Your time zone</span>
          <TimeZonePicker value={zone} browserZone={browserZone} onChange={(next) => void choose(next)} disabled={isSaving} />
        </div>
        {/* What the choice means, in plain words: the time it is there now */}
        <div className="flex items-center gap-3 rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-4 py-3">
          <span className="font-code text-2xl font-bold tabular-nums text-on-surface">{clockIn(shown, now)}</span>
          <span className="min-w-0 text-[12px] leading-snug text-on-surface-variant">
            <span className="block font-semibold text-on-surface">{dateIn(shown, now)}</span>
            {ACCOUNT_MESSAGES.timeZoneNow(shown)}
          </span>
        </div>
      </div>
    </SettingsCard>
  )
}
