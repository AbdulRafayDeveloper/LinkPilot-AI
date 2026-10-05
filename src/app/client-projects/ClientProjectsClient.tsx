"use client"

import React, { useEffect, useMemo, useState } from "react"
import { AlertTriangle, FolderKanban, Loader2, RefreshCw } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { FilterPanel, SearchFilter, SelectFilter } from "@/components/history/HistoryFilters"
import { ProjectTasks, deleteItemTitle } from "@/components/client-projects/ProjectTasks"
import { ProjectTabs } from "@/components/client-projects/ProjectTabs"
import { countsOf } from "@/lib/projectItems"
import { TaskComposer } from "@/components/client-projects/TaskComposer"
import { ProjectLinkPanel } from "@/components/client-projects/ProjectLinkPanel"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { filterByWords } from "@/lib/nameSearch"
import { CLIENT_PROJECTS_ENDPOINT, DEFAULT_PROJECT_ITEM_KIND, PROJECT_TASK_MESSAGES, type ProjectItemKind } from "@/constants/clientProjectTasks"
import { CLIENT_PROJECT_STATUSES } from "@/constants/clients"
import type { ClientProjectsPage, ProjectTask, ProjectTaskInput, ProjectWithTasks } from "@/types/clientProjectTasks"

/**
 * Client Projects: every project of every client in one list, and the tasks under the one chosen.
 *
 * A project itself (its name, what the work is, whether it is running) still belongs to Clients
 * Management; this page reads them and owns what is under them: the changes, the ideas and the
 * discussion, with their images and voice notes, and the link the project is shared by.
 *
 * The three tabs are the same strip the shared link shows, and the client writes through that link
 * on the same items, so an item they add appears here tagged as theirs.
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
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<{ projectId: string; attempt: number; tasks: ProjectTask[] } | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Which tab is open. It stays as the user left it while they move between projects
  const [tab, setTab] = useState<ProjectItemKind>(DEFAULT_PROJECT_ITEM_KIND)
  const [editing, setEditing] = useState<ProjectTask | null>(null)
  const [deleting, setDeleting] = useState<ProjectTask | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  // The one being worked on: whoever was chosen, else the first the filters leave
  const chosen = projects.find((project) => project.id === chosenId) ?? projects[0] ?? null

  /**
   * The tasks on screen, which are only ever the chosen project's: they are kept with the id they
   * were read for, so switching project shows "loading" rather than the last project's tasks, and
   * an answer that arrives after the project changed is ignored instead of landing on the wrong one.
   */
  const tasks = loaded && chosen && loaded.projectId === chosen.id && loaded.attempt === attempt ? loaded.tasks : null

  const chosenId_ = chosen?.id ?? null
  useEffect(() => {
    if (!chosenId_) return
    const controller = new AbortController()
    requestApi<{ project: ProjectWithTasks; tasks: ProjectTask[] }>(`${CLIENT_PROJECTS_ENDPOINT}/${chosenId_}`, { signal: controller.signal })
      .then(({ data }) => {
        setLoaded({ projectId: chosenId_, attempt, tasks: data.tasks })
        setTaskError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setTaskError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [chosenId_, attempt])

  /** Changes the tasks on screen, for the project they were read for and no other. */
  const setTasks = (change: (current: ProjectTask[]) => ProjectTask[]) =>
    setLoaded((current) => (current && current.projectId === chosenId_ ? { ...current, tasks: change(current.tasks) } : current))

  /** Keeps a project's task counts in step without reading the whole list again. */
  const countTasks = (projectId: string, change: (project: ProjectWithTasks) => ProjectWithTasks) =>
    setPage((current) => (current ? { ...current, projects: current.projects.map((project) => (project.id === projectId ? change(project) : project)) } : current))

  const addTask = async (input: ProjectTaskInput) => {
    if (!chosen) return
    const { data } = await requestApi<ProjectTask>(
      `${CLIENT_PROJECTS_ENDPOINT}/${chosen.id}/tasks`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
      // It creates a record and may carry images and a voice note, so a retry must not add it twice
      { idempotent: true }
    )
    setTasks((current) => [...current, data])
    countTasks(chosen.id, (project) => ({ ...project, taskCount: project.taskCount + 1 }))
  }

  const saveTask = async (task: ProjectTask, input: Partial<ProjectTaskInput>) => {
    if (!chosen) return
    const { data } = await requestApi<ProjectTask>(`${CLIENT_PROJECTS_ENDPOINT}/${chosen.id}/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    setTasks((current) => current.map((row) => (row.id === task.id ? data : row)))
    return data
  }

  /** Ticking a task off: the box moves at once and goes back if the write fails. */
  const tick = async (task: ProjectTask, done: boolean) => {
    if (!chosen) return
    const status = done ? "done" : "open"
    setBusyId(task.id)
    setTasks((current) => current.map((row) => (row.id === task.id ? { ...row, status } : row)))
    countTasks(chosen.id, (project) => ({ ...project, doneCount: Math.max(0, project.doneCount + (done ? 1 : -1)) }))
    try {
      await saveTask(task, { status })
      setTaskError(null)
    } catch (reason: unknown) {
      setTasks((current) => current.map((row) => (row.id === task.id ? { ...row, status: task.status } : row)))
      countTasks(chosen.id, (project) => ({ ...project, doneCount: Math.max(0, project.doneCount + (done ? -1 : 1)) }))
      setTaskError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.saveFailed)
    } finally {
      setBusyId(null)
    }
  }

  const removeTask = async () => {
    if (!deleting || !chosen) return
    setIsDeleting(true)
    try {
      await requestApi(`${CLIENT_PROJECTS_ENDPOINT}/${chosen.id}/tasks/${deleting.id}`, { method: "DELETE" })
      setTasks((current) => current.filter((row) => row.id !== deleting.id))
      countTasks(chosen.id, (project) => ({
        ...project,
        taskCount: Math.max(0, project.taskCount - 1),
        doneCount: Math.max(0, project.doneCount - (deleting.status === "done" ? 1 : 0)),
      }))
      setDeleting(null)
      setTaskError(null)
    } catch (reason: unknown) {
      setTaskError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.deleteFailed)
      setDeleting(null)
    } finally {
      setIsDeleting(false)
    }
  }

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
                Client Projects
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Every client project with the work under it. Projects themselves are added to a client in Clients Management.
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
              <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
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
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading your projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                  <FolderKanban size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm text-on-surface-variant">{hasFilters ? PROJECT_TASK_MESSAGES.noResults : PROJECT_TASK_MESSAGES.noProjects}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                {/* The projects, with the one being worked on picked out */}
                <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-2xl border border-outline-variant bg-white p-2 xl:max-h-[calc(100vh-280px)]">
                  {projects.map((project) => {
                    const isChosen = chosen?.id === project.id
                    return (
                      <li key={project.id}>
                        <button
                          type="button"
                          onClick={() => setChosenId(project.id)}
                          aria-current={isChosen ? "true" : undefined}
                          className={`flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors ${
                            isChosen ? "border-primary bg-primary-fixed/40" : "border-transparent hover:bg-surface-container-lowest"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-[13px] font-semibold text-on-surface">{project.name}</span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                project.status === "completed" ? "bg-success-container text-on-success-container" : "bg-secondary-fixed text-on-secondary-fixed-variant"
                              }`}
                            >
                              {project.status === "completed" ? "Completed" : "Active"}
                            </span>
                          </span>
                          <span className="truncate text-[12px] text-on-surface-variant">{project.clientName}</span>
                          <span className="text-[11px] text-outline">
                            {project.taskCount === 0 ? "No tasks yet" : `${project.doneCount} of ${project.taskCount} done`}
                            {project.publicToken ? " · shared" : ""}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                {chosen && (
                  <section aria-label={`What is on ${chosen.name}`} className="flex min-w-0 flex-col gap-3">
                    <div className="rounded-2xl border border-outline-variant bg-white p-4">
                      <h2 className="break-words text-lg font-bold text-on-surface">{chosen.name}</h2>
                      <p className="mt-0.5 text-[13px] text-on-surface-variant">For {chosen.clientName}</p>
                      {chosen.description && <p className="mt-2 whitespace-pre-wrap break-words text-[13px] text-on-surface-variant">{chosen.description}</p>}
                    </div>

                    <ProjectLinkPanel
                      projectId={chosen.id}
                      token={chosen.publicToken}
                      onChanged={(token) => countTasks(chosen.id, (project) => ({ ...project, publicToken: token }))}
                    />

                    <ProjectTabs chosen={tab} onChoose={setTab} counts={tasks ? countsOf(tasks) : chosen.counts} />

                    <div id={`project-panel-${tab}`} role="tabpanel" aria-labelledby={`project-tab-${tab}`} className="flex min-w-0 flex-col gap-3">
                      <TaskComposer task={null} kind={tab} onSave={addTask} fileEndpoint={`${CLIENT_PROJECTS_ENDPOINT}/${chosen.id}/files`} />

                      {taskError && (
                        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                          {taskError}
                        </p>
                      )}

                      {tasks === null ? (
                        <p role="status" className="flex items-center gap-2 py-6 text-[13px] text-on-surface-variant">
                          <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />
                          Loading what is on this project...
                        </p>
                      ) : (
                        <ProjectTasks
                          tasks={tasks.filter((task) => task.kind === tab)}
                          kind={tab}
                          busyId={busyId}
                          onTick={tick}
                          onEdit={setEditing}
                          onDelete={setDeleting}
                          clientTag={PROJECT_TASK_MESSAGES.fromClient}
                        />
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {editing && (
        <Modal title="Edit" onClose={() => setEditing(null)} size="large">
          <TaskComposer
            task={editing}
            kind={editing.kind}
            fileEndpoint={`${CLIENT_PROJECTS_ENDPOINT}/${editing.projectId}/files`}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              await saveTask(editing, input)
              setEditing(null)
            }}
          />
        </Modal>
      )}

      {deleting && (
        <Modal
          title={deleteItemTitle(deleting.kind)}
          description={deleting.content}
          onClose={() => setDeleting(null)}
          isCloseDisabled={isDeleting}
          size="compact"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={isDeleting}
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-high"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={removeTask}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isDeleting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                Delete
              </button>
            </div>
          }
        >
          <p className="text-sm text-on-surface-variant">{PROJECT_TASK_MESSAGES.deleteExplains}</p>
        </Modal>
      )}
    </div>
  )
}
