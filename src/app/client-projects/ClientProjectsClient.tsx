"use client"

import React, { useEffect, useMemo, useState } from "react"
import { AlertTriangle, FilePlus2, FolderKanban, Loader2, RefreshCw } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { FilterPanel, SearchFilter, SelectFilter } from "@/components/history/HistoryFilters"
import { ProjectTasks, deleteItemTitle } from "@/components/client-projects/ProjectTasks"
import { ProjectTabs } from "@/components/client-projects/ProjectTabs"
import { countsOf, totalItems, workItems } from "@/lib/projectItems"
import { TaskComposer } from "@/components/client-projects/TaskComposer"
import { ProjectLinkPanel } from "@/components/client-projects/ProjectLinkPanel"
import { ProjectFolderTree, folderBranch, folderPath } from "@/components/client-projects/ProjectFolderTree"
import { FolderNameDialog, MoveToFolderDialog, WriteDocumentDialog } from "@/components/client-projects/ProjectFolderDialogs"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { filterByWords } from "@/lib/nameSearch"
import {
  CLIENT_PROJECTS_ENDPOINT,
  DEFAULT_PROJECT_ITEM_KIND,
  PROJECT_FOLDER_MESSAGES,
  PROJECT_TASK_MESSAGES,
  hasFolders,
  type ProjectItemKind,
} from "@/constants/clientProjectTasks"
import { CLIENT_PROJECT_STATUSES } from "@/constants/clients"
import type { ClientProjectsPage, ProjectFolder, ProjectTask, ProjectTaskInput, ProjectWithTasks } from "@/types/clientProjectTasks"

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
  /**
   * The folders of the project on screen, and which one is open. The Documents and Links tabs are
   * filed in folders (`hasFolders`); every other tab is a flat list, so neither the tree nor the
   * folder search is drawn on it.
   */
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [folderId, setFolderId] = useState<string | null>(null)
  const [folderSearch, setFolderSearch] = useState("")
  const [folderBusyId, setFolderBusyId] = useState<string | null>(null)
  const [folderError, setFolderError] = useState<string | null>(null)
  const [isFolderSaving, setIsFolderSaving] = useState(false)
  // Which folder dialog is open: naming one, moving something, or writing a document
  const [naming, setNaming] = useState<{ renaming: ProjectFolder | null; parentId: string | null } | null>(null)
  const [movingTask, setMovingTask] = useState<ProjectTask | null>(null)
  const [movingFolder, setMovingFolder] = useState<ProjectFolder | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<ProjectFolder | null>(null)
  const [isWriting, setIsWriting] = useState(false)
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
    requestApi<{ project: ProjectWithTasks; tasks: ProjectTask[]; folders?: ProjectFolder[] }>(`${CLIENT_PROJECTS_ENDPOINT}/${chosenId_}`, {
      signal: controller.signal,
    })
      .then(({ data }) => {
        setLoaded({ projectId: chosenId_, attempt, tasks: data.tasks })
        setFolders(data.folders ?? [])
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

  /**
   * One item added, removed or ticked, counted on its own tab as well as on the project. The row in
   * the list reads its tabs, so a credential or a backup must not land in the "done" of the work.
   */
  const bump = (projectId: string, kind: ProjectItemKind, total: number, done: number) =>
    countTasks(projectId, (project) => ({
      ...project,
      taskCount: Math.max(0, project.taskCount + total),
      doneCount: Math.max(0, project.doneCount + done),
      counts: {
        ...project.counts,
        [kind]: {
          total: Math.max(0, project.counts[kind].total + total),
          done: Math.max(0, project.counts[kind].done + done),
        },
      },
    }))

  const addTask = async (input: ProjectTaskInput) => {
    if (!chosen) return
    // It goes in the folder being looked at, which is where the user expects to find it
    const body = hasFolders(input.kind ?? tab) ? { ...input, folderId } : input
    const { data } = await requestApi<ProjectTask>(
      `${CLIENT_PROJECTS_ENDPOINT}/${chosen.id}/tasks`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      // It creates a record and may carry images and a voice note, so a retry must not add it twice
      { idempotent: true }
    )
    setTasks((current) => [...current, data])
    bump(chosen.id, data.kind, 1, 0)
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
    bump(chosen.id, task.kind, 0, done ? 1 : -1)
    try {
      await saveTask(task, { status })
      setTaskError(null)
    } catch (reason: unknown) {
      setTasks((current) => current.map((row) => (row.id === task.id ? { ...row, status: task.status } : row)))
      bump(chosen.id, task.kind, 0, done ? -1 : 1)
      setTaskError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.saveFailed)
    } finally {
      setBusyId(null)
    }
  }

  /** Every folder call answers with the folder, so the tree follows without reading it again. */
  const reloadFolders = async (projectId: string) => {
    const { data } = await requestApi<{ folders: ProjectFolder[] }>(`${CLIENT_PROJECTS_ENDPOINT}/${projectId}/folders`)
    setFolders(data.folders)
  }

  const makeFolder = async (name: string) => {
    if (!chosen || !naming) return
    setIsFolderSaving(true)
    setFolderError(null)
    try {
      if (naming.renaming) {
        await requestApi<ProjectFolder>(`${CLIENT_PROJECTS_ENDPOINT}/${chosen.id}/folders/${naming.renaming.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
      } else {
        const { data } = await requestApi<ProjectFolder>(
          `${CLIENT_PROJECTS_ENDPOINT}/${chosen.id}/folders`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: tab, name, parentId: naming.parentId }) },
          // It creates a record, so a retry must not make the folder twice
          { idempotent: true }
        )
        // A folder just made is the one to work in
        setFolderId(data.id)
      }
      await reloadFolders(chosen.id)
      setNaming(null)
    } catch (reason: unknown) {
      setFolderError(reason instanceof Error ? reason.message : PROJECT_FOLDER_MESSAGES.createFailed)
    } finally {
      setIsFolderSaving(false)
    }
  }

  /** Moves one item, or one folder, into another folder (null for the top of the tree). */
  const moveInto = async (target: string | null) => {
    if (!chosen) return
    const task = movingTask
    const folder = movingFolder
    setIsFolderSaving(true)
    setFolderError(null)
    try {
      if (task) {
        await saveTask(task, { folderId: target })
        await reloadFolders(chosen.id)
        setMovingTask(null)
      } else if (folder) {
        await requestApi<ProjectFolder>(`${CLIENT_PROJECTS_ENDPOINT}/${chosen.id}/folders/${folder.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: target }),
        })
        await reloadFolders(chosen.id)
        setMovingFolder(null)
      }
    } catch (reason: unknown) {
      setFolderError(reason instanceof Error ? reason.message : PROJECT_FOLDER_MESSAGES.moveFailed)
    } finally {
      setIsFolderSaving(false)
    }
  }

  /** Deletes a folder. What was inside comes up one level, so the items are read again. */
  const removeFolder = async () => {
    if (!chosen || !deletingFolder) return
    setFolderBusyId(deletingFolder.id)
    setFolderError(null)
    try {
      await requestApi(`${CLIENT_PROJECTS_ENDPOINT}/${chosen.id}/folders/${deletingFolder.id}`, { method: "DELETE" })
      // The folder being looked at may be the one that went, so the view goes to where it was
      if (folderId === deletingFolder.id) setFolderId(deletingFolder.parentId)
      setDeletingFolder(null)
      setAttempt((count) => count + 1)
    } catch (reason: unknown) {
      setFolderError(reason instanceof Error ? reason.message : PROJECT_FOLDER_MESSAGES.deleteFailed)
    } finally {
      setFolderBusyId(null)
    }
  }

  /** Writes a .txt document in the app and files it where the user is looking. */
  const writeDocument = async (name: string, text: string) => {
    if (!chosen) return
    setIsFolderSaving(true)
    setFolderError(null)
    try {
      const { data } = await requestApi<ProjectTask>(
        `${CLIENT_PROJECTS_ENDPOINT}/${chosen.id}/documents`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, text, folderId }) },
        // It stores a file and creates an item, so a retry must not write the document twice
        { idempotent: true }
      )
      setTasks((current) => [...current, data])
      bump(chosen.id, data.kind, 1, 0)
      await reloadFolders(chosen.id)
      setIsWriting(false)
    } catch (reason: unknown) {
      setFolderError(reason instanceof Error ? reason.message : PROJECT_FOLDER_MESSAGES.writeFailed)
    } finally {
      setIsFolderSaving(false)
    }
  }

  const removeTask = async () => {
    if (!deleting || !chosen) return
    setIsDeleting(true)
    try {
      await requestApi(`${CLIENT_PROJECTS_ENDPOINT}/${chosen.id}/tasks/${deleting.id}`, { method: "DELETE" })
      setTasks((current) => current.filter((row) => row.id !== deleting.id))
      bump(chosen.id, deleting.kind, -1, deleting.status === "done" ? -1 : 0)
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
                Projects Management
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
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                {/* The projects, with the one being worked on picked out */}
                <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-2xl border border-outline-variant bg-white p-2 xl:max-h-[calc(100vh-280px)]">
                  {projects.map((project) => {
                    const isChosen = chosen?.id === project.id
                    // Only what can be ticked off is "done": a credential, a link, a document or a
                    // backup is kept rather than finished, so it is counted as what the project holds
                    const work = workItems(project.counts)
                    const held = totalItems(project.counts)
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
                            {work.total > 0
                              ? `${work.done} of ${work.total} done`
                              : held.total > 0
                                ? `${held.total} ${held.total === 1 ? "item" : "items"}`
                                : "Nothing on it yet"}
                            {work.total > 0 && held.total > work.total ? ` · ${held.total - work.total} kept` : ""}
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

                    <ProjectTabs
                      chosen={tab}
                      onChoose={(next) => {
                        setTab(next)
                        // Each tab has its own folders, so changing tab opens that tab at the top
                        setFolderId(null)
                        setFolderSearch("")
                      }}
                      counts={tasks ? countsOf(tasks) : chosen.counts}
                    />

                    <div id={`project-panel-${tab}`} role="tabpanel" aria-labelledby={`project-tab-${tab}`} className="flex min-w-0 flex-col gap-3">
                      {/* Keyed by the tab, so each one opens its own empty form rather than what
                          was half written on another */}
                      <TaskComposer key={tab} task={null} kind={tab} onSave={addTask} fileEndpoint={`${CLIENT_PROJECTS_ENDPOINT}/${chosen.id}/files`} />

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
                      ) : !hasFolders(tab) ? (
                        /* The tabs that are a conversation about the work stay a flat list */
                        <ProjectTasks
                          tasks={tasks.filter((task) => task.kind === tab)}
                          kind={tab}
                          busyId={busyId}
                          onTick={tick}
                          onEdit={setEditing}
                          onDelete={setDeleting}
                          clientTag={PROJECT_TASK_MESSAGES.fromClient}
                        />
                      ) : (
                        (() => {
                          const tabFolders = folders.filter((folder) => folder.kind === tab)
                          const branch = folderBranch(tabFolders, folderId)
                          const ofTab = tasks.filter((task) => task.kind === tab)
                          const inHere = ofTab.filter((task) => branch.has(task.folderId ?? null))
                          const searched = folderSearch.trim()
                            ? filterByWords(inHere, folderSearch, (task) => `${task.content} ${task.url} ${task.files.map((file) => file.name).join(" ")}`)
                            : inHere
                          const path = folderPath(tabFolders, folderId)
                          return (
                            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                              <div className="min-w-0 rounded-2xl border border-outline-variant bg-white p-2">
                                <ProjectFolderTree
                                  folders={tabFolders}
                                  selectedId={folderId}
                                  rootCount={ofTab.filter((task) => !task.folderId).length}
                                  busyId={folderBusyId}
                                  onSelect={(id) => {
                                    setFolderId(id)
                                    setFolderSearch("")
                                  }}
                                  onCreate={(parentId) => {
                                    setFolderError(null)
                                    setNaming({ renaming: null, parentId })
                                  }}
                                  onRename={(folder) => {
                                    setFolderError(null)
                                    setNaming({ renaming: folder, parentId: folder.parentId })
                                  }}
                                  onDelete={(folder) => {
                                    setFolderError(null)
                                    setDeletingFolder(folder)
                                  }}
                                />
                              </div>

                              <div className="flex min-w-0 flex-col gap-3">
                                {/* Where the list is, and the two things to do here: search it, or
                                    write a document straight into it */}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="min-w-0 text-[12px] text-on-surface-variant">
                                    <span className="font-semibold text-on-surface">
                                      {path.length === 0 ? PROJECT_FOLDER_MESSAGES.root : path.map((folder) => folder.name).join(" / ")}
                                    </span>
                                    {path.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setMovingFolder(path[path.length - 1])}
                                        className="ml-2 font-semibold text-primary hover:underline"
                                      >
                                        {PROJECT_FOLDER_MESSAGES.move}
                                      </button>
                                    )}
                                  </p>
                                  {tab === "document" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFolderError(null)
                                        setIsWriting(true)
                                      }}
                                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                                    >
                                      <FilePlus2 size={14} aria-hidden="true" />
                                      {PROJECT_FOLDER_MESSAGES.write}
                                    </button>
                                  )}
                                </div>

                                <div>
                                  <input
                                    value={folderSearch}
                                    onChange={(event) => setFolderSearch(event.target.value)}
                                    placeholder={PROJECT_FOLDER_MESSAGES.searchHere}
                                    aria-label={PROJECT_FOLDER_MESSAGES.searchHere}
                                    className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-[13px] text-on-surface placeholder:text-outline focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
                                  />
                                  <p className="mt-1 text-[11px] text-outline">{PROJECT_FOLDER_MESSAGES.searchScope}</p>
                                </div>

                                {folderError && (
                                  <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                                    {folderError}
                                  </p>
                                )}

                                {searched.length === 0 ? (
                                  <p className="rounded-xl border border-dashed border-outline-variant px-3 py-6 text-center text-[13px] text-outline">
                                    {folderSearch.trim() ? PROJECT_FOLDER_MESSAGES.noMatch : PROJECT_FOLDER_MESSAGES.empty}
                                  </p>
                                ) : (
                                  <ProjectTasks
                                    tasks={searched}
                                    kind={tab}
                                    busyId={busyId}
                                    onTick={tick}
                                    onEdit={setEditing}
                                    onDelete={setDeleting}
                                    onMove={(task) => {
                                      setFolderError(null)
                                      setMovingTask(task)
                                    }}
                                    clientTag={PROJECT_TASK_MESSAGES.fromClient}
                                  />
                                )}
                              </div>
                            </div>
                          )
                        })()
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {naming && chosen && (
        <FolderNameDialog
          folders={folders.filter((folder) => folder.kind === tab)}
          renaming={naming.renaming}
          parentId={naming.parentId}
          isSaving={isFolderSaving}
          error={folderError}
          onSubmit={(name) => void makeFolder(name)}
          onClose={() => {
            if (isFolderSaving) return
            setNaming(null)
            setFolderError(null)
          }}
        />
      )}

      {(movingTask || movingFolder) && chosen && (
        <MoveToFolderDialog
          folders={folders.filter((folder) => folder.kind === (movingTask?.kind ?? movingFolder?.kind ?? tab))}
          what={movingTask ? movingTask.content : (movingFolder?.name ?? "")}
          movingFolderId={movingFolder?.id ?? null}
          currentFolderId={movingTask ? movingTask.folderId : (movingFolder?.parentId ?? null)}
          isSaving={isFolderSaving}
          error={folderError}
          onSubmit={(target) => void moveInto(target)}
          onClose={() => {
            if (isFolderSaving) return
            setMovingTask(null)
            setMovingFolder(null)
            setFolderError(null)
          }}
        />
      )}

      {isWriting && chosen && (
        <WriteDocumentDialog
          folders={folders.filter((folder) => folder.kind === "document")}
          folderId={folderId}
          isSaving={isFolderSaving}
          error={folderError}
          onSubmit={(name, text) => void writeDocument(name, text)}
          onClose={() => {
            if (isFolderSaving) return
            setIsWriting(false)
            setFolderError(null)
          }}
        />
      )}

      {deletingFolder && (
        <Modal
          title={`Delete the folder ${deletingFolder.name}?`}
          description={PROJECT_FOLDER_MESSAGES.deleteExplains}
          onClose={() => setDeletingFolder(null)}
          isCloseDisabled={folderBusyId === deletingFolder.id}
          size="compact"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingFolder(null)}
                disabled={folderBusyId === deletingFolder.id}
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => void removeFolder()}
                disabled={folderBusyId === deletingFolder.id}
                className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-error/90 disabled:opacity-60"
              >
                {folderBusyId === deletingFolder.id && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                Delete the folder
              </button>
            </div>
          }
        >
          <p className="text-[13px] leading-relaxed text-on-surface-variant">
            {deletingFolder.totalItemCount > 0
              ? `${deletingFolder.totalItemCount} ${deletingFolder.totalItemCount === 1 ? "item is" : "items are"} filed in it. ${PROJECT_FOLDER_MESSAGES.deleteExplains}`
              : PROJECT_FOLDER_MESSAGES.deleteExplains}
          </p>
        </Modal>
      )}

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
