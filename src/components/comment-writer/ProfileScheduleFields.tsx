"use client"

import React from "react"
import { Link2 } from "lucide-react"
import {
  PERSON_FIELD_MAX_LENGTH,
  PERSON_TYPES,
  PERSON_TYPE_IDS,
  PROFILE_URL_MAX_LENGTH,
  WEEK_DAYS,
  WEEK_DAY_IDS,
  WORK_DAY_IDS,
  type PersonTypeId,
  type WeekDayId,
} from "@/constants/profileScheduler"
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

// The one-line details about the person, in the order the outreach sheet has them
const DETAILS = [
  { key: "name", label: "Name", placeholder: "Sara Khan", autoComplete: "name" },
  { key: "role", label: "Role", placeholder: "Co-founder & CEO", autoComplete: "organization-title" },
  { key: "location", label: "Location", placeholder: "US (Raleigh)", autoComplete: "off" },
  { key: "sector", label: "Sector", placeholder: "AI compliance SaaS", autoComplete: "off" },
] as const

/**
 * A person, the same on the page's add form and in the edit dialog: their LinkedIn link (optional
 * while it hasn't been found, as long as there is a name), who they are, why they are on the list
 * (any of the types) and the days their posts are looked at. Types and days are real checkboxes in
 * labelled groups, so a keyboard and a screen reader get them as they are; Weekdays and Every day
 * fill the days in one go.
 */
export const ProfileScheduleFields: React.FC<ProfileScheduleFieldsProps> = ({ idPrefix, value, onChange, disabled, urlRef }) => {
  const setDays = (days: readonly WeekDayId[]) => onChange({ ...value, days: inWeekOrder(days) })
  const toggle = (day: WeekDayId) => setDays(value.days.includes(day) ? value.days.filter((entry) => entry !== day) : [...value.days, day])
  const toggleType = (type: PersonTypeId) => {
    const types = value.types.includes(type) ? value.types.filter((entry) => entry !== type) : [...value.types, type]
    onChange({ ...value, types: PERSON_TYPE_IDS.filter((entry) => types.includes(entry)) })
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5" htmlFor={`${idPrefix}-url`}>
        <span className={labelClass}>
          LinkedIn profile link <span className="font-normal text-on-surface-variant">(can wait while you have their name)</span>
        </span>
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
            className={`${scheduleFieldClass} h-10 pl-9`}
          />
        </span>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DETAILS.map((detail) => (
          <label key={detail.key} className="flex min-w-0 flex-col gap-1.5" htmlFor={`${idPrefix}-${detail.key}`}>
            <span className={labelClass}>{detail.label}</span>
            <input
              id={`${idPrefix}-${detail.key}`}
              type="text"
              autoComplete={detail.autoComplete}
              value={value[detail.key]}
              maxLength={PERSON_FIELD_MAX_LENGTH}
              onChange={(event) => onChange({ ...value, [detail.key]: event.target.value })}
              placeholder={detail.placeholder}
              disabled={disabled}
              className={`${scheduleFieldClass} h-10`}
            />
          </label>
        ))}
      </div>

      <div role="group" aria-labelledby={`${idPrefix}-types`} className="flex flex-col gap-2">
        <span id={`${idPrefix}-types`} className={labelClass}>
          Type <span className="font-normal text-on-surface-variant">(pick every one that fits)</span>
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PERSON_TYPES.map((type) => {
            const isOn = value.types.includes(type.id)
            return (
              <label
                key={type.id}
                className={`flex min-h-10 cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 ${
                  isOn ? "border-primary bg-primary text-white" : "border-outline-variant bg-white text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <input type="checkbox" checked={isOn} onChange={() => toggleType(type.id)} disabled={disabled} className="sr-only" />
                <span className="text-[13px] font-semibold">{type.label}</span>
                <span className={`text-[11px] leading-snug ${isOn ? "text-white/85" : "text-on-surface-variant"}`}>{type.description}</span>
              </label>
            )
          })}
        </div>
      </div>

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
