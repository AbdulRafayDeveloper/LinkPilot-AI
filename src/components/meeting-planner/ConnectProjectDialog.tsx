"use client"

import React, { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Briefcase, Check, Loader2, Repeat, Search, Unlink } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Pagination } from "@/components/ui/Pagination"
import { ProjectStatusBadge } from "@/components/clients/ProjectStatusBadge"
import { requestApi } from "@/lib/apiClient"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { HISTORY_DEBOUNCE_MS } from "@/constants/historyFilters"
import { CLIENTS_TOOL, CLIENT_PROJECT_STATUSES } from "@/constants/clients"
import { MEETING_PROJECT_MESSAGES, MEETING_PROJECT_SEARCH_MAX_LENGTH } from "@/constants/meetingPlanner"
import type { MeetingProject, MeetingProjectPage } from "@/types/meetingPlanner"

export interface ProjectChoice {
  project: MeetingProject | null
  // A repeating meeting only: the choice goes on this meeting and every later one
  applyToSeries: boolean
}

interface ConnectProjectDialogProps {
  // The project the meeting is connected to now, shown picked
  currentId: string | null
  // Set for a meeting that repeats, which offers to put the choice on the rest of the series
  isSeries?: boolean
  // While the choice is being saved by the caller
  isSaving?: boolean
  error?: string | null
  onPick: (choice: ProjectChoice) => void
  onClose: () => void
}

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"

/**
 * Picks the client project a meeting is about: every project the account has, one page at a time,
 * searched by project or client and narrowed by client and status, all in the database
 * (`GET /api/meeting-planner/client-projects`). "No project" disconnects it. A meeting that repeats
 * also asks whether the choice goes on every later meeting of its series.
 *
 * What is on screen is keyed by the query it was read for, so a slower answer to an older search can
 * never overwrite a newer one, and "loading" is simply that the answer on screen is for another query.
 */
