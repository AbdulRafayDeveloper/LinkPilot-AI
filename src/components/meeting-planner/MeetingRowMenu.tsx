"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { ArrowUpRight, Briefcase, Check, Clock, Copy, FileText, NotebookPen, Pencil, Trash2, Video } from "lucide-react"
import { ActionMenu, type ActionMenuGroup } from "@/components/ui/ActionMenu"
import { useQuickRecord } from "@/components/meetings/QuickRecordButton"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { MEETING_PLAN_LINK_MESSAGES } from "@/constants/meetings"
import { MEETING_PROJECT_MESSAGES } from "@/constants/meetingPlanner"
import type { MeetingPlan } from "@/types/meetingPlanner"

interface MeetingRowMenuProps {
  meeting: MeetingPlan
  // Its status is being saved: what would change it again waits
  isSaving: boolean
  onNotes: (meeting: MeetingPlan) => void
  onEditDetails: (meeting: MeetingPlan) => void
  onLinked: (meeting: MeetingPlan) => void
  // Connecting it to a client project, or changing or removing the one it has
  onProject?: (meeting: MeetingPlan) => void
  // The day panel's own: the day or time, and deleting it (or its whole series). Today's list has neither
  onMove?: (meeting: MeetingPlan) => void
  onDelete?: (meeting: MeetingPlan) => void
}

/**
 * Everything a meeting row can do, behind one three-dot button, as a daily task's row has it, at the
 * owner's request: up to seven bare icons sat on every row (copy link, record, recordings, notes,
 * edit, the day or time, delete) and could not be told apart. Each is now a line of the menu with its
 * word beside its icon, and **does exactly what its icon did**. A line that has nothing to act on is
 * left out (no attend link, nothing recorded yet), so the menu only ever offers what can be done.
 *
 * What stays on the row is what is read at a glance or wanted in one click at the hour: the time, the
 * tags, the status chip and Join.
 */
export const MeetingRowMenu: React.FC<MeetingRowMenuProps> = ({ meeting, isSaving, onNotes, onEditDetails, onLinked, onProject, onMove, onDelete }) => {
  const router = useRouter()
  const { copied, copy } = useCopyToClipboard()
  const record = useQuickRecord({ id: meeting.id, name: meeting.name })
  const linked = meeting.linkedCount ?? 0
  const savingHint = isSaving ? "Wait for the status to finish saving" : undefined

  const groups: ActionMenuGroup[] = [
    {
      id: "meeting",
      items: [
        { id: "open", label: "Open meeting", icon: <ArrowUpRight size={14} />, onSelect: () => router.push(`/meeting-planner/${meeting.id}`), hint: "Its preparation, notes and chat" },
        {
          id: "notes",
          label: meeting.hasNotes ? "Read notes" : "Write notes",
          icon: <NotebookPen size={14} />,
          onSelect: () => onNotes(meeting),
          hint: meeting.hasNotes ? "Notes on this meeting" : "Write notes for this meeting",
        },
        ...(linked > 0
          ? [{ id: "linked", label: `Recordings and notes (${linked})`, icon: <FileText size={14} />, onSelect: () => onLinked(meeting), hint: MEETING_PLAN_LINK_MESSAGES.notesOn(linked) }]
          : []),
      ],
    },
    {
      id: "change",
      items: [
        { id: "edit", label: "Edit meeting", icon: <Pencil size={14} />, onSelect: () => onEditDetails(meeting), disabled: isSaving, hint: savingHint ?? "Its name, the person and the attend link" },
        ...(onMove
          ? [
              {
                id: "move",
                label: "Change day or time",
                icon: <Clock size={14} />,
                onSelect: () => onMove(meeting),
                disabled: isSaving,
                hint: savingHint ?? (meeting.seriesId ? "This meeting, or this and every later one" : undefined),
              },
            ]
          : []),
        ...(onProject
          ? [
              {
                id: "project",
                label: meeting.project ? MEETING_PROJECT_MESSAGES.change : MEETING_PROJECT_MESSAGES.connect,
                icon: <Briefcase size={14} />,
                onSelect: () => onProject(meeting),
                disabled: isSaving,
                hint: savingHint ?? (meeting.project ? `Now: ${meeting.project.name}` : "The client project this meeting is about"),
              },
            ]
          : []),
      ],
    },
    {
      id: "call",
      items: [
        ...(meeting.joinUrl
          ? [{ id: "copy", label: copied ? "Link copied" : "Copy attend link", icon: copied ? <Check size={14} /> : <Copy size={14} />, onSelect: () => void copy(meeting.joinUrl ?? "") }]
          : []),
        // Started from this click, as the icon was, because only a click lets the browser open its screen picker
        { id: "record", label: record.isBusy ? "Go to the recording" : "Record this meeting", icon: <Video size={14} />, onSelect: record.start, hint: record.hint },
      ],
    },
    ...(onDelete
      ? [
          {
            id: "delete",
            items: [
              {
                id: "delete",
                label: meeting.seriesId ? "Delete meeting or series" : "Delete meeting",
                icon: <Trash2 size={14} />,
                onSelect: () => onDelete(meeting),
                disabled: isSaving,
                hint: savingHint,
                tone: "danger" as const,
              },
            ],
          },
        ]
      : []),
  ]

  return <ActionMenu label={meeting.name} groups={groups} className="!mt-0" />
}
