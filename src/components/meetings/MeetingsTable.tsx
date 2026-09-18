"use client"

import React from "react"
import Link from "next/link"
import { ExternalLink, Trash2, Users } from "lucide-react"
import { historyLabelClass } from "@/components/history/HistoryFilters"
import { MeetingStatusBadge } from "./MeetingStatusBadge"
import type { MeetingSummary } from "@/types/meetings"

interface MeetingsTableProps {
  meetings: MeetingSummary[]
  // The meeting whose delete is being saved, so its row says so and can't be asked twice
  deletingId: string | null
  // Which meetings are ticked for deleting several at once, and how a tick is made
  pickedIds: ReadonlySet<string>
  onPick: (id: string, isRange: boolean) => void
  onDelete: (meeting: MeetingSummary) => void
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
const onDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
const atTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

const actionButton =
  "inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

/** What a meeting was about, or why there is nothing to say about it yet. */
const Purpose: React.FC<{ meeting: MeetingSummary; lines: string }> = ({ meeting, lines }) =>
  meeting.purpose ? (
    <p className={`${lines} text-[12px] leading-relaxed text-on-surface-variant`}>{meeting.purpose}</p>
  ) : meeting.status === "failed" ? (
    <p className="text-[12px] text-error">The analysis stopped. Open it to run it again.</p>
  ) : meeting.status === "completed" || meeting.status === "stale" ? (
    // Read, but the analysis put no purpose on it: saying "not analyzed yet" here would be untrue
    <p className="text-[12px] text-outline">No summary line. Open it to read the analysis.</p>
  ) : (
    <p className="text-[12px] text-outline">Not analyzed yet.</p>
  )

/** How big the meeting is: the transcript it holds, and the people the analysis found in it. */
const Size: React.FC<{ meeting: MeetingSummary }> = ({ meeting }) => (
  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-on-surface-variant">
    <span className="whitespace-nowrap">{meeting.transcriptChars.toLocaleString()} characters</span>
    {meeting.participantCount !== null && (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-outline">
        <Users size={12} aria-hidden="true" />
        {meeting.participantCount}
      </span>
    )}
  </span>
)

const Actions: React.FC<{ meeting: MeetingSummary; deletingId: string | null; onDelete: (meeting: MeetingSummary) => void; layout: "grid" | "row" }> = ({
  meeting,
  deletingId,
  onDelete,
  layout,
}) => (
  <div className={layout === "grid" ? "grid grid-cols-1 gap-0.5 2xl:grid-cols-2" : "flex flex-wrap items-center gap-0.5"}>
    <Link href={`/meetings/${meeting.id}`} className={`${actionButton} text-on-surface-variant hover:bg-surface-container-high hover:text-primary`}>
      <ExternalLink size={13} aria-hidden="true" />
      Open
    </Link>
    <button
      type="button"
      onClick={() => onDelete(meeting)}
      disabled={deletingId === meeting.id}
      aria-label={`Delete the meeting: ${meeting.title}`}
      className={`${actionButton} text-on-surface-variant hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <Trash2 size={13} aria-hidden="true" />
      {deletingId === meeting.id ? "Deleting..." : "Delete"}
    </button>
  </div>
)

/**
 * The meetings, newest first: what each one was about, where its analysis has got to, how big it is
 * and when it was saved, with Open and Delete on every row.
 *
 * A table from `xl`, where its 880px fits the room a page has, and the same meetings as cards below
 * that, one to a row on a phone and two on a tablet. The title is the link either way, so opening a
 * meeting is one click wherever it is read (see the Responsive layout rules in CLAUDE.md).
 */
export const MeetingsTable: React.FC<MeetingsTableProps> = ({ meetings, deletingId, pickedIds, onPick, onDelete }) => (
  <>
    <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-white shadow-sm xl:block">
      <table className="w-full min-w-[880px] border-collapse text-left [overflow-wrap:anywhere]">
        <caption className="sr-only">Every meeting saved, newest first</caption>
        <thead className="bg-surface-container-lowest">
          <tr className="border-b border-outline-variant">
            <th scope="col" className="w-[36px] px-2 py-2.5">
              <span className="sr-only">Picked</span>
            </th>
            {["Meeting", "Status", "Transcript", "Saved", "Actions"].map((heading) => (
              <th key={heading} scope="col" className={`px-3 py-2.5 ${historyLabelClass}`}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {meetings.map((meeting) => (
            <tr key={meeting.id} className="border-b border-outline-variant/60 align-top transition-colors last:border-0 hover:bg-surface-container-lowest">
              <td className="w-[36px] px-2 py-3">
                {/* The box stays small; what can be clicked is 24px, the smallest target worth offering */}
                <label className="-m-1 flex h-6 w-6 cursor-pointer items-center justify-center p-1">
                  <input
                    type="checkbox"
                    checked={pickedIds.has(meeting.id)}
                    onChange={(event) => onPick(meeting.id, (event.nativeEvent as MouseEvent).shiftKey)}
                    aria-label={`Pick ${meeting.title}`}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
              </td>
              <td className="min-w-[260px] px-3 py-2.5">
                <Link
                  href={`/meetings/${meeting.id}`}
                  className="inline-flex min-h-6 items-center text-[13px] font-bold text-on-surface transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {meeting.title}
                </Link>
                <Purpose meeting={meeting} lines="mt-1 line-clamp-2" />
              </td>
              <td className="w-[150px] px-3 py-2.5">
                <MeetingStatusBadge status={meeting.status} progress={meeting.progress} />
              </td>
              <td className="w-[160px] px-3 py-2.5">
                <Size meeting={meeting} />
              </td>
              <td className="w-[110px] px-3 py-2.5 text-[12px] text-on-surface-variant 2xl:w-auto 2xl:whitespace-nowrap">
                {onDay(meeting.createdAt)}
                <span className="block text-outline 2xl:inline 2xl:before:content-[',_']">{atTime(meeting.createdAt)}</span>
              </td>
              <td className="w-[120px] px-3 py-2 2xl:w-[170px]">
                <Actions meeting={meeting} deletingId={deletingId} onDelete={onDelete} layout="grid" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Cards on a phone, two to a row on a tablet or a narrow laptop */}
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
      {meetings.map((meeting) => (
        <li key={meeting.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
          <label className="-m-1 flex h-6 w-6 cursor-pointer items-center justify-center self-start p-1">
            <input
              type="checkbox"
              checked={pickedIds.has(meeting.id)}
              onChange={(event) => onPick(meeting.id, (event.nativeEvent as MouseEvent).shiftKey)}
              aria-label={`Pick ${meeting.title}`}
              className="h-4 w-4 accent-primary"
            />
          </label>
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/meetings/${meeting.id}`}
              className="flex min-h-6 min-w-0 items-center break-words text-sm font-bold text-on-surface transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {meeting.title}
            </Link>
            <MeetingStatusBadge status={meeting.status} progress={meeting.progress} />
          </div>
          <Purpose meeting={meeting} lines="line-clamp-3" />
          <div className="flex flex-col gap-1 border-t border-outline-variant/70 pt-2">
            <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-outline">
              {when(meeting.createdAt)}
              <Size meeting={meeting} />
            </span>
            {/* Pulled left only, so a long action never hangs over the right edge of the card */}
            <div className="-ml-2">
              <Actions meeting={meeting} deletingId={deletingId} onDelete={onDelete} layout="row" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  </>
)
