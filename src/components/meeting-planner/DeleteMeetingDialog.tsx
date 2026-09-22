"use client"

import React from "react"
import { Loader2, Trash2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import type { DeleteScopeId } from "@/constants/meetingPlanner"
import type { MeetingPlan } from "@/types/meetingPlanner"
import { describeSeries } from "./SeriesBadge"

interface DeleteMeetingDialogProps {
  meeting: Pick<MeetingPlan, "name" | "seriesId" | "recurrencePattern" | "recurrenceUntil">
  // How many meetings the series still holds, when known, so the button can name the count
  seriesSize?: number
  // Which delete is running, so only that button spins
  deleting: DeleteScopeId | null
  error: string | null
  onDelete: (scope: DeleteScopeId) => void
  onClose: () => void
}

/**
 * Confirms a delete. A one-off meeting asks once, as it always has. A meeting in a repeating series
 * offers the two deletes side by side: **this meeting only**, which leaves every other day of the
 * series where it is, and **the whole series**, which takes every one of them. Both are final.
 */
export const DeleteMeetingDialog: React.FC<DeleteMeetingDialogProps> = ({ meeting, seriesSize, deleting, error, onDelete, onClose }) => {
  const series = describeSeries(meeting)
  const isBusy = deleting !== null
  const wholeSeries = seriesSize ? `Delete all ${seriesSize} meetings` : "Delete the whole series"
  const button = (scope: DeleteScopeId, label: string, primary: boolean) => (
    <button
      type="button"
      onClick={() => onDelete(scope)}
      disabled={isBusy}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
        primary ? "bg-error text-white hover:bg-error/90" : "border border-error/40 text-error hover:bg-error/5"
      }`}
    >
      {deleting === scope ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
      {deleting === scope ? "Deleting..." : label}
    </button>
  )

  return (
    <Modal
      title={series ? "Delete a repeating meeting?" : "Delete this meeting?"}
      description={
        series
          ? `"${meeting.name}" repeats: ${series}.`
          : `"${meeting.name}" and any preparation written for it will be removed for good.`
      }
      onClose={() => {
        if (!isBusy) onClose()
      }}
      isCloseDisabled={isBusy}
      size="compact"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p role="alert" className="min-h-[20px] text-xs text-error">
            {error}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="inline-flex items-center justify-center rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            >
              Cancel
            </button>
            {series ? (
              <>
                {button("one", "Delete this meeting only", false)}
                {button("series", wholeSeries, true)}
              </>
            ) : (
              button("one", "Delete meeting", true)
            )}
          </div>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-on-surface-variant">
        {series
          ? "Delete this meeting only to take this one day out and keep the rest of the series, or delete the whole series to remove every meeting in it, with any preparation written for them. This cannot be undone."
          : "This cannot be undone. The calendar entry, what you pasted and the written preparation all go."}
      </p>
    </Modal>
  )
}
