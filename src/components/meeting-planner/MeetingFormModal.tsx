"use client"

import React, { useRef, useState } from "react"
import { Loader2, Repeat, Save, Sparkles } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import {
  DEFAULT_RECURRENCE_PATTERN,
  MEETING_NAME_MAX_LENGTH,
  RECURRENCE_MAX_OCCURRENCES,
  MEETING_PLANNER_MESSAGES,
  PERSON_NAME_MAX_LENGTH,
  PREP_INPUT_MAX_LENGTH,
  PROFILE_LINK_MAX_LENGTH,
  RECURRENCE_PATTERNS,
  type RecurrencePatternId,
} from "@/constants/meetingPlanner"
import { findProfileLink } from "@/lib/profileLink"
import { dayLabel } from "@/lib/meetingDates"
import { datesForCount, defaultCount } from "@/lib/meetingRecurrence"
import type { MeetingPlanDetail, MeetingRecurrence } from "@/types/meetingPlanner"
import { describeSeries } from "./SeriesBadge"
import { TimeField } from "./TimeField"

export interface MeetingFormValues {
  name: string
  meetingDate: string
  meetingTime: string
  personName: string
  profileLink: string
  prepEnabled: boolean
  profileInfo: string
  conversationHistory: string
  additionalInfo: string
  /**
   * A new meeting only: whether it repeats, how, and **how many meetings** the series holds, the
   * first one included. The owner asked to say how long a weekly meeting runs for rather than take
   * a month of it, and a count says that in the words they used ("the next 6 weeks") where a last
   * day has to be worked out from a calendar.
   */
  repeat: boolean
  repeatPattern: RecurrencePatternId
  repeatCount: number
}

/** The days the series will meet on, worked out exactly as the server will. */
export const seriesDatesOf = (values: MeetingFormValues): string[] =>
  values.repeat && values.meetingDate ? datesForCount(values.meetingDate, values.repeatPattern, values.repeatCount) : []

/** What a new meeting sends about repeating: nothing for a one-off meeting. */
export const recurrenceOf = (values: MeetingFormValues): MeetingRecurrence | null =>
  values.repeat && values.meetingDate ? { pattern: values.repeatPattern, count: values.repeatCount } : null

interface MeetingFormModalProps {
  title: string
  // Offers "Repeat this meeting"; only when creating, since a saved meeting is never turned into a series
  allowRepeat?: boolean
  // The values to start from: a blank meeting on the selected day, or the one being edited
  initial: MeetingFormValues
  // Set when editing, so the form can say what preparation already exists
  existing?: MeetingPlanDetail
  isSaving: boolean
  error: string | null
  onSubmit: (values: MeetingFormValues) => void
  onClose: () => void
}

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
const labelClass = "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-outline"

export const emptyMeetingForm = (date: string, time: string): MeetingFormValues => ({
  name: "",
  meetingDate: date,
  meetingTime: time,
  personName: "",
  profileLink: "",
  prepEnabled: false,
  profileInfo: "",
  conversationHistory: "",
  additionalInfo: "",
  repeat: false,
  repeatPattern: DEFAULT_RECURRENCE_PATTERN,
  repeatCount: defaultCount(DEFAULT_RECURRENCE_PATTERN),
})

export const formValuesOf = (meeting: MeetingPlanDetail): MeetingFormValues => ({
  name: meeting.name,
  meetingDate: meeting.meetingDate,
  meetingTime: meeting.meetingTime,
  personName: meeting.personName ?? "",
  profileLink: meeting.profileLink ?? "",
  prepEnabled: meeting.prepEnabled,
  profileInfo: meeting.profileInfo ?? "",
  conversationHistory: meeting.conversationHistory ?? "",
  additionalInfo: meeting.additionalInfo ?? "",
  repeat: false,
  repeatPattern: meeting.recurrencePattern ?? DEFAULT_RECURRENCE_PATTERN,
  repeatCount: defaultCount(meeting.recurrencePattern ?? DEFAULT_RECURRENCE_PATTERN),
})

/**
 * Scheduling a meeting: a name, a day and a time are all it takes. Preparation is a checkbox,
 * and only when it is ticked does the form ask for anything about the other person.
 */
