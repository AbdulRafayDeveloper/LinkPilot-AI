"use client"

import React, { useCallback, useEffect, useState } from "react"
import { AlertTriangle, FolderKanban, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { ClientProjectDialog } from "@/components/clients/ClientProjectDialog"
import { requestApi } from "@/lib/apiClient"
import { CLIENTS_ENDPOINT, CLIENT_PROJECT_MESSAGES } from "@/constants/clients"
import type { Client } from "@/types/clientMessaging"
import type { ClientProject, ClientProjectsPage } from "@/types/clients"

const EMPTY_COUNTS = { active: 0, completed: 0 }

const StatusBadge: React.FC<{ status: ClientProject["status"] }> = ({ status }) => (
  <span
    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      status === "completed" ? "bg-success-container text-on-success-container" : "bg-primary-fixed text-on-primary-fixed-variant"
    }`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${status === "completed" ? "bg-success" : "bg-primary"}`} aria-hidden="true" />
    {status === "completed" ? "Completed" : "Active"}
  </span>
)

const savedOn = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })

interface ClientProjectsPanelProps {
  client: Client
}

/**
 * The projects being done for one client, under their details: the list with its counts, and adding,
 * editing and removing one. Mounted under the client's id, so choosing another client starts it
 * fresh rather than showing the previous client's projects while the new ones load.
 */
export const ClientProjectsPanel: React.FC<ClientProjectsPanelProps> = ({ client }) => {
  const [page, setPage] = useState<ClientProjectsPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [dialog, setDialog] = useState<{ project: ClientProject | null } | null>(null)
  const [deleting, setDeleting] = useState<ClientProject | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const endpoint = `${CLIENTS_ENDPOINT}/${client.id}/projects`

  // The state all moves in the answer's callbacks, never in the effect body, so one load can't
  // cascade renders; the retry button is what turns the spinner back on
  const load = useCallback(
    (signal: AbortSignal) => {
      requestApi<ClientProjectsPage>(endpoint, { signal })
        .then(({ data }) => {
          setPage(data)
          setError(null)
        })
        .catch((reason: unknown) => {
          if (signal.aborted) return
          setError(reason instanceof Error ? reason.message : CLIENT_PROJECT_MESSAGES.loadFailed)
        })
        .finally(() => {
          if (!signal.aborted) setIsLoading(false)
        })
    },
    [endpoint]
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load, attempt])

  const reload = () => {
    setIsLoading(true)
    setAttempt((count) => count + 1)
  }

  const saved = (project: ClientProject) => {
    const isNew = dialog?.project === null
    setDialog(null)
    setPage((current) => {
      if (!current) return current
      const projects = isNew
        ? [project, ...current.projects]
        : current.projects.map((entry) => (entry.id === project.id ? project : entry))
      return { projects, counts: countsOf(projects) }
    })
  }

  const remove = async () => {
    if (!deleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await requestApi(`${endpoint}/${deleting.id}`, { method: "DELETE" })
      setPage((current) => {
        if (!current) return current
        const projects = current.projects.filter((entry) => entry.id !== deleting.id)
        return { projects, counts: countsOf(projects) }
      })
      setDeleting(null)
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : CLIENT_PROJECT_MESSAGES.deleteFailed)
    } finally {
      setIsDeleting(false)
    }
  }

  const projects = page?.projects ?? []
  const counts = page?.counts ?? EMPTY_COUNTS

  return (
    <section aria-label="Projects" className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-5">
      {/* Full width below lg, about 290px between lg and xl, wide again from xl */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between lg:flex-col lg:items-start xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-on-surface">
            <FolderKanban size={18} className="shrink-0 text-primary" aria-hidden="true" />
            Projects
          </h3>
          <p className="mt-0.5 text-[12px] text-on-surface-variant">
            {page ? `${counts.active} active · ${counts.completed} completed` : "Loading the projects..."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ project: null })}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant px-3 py-2 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high shrink-0"
        >
          <Plus size={15} aria-hidden="true" />
          Add project
        </button>
      </div>

      <div className="mt-4 border-t border-outline-variant/70 pt-4">
        {error && !page ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle size={20} className="text-error" aria-hidden="true" />
            <p className="max-w-xs text-sm text-on-surface-variant">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-container-high"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : !page ? (
          <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-on-surface-variant">
            <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
            Loading the projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-outline-variant px-6 py-10 text-center">
            <FolderKanban size={22} className="text-primary" aria-hidden="true" />
            <p className="text-sm text-on-surface-variant">{CLIENT_PROJECT_MESSAGES.empty}</p>
          </div>
        ) : (
          <ul className={`flex flex-col gap-2 transition-opacity ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading}>
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 md:flex-row md:items-start md:justify-between md:gap-3 lg:flex-col lg:gap-2 xl:flex-row xl:items-start xl:justify-between xl:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold text-on-surface [overflow-wrap:anywhere]">{project.name}</p>
                    <StatusBadge status={project.status} />
                  </div>
                  {project.description && (
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-on-surface-variant [overflow-wrap:anywhere]">
                      {project.description}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-outline">Added {savedOn(project.createdAt)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDialog({ project })}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                  >
                    <Pencil size={13} aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null)
                      setDeleting(project)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-outline transition-colors hover:border-error/40 hover:text-error"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {dialog && (
        <ClientProjectDialog
          clientId={client.id}
          clientName={client.name}
          project={dialog.project}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}

      {deleting && (
        <Modal
          title={`Delete ${deleting.name}?`}
          description={CLIENT_PROJECT_MESSAGES.deleteExplains}
          onClose={() => setDeleting(null)}
          isCloseDisabled={isDeleting}
          size="compact"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={isDeleting}
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-container-high disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isDeleting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                Delete project
              </button>
            </div>
          }
        >
          {deleteError ? (
            <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[13px] text-error">
              {deleteError}
            </p>
          ) : (
            <p className="text-sm text-on-surface-variant">A project for {client.name}.</p>
          )}
        </Modal>
      )}
    </section>
  )
}

// The counts follow the list on screen, so adding or removing one shows at once
function countsOf(projects: ClientProject[]) {
  return {
    active: projects.filter((project) => project.status === "active").length,
    completed: projects.filter((project) => project.status === "completed").length,
  }
}
