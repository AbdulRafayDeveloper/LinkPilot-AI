"use client"

import React, { useState } from "react"
import { CheckCircle2, Monitor, Moon, SunMedium, SunMoon, type LucideIcon } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import { applyColorScheme } from "@/lib/colorScheme"
import { updateCurrentUser } from "@/hooks/useCurrentUser"
import { ACCOUNT_ENDPOINTS } from "@/constants/account"
import { COLOR_SCHEME_MESSAGES, COLOR_SCHEMES, type ColorScheme } from "@/constants/colorScheme"
import type { Viewer } from "@/types/auth"
import { SettingsCard, type SettingsNotice } from "./SettingsCard"

const ICONS: Record<ColorScheme, LucideIcon> = { system: Monitor, light: SunMedium, dark: Moon }

/**
 * System, Light or Dark. The page changes the moment one is chosen, and the choice is saved on the
 * account so it follows the person to every browser and device; if the save fails the page goes back
 * to what it was and says so, rather than showing a scheme that will not be there next time.
 */
export const ColorSchemeSection: React.FC<{ user: Viewer }> = ({ user }) => {
  const [scheme, setScheme] = useState<ColorScheme>(user.colorScheme)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<SettingsNotice>(null)

  const choose = async (next: ColorScheme) => {
    if (next === scheme) return
    const previous = scheme
    setScheme(next)
    applyColorScheme(next)
    setIsSaving(true)
    setNotice(null)
    try {
      const { data } = await requestApi<{ colorScheme: ColorScheme }>(ACCOUNT_ENDPOINTS.profile, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorScheme: next }),
      })
      updateCurrentUser({ colorScheme: data.colorScheme })
      setNotice({ tone: "saved", text: COLOR_SCHEME_MESSAGES.saved })
    } catch (error: unknown) {
      setScheme(previous)
      applyColorScheme(previous)
      setNotice({ tone: "problem", text: error instanceof Error ? error.message : COLOR_SCHEME_MESSAGES.failed })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SettingsCard title={COLOR_SCHEME_MESSAGES.title} description={COLOR_SCHEME_MESSAGES.hint} icon={SunMoon} notice={notice}>
      <fieldset disabled={isSaving} className="min-w-0">
        <legend className="sr-only">{COLOR_SCHEME_MESSAGES.legend}</legend>
        {/* As many across as the card has room for: three where it is wide, one under another where not */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-2">
          {COLOR_SCHEMES.map((option) => {
            const Icon = ICONS[option.id]
            const isChosen = option.id === scheme
            return (
              <label
                key={option.id}
                className={`relative flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors focus-within:ring-2 focus-within:ring-primary/40 ${
                  isChosen
                    ? "border-primary bg-primary-fixed/50 text-on-surface"
                    : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low"
                }`}
              >
                <input
                  type="radio"
                  name="color-scheme"
                  value={option.id}
                  checked={isChosen}
                  onChange={() => void choose(option.id)}
                  className="sr-only"
                />
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isChosen ? "bg-primary text-white" : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">{option.label}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-on-surface-variant">{option.description}</span>
                </span>
                {isChosen && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />}
              </label>
            )
          })}
        </div>
      </fieldset>
    </SettingsCard>
  )
}