export const MeetingFormModal: React.FC<MeetingFormModalProps> = ({
  title,
  allowRepeat = false,
  initial,
  existing,
  isSaving,
  error,
  onSubmit,
  onClose,
}) => {
  const [values, setValues] = useState<MeetingFormValues>(initial)
  const nameRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof MeetingFormValues>(key: K, value: MeetingFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  /**
   * A profile is usually pasted in whole, with the person's address somewhere inside it, so the
   * link field fills itself from that paste rather than being typed a second time. It only ever
   * fills a blank field: a link already there, whether it was typed, saved earlier or found in an
   * earlier paste, is never replaced by a later one.
   */
  const setProfileInfo = (profileInfo: string) =>
    setValues((current) => {
      const found = current.profileLink.trim() ? "" : findProfileLink(profileInfo)
      return { ...current, profileInfo, ...(found ? { profileLink: found } : {}) }
    })

  const hasPrepInput = Boolean(
    values.profileInfo.trim() || values.conversationHistory.trim() || values.additionalInfo.trim()
  )
  const willRegenerate = Boolean(existing?.prep) && values.prepEnabled
  // The days the series will meet on, worked out the same way the server will
  const seriesDates = allowRepeat ? seriesDatesOf(values) : []
  const seriesTooShort = allowRepeat && values.repeat && seriesDates.length < 2
  const shortDay = (date: string) => dayLabel(date, { weekday: "short", month: "short" })
  const existingSeries = existing ? describeSeries(existing) : null

  return (
    <Modal
      title={title}
      description="A name, a day and a time are enough. Everything below the preparation checkbox is optional."
      onClose={onClose}
      isCloseDisabled={isSaving}
      initialFocusRef={nameRef}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] text-xs" aria-live="polite">
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            {!error && values.prepEnabled && !hasPrepInput && (
              <p className="text-on-surface-variant">{MEETING_PLANNER_MESSAGES.prepNeedsInput}</p>
            )}
            {!error && seriesTooShort && <p className="text-on-surface-variant">{MEETING_PLANNER_MESSAGES.recurrenceTooShort}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSubmit(values)}
              disabled={isSaving || !values.name.trim() || (values.prepEnabled && !hasPrepInput) || seriesTooShort}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              {isSaving ? "Saving..." : seriesDates.length > 1 ? `Save ${seriesDates.length} meetings` : "Save meeting"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="meeting-name" className={labelClass}>
            Meeting name
          </label>
          <input
            id="meeting-name"
            ref={nameRef}
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            maxLength={MEETING_NAME_MAX_LENGTH}
            disabled={isSaving}
            placeholder="Intro call with Fleetly"
            className={fieldClass}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="meeting-date" className={labelClass}>
              Date
            </label>
            <input
              id="meeting-date"
              type="date"
              value={values.meetingDate}
              onChange={(event) => set("meetingDate", event.target.value)}
              disabled={isSaving}
              className={fieldClass}
            />
          </div>
          <TimeField
            value={values.meetingTime}
            onChange={(time) => set("meetingTime", time)}
            disabled={isSaving}
            labelClass={labelClass}
          />
          <div className="sm:col-span-2">
            <label htmlFor="meeting-person" className={labelClass}>
              Person <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="meeting-person"
              value={values.personName}
              onChange={(event) => set("personName", event.target.value)}
              maxLength={PERSON_NAME_MAX_LENGTH}
              disabled={isSaving}
              placeholder="Omar Siddiqui"
              className={fieldClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="meeting-profile-link" className={labelClass}>
              Profile link <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="meeting-profile-link"
              type="url"
              inputMode="url"
              value={values.profileLink}
              onChange={(event) => set("profileLink", event.target.value)}
              maxLength={PROFILE_LINK_MAX_LENGTH}
              disabled={isSaving}
              placeholder="linkedin.com/in/omar-siddiqui"
              className={fieldClass}
            />
            <p className="mt-1 text-[11px] text-outline">
              Opens straight from the meeting during the call. Paste a profile below and this fills itself in.
            </p>
          </div>
        </div>

        {existingSeries && (
          <p className="flex items-start gap-2 rounded-xl border border-secondary/40 bg-secondary-fixed px-3 py-2.5 text-[12px] leading-relaxed text-on-secondary-fixed-variant">
            <Repeat size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            This meeting is part of a repeating series ({existingSeries}). Changes here apply to this meeting only.
          </p>
        )}

        {allowRepeat && (
          <div className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={values.repeat}
                onChange={(event) => set("repeat", event.target.checked)}
                disabled={isSaving}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-2 ${
                  values.repeat ? "border-primary bg-primary text-white" : "border-outline-variant text-transparent"
                }`}
              >
                <Repeat size={12} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-on-surface">Repeat this meeting</span>
                <span className="block text-[12px] leading-relaxed text-on-surface-variant">
                  Puts the same meeting on every day it repeats, for as many meetings as you choose. Each one can be
                  moved, cancelled or deleted on its own later, and the series can be extended from any one of them.
                </span>
              </span>
            </label>

            {values.repeat && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="meeting-repeat-pattern" className={labelClass}>
                    Repeats
                  </label>
                  <select
                    id="meeting-repeat-pattern"
                    value={values.repeatPattern}
                    onChange={(event) =>
                      setValues((current) => {
                        const repeatPattern = event.target.value as RecurrencePatternId
                        // A new pattern starts from its own default length, unless one was typed
                        const wasDefault = current.repeatCount === defaultCount(current.repeatPattern)
                        return {
                          ...current,
                          repeatPattern,
                          repeatCount: wasDefault ? defaultCount(repeatPattern) : current.repeatCount,
                        }
                      })
                    }
                    disabled={isSaving}
                    className={fieldClass}
                  >
                    {RECURRENCE_PATTERNS.map((pattern) => (
                      <option key={pattern.id} value={pattern.id}>
                        {pattern.label} ({pattern.description.toLowerCase()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="meeting-repeat-count" className={labelClass}>
                    How many meetings
                  </label>
                  <input
                    id="meeting-repeat-count"
                    type="number"
                    inputMode="numeric"
                    value={values.repeatCount}
                    min={2}
                    max={RECURRENCE_MAX_OCCURRENCES}
                    step={1}
                    /* An empty or half-typed box keeps the value it had, so the preview below never
                       flickers to one meeting while a two-digit number is being typed. */
                    onChange={(event) => {
                      const typed = Number(event.target.value)
                      if (Number.isFinite(typed) && typed >= 1) {
                        set("repeatCount", Math.min(Math.floor(typed), RECURRENCE_MAX_OCCURRENCES))
                      }
                    }}
                    disabled={isSaving || !values.meetingDate}
                    className={fieldClass}
                  />
                </div>
                {seriesDates.length > 0 && (
                  <p className="text-[12px] leading-relaxed text-on-surface-variant sm:col-span-2" aria-live="polite">
                    <span className="font-semibold text-on-surface">
                      {seriesDates.length} {seriesDates.length === 1 ? "meeting" : "meetings"}
                    </span>
                    : {seriesDates.length <= 6
                      ? seriesDates.map(shortDay).join(", ")
                      : `${shortDay(seriesDates[0])} to ${shortDay(seriesDates[seriesDates.length - 1])}`}
                    .{values.repeatCount > seriesDates.length &&
                      ` Only ${seriesDates.length} fit inside the year a series may run for.`}
                    {values.prepEnabled && " Preparation is written for the first one; switch it on for any other from its own page."}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3">
          <input
            type="checkbox"
            checked={values.prepEnabled}
            onChange={(event) => set("prepEnabled", event.target.checked)}
            disabled={isSaving}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-2 ${
              values.prepEnabled ? "border-primary bg-primary text-white" : "border-outline-variant text-transparent"
            }`}
          >
            <Sparkles size={13} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-on-surface">Prepare me for this meeting</span>
            <span className="block text-[12px] leading-relaxed text-on-surface-variant">
              Reads what you paste below together with your own About Me and profile, then writes a read of the person and a
              plan for the conversation. Leave it off to just put the meeting in the calendar.
            </span>
          </span>
        </label>

        {values.prepEnabled && (
          <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-[12px] leading-relaxed text-on-surface-variant">
              Fill in whatever you have. Anything you leave empty is simply not used, and nothing here is invented.
            </p>
            {(
              [
                {
                  key: "profileInfo" as const,
                  label: "Their profile",
                  hint: "Paste their LinkedIn, website or any other profile",
                  rows: 5,
                },
                {
                  key: "conversationHistory" as const,
                  label: "Your conversation so far",
                  hint: "Paste the messages between you, oldest first",
                  rows: 4,
                },
                {
                  key: "additionalInfo" as const,
                  label: "Anything else that matters",
                  hint: "Where the meeting came from, what you want out of it, anything you already know",
                  rows: 3,
                },
              ]
            ).map(({ key, label, hint, rows }) => (
              <div key={key}>
                <label htmlFor={`meeting-${key}`} className={labelClass}>
                  {label} <span className="normal-case tracking-normal">(optional)</span>
                </label>
                <textarea
                  id={`meeting-${key}`}
                  value={values[key]}
                  onChange={(event) => (key === "profileInfo" ? setProfileInfo(event.target.value) : set(key, event.target.value))}
                  maxLength={PREP_INPUT_MAX_LENGTH}
                  disabled={isSaving}
                  rows={rows}
                  placeholder={hint}
                  className={`${fieldClass} resize-y leading-relaxed`}
                />
              </div>
            ))}
            {willRegenerate && (
              <p className="text-[12px] text-on-surface-variant">
                This meeting already has preparation. Saving keeps it; use <span className="font-semibold">Prepare again</span>{" "}
                on the meeting page when you want it rewritten from these inputs.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