export const ConnectProjectDialog: React.FC<ConnectProjectDialogProps> = ({ currentId, isSeries = false, isSaving = false, error = null, onPick, onClose }) => {
  const [search, setSearch] = useState("")
  const [clientId, setClientId] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<string | null>(currentId)
  const [applyToSeries, setApplyToSeries] = useState(false)
  const [answer, setAnswer] = useState<{ key: string; data: MeetingProjectPage | null; error: string | null } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // The project picked, kept even when a filter takes it off the page, so Connect still knows its name
  const pickedProject = useRef<MeetingProject | null>(null)

  const debounced = useDebouncedValue(search, HISTORY_DEBOUNCE_MS)
  const query = new URLSearchParams({ search: debounced.trim(), client: clientId, status, page: String(page) }).toString()

  useEffect(() => {
    const controller = new AbortController()
    requestApi<MeetingProjectPage>(`/api/meeting-planner/client-projects?${query}`, { signal: controller.signal })
      .then(({ data }) => setAnswer({ key: query, data, error: null }))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setAnswer({ key: query, data: null, error: reason instanceof Error ? reason.message : MEETING_PROJECT_MESSAGES.loadFailed })
      })
    return () => controller.abort()
  }, [query])

  const isLoading = answer?.key !== query
  const data = answer?.data ?? null
  const items = data?.items ?? []
  const isFiltered = Boolean(debounced.trim() || clientId || status)
  const changed = picked !== currentId || (isSeries && applyToSeries)

  const choose = (project: MeetingProject | null) => {
    pickedProject.current = project
    setPicked(project?.id ?? null)
  }
  // A filter change starts from the first page, where the closest matches are
  const narrow = (apply: () => void) => {
    apply()
    setPage(1)
  }
  const connect = () => {
    const project = picked ? (items.find((item) => item.id === picked) ?? pickedProject.current) : null
    onPick({ project: picked ? project : null, applyToSeries: isSeries && applyToSeries })
  }

  return (
    <Modal
      title={MEETING_PROJECT_MESSAGES.pickTitle}
      description={MEETING_PROJECT_MESSAGES.pickDescription}
      onClose={onClose}
      isCloseDisabled={isSaving}
      initialFocusRef={searchRef}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] text-xs" aria-live="polite">
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={connect}
              disabled={isSaving || !changed}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              {isSaving ? "Saving..." : picked ? "Connect" : "Save"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_minmax(0,10rem)]">
          <label className="relative block">
            <span className="sr-only">{MEETING_PROJECT_MESSAGES.search}</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => narrow(() => setSearch(event.target.value))}
              maxLength={MEETING_PROJECT_SEARCH_MAX_LENGTH}
              placeholder={MEETING_PROJECT_MESSAGES.search}
              className={`${fieldClass} pl-9`}
            />
          </label>
          <label className="block">
            <span className="sr-only">Client</span>
            <select value={clientId} onChange={(event) => narrow(() => setClientId(event.target.value))} className={fieldClass}>
              <option value="">{MEETING_PROJECT_MESSAGES.allClients}</option>
              {(data?.clients ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Status</span>
            <select value={status} onChange={(event) => narrow(() => setStatus(event.target.value))} className={fieldClass}>
              <option value="">{MEETING_PROJECT_MESSAGES.allStatuses}</option>
              {CLIENT_PROJECT_STATUSES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul className="flex flex-col gap-1.5" aria-busy={isLoading}>
          <li>
            <ProjectOption isPicked={picked === null} onSelect={() => choose(null)} icon={<Unlink size={15} aria-hidden="true" />}>
              <span className="text-[13px] font-semibold text-on-surface">{MEETING_PROJECT_MESSAGES.none}</span>
              <span className="block text-[11px] text-on-surface-variant">The meeting is about no client project</span>
            </ProjectOption>
          </li>
          {items.map((project) => (
            <li key={project.id}>
              <ProjectOption isPicked={picked === project.id} onSelect={() => choose(project)} icon={<Briefcase size={15} aria-hidden="true" />}>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 break-words text-[13px] font-semibold text-on-surface">{project.name}</span>
                  <ProjectStatusBadge status={project.status} />
                </span>
                {project.clientName && <span className="block break-words text-[11px] text-on-surface-variant">{project.clientName}</span>}
              </ProjectOption>
            </li>
          ))}
        </ul>

        <div className="min-h-[20px] text-[12px] text-on-surface-variant" aria-live="polite">
          {isLoading && (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading projects...
            </span>
          )}
          {!isLoading && answer?.error && <span className="text-error">{answer.error}</span>}
          {!isLoading && data && items.length === 0 && (
            <span>
              {isFiltered ? MEETING_PROJECT_MESSAGES.empty : MEETING_PROJECT_MESSAGES.noProjects}{" "}
              {!isFiltered && (
                <Link href={CLIENTS_TOOL.href} className="font-semibold text-primary underline-offset-2 hover:underline">
                  {MEETING_PROJECT_MESSAGES.manage}
                </Link>
              )}
            </span>
          )}
          {!isLoading && data && data.total > 0 && (
            <span>
              {data.total} {data.total === 1 ? "project" : "projects"}
              {isFiltered ? " match" : ""}
            </span>
          )}
        </div>

        {data && data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} isLoading={isLoading} label="Project pages" />}

        {isSeries && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-secondary/40 bg-secondary-fixed px-3 py-2.5 text-on-secondary-fixed-variant">
            <input type="checkbox" checked={applyToSeries} onChange={(event) => setApplyToSeries(event.target.checked)} disabled={isSaving} className="peer sr-only" />
            <span
              aria-hidden="true"
              className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 ${
                applyToSeries ? "border-primary bg-primary text-white" : "border-on-secondary-fixed-variant/40 text-transparent"
              }`}
            >
              <Repeat size={11} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold">{MEETING_PROJECT_MESSAGES.applyToSeries}</span>
              <span className="block text-[11px]">{MEETING_PROJECT_MESSAGES.applyToSeriesHint}</span>
            </span>
          </label>
        )}
      </div>
    </Modal>
  )
}

const ProjectOption: React.FC<{ isPicked: boolean; onSelect: () => void; icon: React.ReactNode; children: React.ReactNode }> = ({
  isPicked,
  onSelect,
  icon,
  children,
}) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={isPicked}
    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
      isPicked ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-high"
    }`}
  >
    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isPicked ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"}`}>
      {isPicked ? <Check size={15} aria-hidden="true" /> : icon}
    </span>
    <span className="min-w-0 flex-1">{children}</span>
  </button>
)
