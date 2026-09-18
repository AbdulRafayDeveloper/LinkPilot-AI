"use client"

import React, { useRef, useState } from "react"
import { Loader2, Save, Sparkles } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import {
  MEETING_NAME_MAX_LENGTH,
  MEETING_PLANNER_MESSAGES,
  PERSON_NAME_MAX_LENGTH,
  PREP_INPUT_MAX_LENGTH,
  PROFILE_LINK_MAX_LENGTH,
} from "@/constants/meetingPlanner"
import { findProfileLink } from "@/lib/profileLink"
import type { MeetingPlanDetail } from "@/types/meetingPlanner"
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
}

interface MeetingFormModalProps {
  title: string
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
})

/**
 * Scheduling a meeting: a name, a day and a time are all it takes. Preparation is a checkbox,
 * and only when it is ticked does the form ask for anything about the other person.
 */
export const MeetingFormModal: React.FC<MeetingFormModalProps> = ({
  title,
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
              disabled={isSaving || !values.name.trim() || (values.prepEnabled && !hasPrepInput)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              {isSaving ? "Saving..." : "Save meeting"}
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
