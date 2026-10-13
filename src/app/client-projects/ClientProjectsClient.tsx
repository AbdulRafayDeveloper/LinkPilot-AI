"use client"

import React, { useEffect, useMemo, useState } from "react"
import { AlertTriangle, FolderKanban, Loader2, RefreshCw } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { FilterPanel, SearchFilter, SelectFilter } from "@/components/history/HistoryFilters"
import { ProjectsTable } from "@/components/client-projects/ProjectsTable"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { filterByWords } from "@/lib/nameSearch"
import { CLIENT_PROJECTS_ENDPOINT, PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { CLIENT_PROJECT_STATUSES } from "@/constants/clients"
import type { ClientProjectsPage } from "@/types/clientProjectTasks"

/**
 * Projects Management: every project of every client in one table, searched and filtered, with
 * **Manage** on each row, which opens that project's own page (`/client-projects/<id>`).
 *
 * The work itself lives there rather than beside this list (at the owner's request): the seven tabs,
 * the folders, the files and the voice notes need the width, and a list that also holds them is a
 * page that does two jobs badly. A project itself (its name, what the work is, whether it is still
 * running) still belongs to Clients Management; this module owns what is under it.
 */
export default function ClientProjectsClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [page, setPage] = useState<ClientProjectsPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState("")
  const [client, setClient] = useState("")
  const [status, setStatus] = useState("")

  // The projects, with every client to filter by
  useEffect(() => {
    const controller = new AbortController()
    requestApi<ClientProjectsPage>(CLIENT_PROJECTS_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        setPage(data)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [attempt])

  const projects = useMemo(() => {
    const all = page?.projects ?? []
    const narrowed = all.filter((project) => (!client || project.clientId === client) && (!status || project.status === status))
    return search.trim() ? filterByWords(narrowed, search, (project) => `${project.name} ${project.clientName} ${project.description}`) : narrowed
  }, [page, client, status, search])

  const hasFilters = Boolean(search || client || status)
  const statusOptions = CLIENT_PROJECT_STATUSES.map((entry) => ({ id: entry.id, label: entry.label }))
  const clientOptions = (page?.clients ?? []).map((entry) => ({ id: entry.id, label: entry.name }))

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:p-8">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                <FolderKanban size={24} className="shrink-0 text-primary" aria-hidden="true" />
                Projects Management
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Every client project. Open one to work on it. Projects themselves are added to a client in Clients Management.
              </p>
            </div>

            <FilterPanel
              columnsClassName="lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
              canClear={hasFilters}
              onClear={() => {
                setSearch("")
                setClient("")
                setStatus("")
              }}
              summary={page ? `${projects.length.toLocaleString()} of ${page.projects.length.toLocaleString()} projects` : "Loading your projects..."}
            >
              <SearchFilter value={search} onChange={setSearch} placeholder="Search by project, client or what the work is" />
              <SelectFilter label="Client" allLabel="All clients" value={client} options={clientOptions} onChange={setClient} />
              <SelectFilter label="Status" allLabel="Any status" value={status} options={statusOptions} onChange={setStatus} />
            </FilterPanel>

            {error && !page ? (
              <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 short:py-5 text-center">
                <AlertTriangle size={20} className="text-error" aria-hidden="true" />
                <p className="max-w-sm text-sm text-on-surface-variant">{error}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((count) => count + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : !page ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 short:py-5 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading your projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 short:py-5 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                  <FolderKanban size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm text-on-surface-variant">{hasFilters ? PROJECT_TASK_MESSAGES.noResults : PROJECT_TASK_MESSAGES.noProjects}</p>
              </div>
            ) : (
              <ProjectsTable projects={projects} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
