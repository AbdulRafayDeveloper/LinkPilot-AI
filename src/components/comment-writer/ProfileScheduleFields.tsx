"use client"

import React from "react"
import { Link2 } from "lucide-react"
import { PROFILE_URL_MAX_LENGTH, WEEK_DAYS, WEEK_DAY_IDS, WORK_DAY_IDS, type WeekDayId } from "@/constants/profileScheduler"
import type { ProfileScheduleInput } from "@/types/profileScheduler"

export const scheduleFieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
const labelClass = "text-[13px] font-semibold text-on-surface"
const quickButton =
  "rounded-lg px-2 py-1 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"

// The days kept in week order, whatever order they were ticked in
export const inWeekOrder = (days: readonly WeekDayId[]) => WEEK_DAY_IDS.filter((day) => days.includes(day))

interface ProfileScheduleFieldsProps {
  idPrefix: string
  value: ProfileScheduleInput
  onChange: (value: ProfileScheduleInput) => void
  disabled?: boolean
  urlRef?: React.Ref<HTMLInputElement>
}

/**
 * A profile's link and its days, the same on the page's add form and in the edit dialog. The days
 * are real checkboxes in a labelled group, so a keyboard and a screen reader get them as
 * they are; Weekdays and Every day fill them in one go.
 */
export const ProfileScheduleFields: React.FC<ProfileScheduleFieldsProps> = ({ idPrefix, value, onChange, disabled, urlRef }) => {
  const setDays = (days: readonly WeekDayId[]) => onChange({ ...value, days: inWeekOrder(days) })
  const toggle = (day: WeekDayId) => setDays(value.days.includes(day) ? value.days.filter((entry) => entry !== day) : [...value.days, day])

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5" htmlFor={`${idPrefix}-url`}>
        <span className={labelClass}>LinkedIn profile link</span>
        <span className="relative">
          <Link2 size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true" />
          <input
            ref={urlRef}
            id={`${idPrefix}-url`}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={value.profileUrl}
            maxLength={PROFILE_URL_MAX_LENGTH}
            onChange={(event) => onChange({ ...value, profileUrl: event.target.value })}
            placeholder="https://www.linkedin.com/in/their-name"
            disabled={disabled}
            required
            className={`${scheduleFieldClass} h-10 pl-9`}
          />
        </span>
      </label>

      <div role="group" aria-labelledby={`${idPrefix}-days`} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span id={`${idPrefix}-days`} className={labelClass}>
            Days to comment on its posts
          </span>
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => setDays(WORK_DAY_IDS)} disabled={disabled} className={quickButton}>
              Weekdays
            </button>
            <button type="button" onClick={() => setDays(WEEK_DAY_IDS)} disabled={disabled} className={quickButton}>
              Every day
            </button>
            <button type="button" onClick={() => setDays([])} disabled={disabled || value.days.length === 0} className={quickButton}>
              Clear
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {WEEK_DAYS.map((day) => {
            const isOn = value.days.includes(day.id)
            return (
              <label
                key={day.id}
                title={day.label}
                className={`flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2 text-[13px] font-semibold transition-colors focus-within:ring-2 focus-within:ring-primary/40 ${
                  isOn ? "border-primary bg-primary text-white" : "border-outline-variant bg-white text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <input type="checkbox" checked={isOn} onChange={() => toggle(day.id)} disabled={disabled} className="sr-only" />
                <span aria-hidden="true">{day.short}</span>
                <span className="sr-only">{day.label}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
