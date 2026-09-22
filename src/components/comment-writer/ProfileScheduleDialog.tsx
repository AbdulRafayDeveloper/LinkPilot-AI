"use client"

import React, { useRef, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { ProfileScheduleFields } from "./ProfileScheduleFields"
import { inputOf, personName } from "@/lib/profilePeople"
import type { ProfileSchedule, ProfileScheduleInput } from "@/types/profileScheduler"

interface ProfileScheduleDialogProps {
  schedule: ProfileSchedule
  // Saves through the page, which checks the fields first and shows the server's own refusal as is
  onSave: (input: ProfileScheduleInput) => Promise<void>
  onClose: () => void
}

/** Edits one person, starting from what was saved. */
export const ProfileScheduleDialog: React.FC<ProfileScheduleDialogProps> = ({ schedule, onSave, onClose }) => {
  const [form, setForm] = useState<ProfileScheduleInput>(() => inputOf(schedule))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      await onSave(form)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason))
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title={`Edit ${personName(schedule)}`}
      description="Change who they are, their LinkedIn link, their type or the days you comment on their posts."
      onClose={onClose}
      isCloseDisabled={isSaving}
      initialFocusRef={urlRef}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="profile-schedule-form"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
          >
            {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            Save changes
          </button>
        </div>
      }
    >
      <form id="profile-schedule-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <ProfileScheduleFields idPrefix="edit-profile" value={form} onChange={setForm} disabled={isSaving} urlRef={urlRef} />
        {error && (
          <p role="alert" className="flex gap-2 rounded-xl bg-error-container px-3 py-2.5 text-[13px] text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
