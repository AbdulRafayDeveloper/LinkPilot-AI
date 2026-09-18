"use client"

import React, { useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, FileText, FolderKanban, Loader2, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { CopyButton } from "@/components/ui/CopyButton"
import { FilterPanel, SearchFilter } from "@/components/history/HistoryFilters"
import { ProjectDialog } from "@/components/projects/ProjectDialog"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { usePromptProjects } from "@/hooks/usePromptProjects"
import { filterByWords } from "@/lib/nameSearch"
import { PROMPT_PROJECT_MESSAGES } from "@/constants/promptProjects"
import type { PromptProject } from "@/types/promptProjects"

const PROMPT_CREATOR_HREF = "/prompt-creator"

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

const promptsLabel = (count: number) => `${count.toLocaleString()} ${count === 1 ? "prompt" : "prompts"}`

/**
 * Projects: the projects on the left (searched by name or instructions), the chosen project on the
 * right with its instructions, laid out the way Clients Management is. The prompts themselves are
 * read in Prompt Creator, in the folder each project has, so they are not listed again here.
 *
 * It reads and writes through `usePromptProjects`, the same list Prompt Creator's picker reads, so a
 * project made or renamed here is the one offered there, and the records are the same `prompt_projects`
 * documents they always were. The first project is open when the page loads.
 */
export default function ProjectsClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const projects = usePromptProjects()
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ project: PromptProject | null } | null>(null)
  const [deleting, setDeleting] = useState<PromptProject | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  const list = projects.projects
  const shown = filterByWords(list ?? [], search, (project) => `${project.name} ${project.instructions}`)
  // Nothing chosen yet (a fresh load, or the chosen one was deleted): the first project is open
  const current = list?.find((project) => project.id === selectedId) ?? shown[0] ?? null
  const hasFilters = search.trim().length > 0

  const choose = (project: PromptProject) => {
    setSelectedId(project.id)
    // On a narrow screen the details sit below the list, so bring them into view
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    }
  }

  const remove = async () => {
    if (!deleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await projects.remove(deleting.id)
      if (selectedId === deleting.id) setSelectedId(null)
      setDeleting(null)
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : PROMPT_PROJECT_MESSAGES.deleteFailed)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                  <FolderKanban size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  Projects
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  What your prompts are written for. A project&apos;s instructions are added to the end of every prompt created in it, and
                  each project gets a folder with its name in Prompt Creator, where the prompts written in it are saved.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialog({ project: null })}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant sm:shrink-0"
              >
                <Plus size={16} aria-hidden="true" />
                Add project
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:items-start">
              {/* The projects */}
              <div className="flex flex-col gap-3">
                <FilterPanel
                  columnsClassName="lg:grid-cols-1"
                  canClear={hasFilters}
                  onClear={() => setSearch("")}
                  summary={list ? `${shown.length.toLocaleString()} of ${list.length.toLocaleString()} shown` : "Loading your projects..."}
                >
                  <SearchFilter value={search} onChange={setSearch} placeholder="Name or instructions" />
                </FilterPanel>

                {projects.error && !list ? (
                  <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-white py-10 text-center">
                    <AlertTriangle size={20} className="text-error" aria-hidden="true" />
                    <p className="max-w-xs text-sm text-on-surface-variant">{projects.error}</p>
                    <button
                      type="button"
                      onClick={projects.reload}
                      className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-container-high"
                    >
                      <RefreshCw size={15} aria-hidden="true" />
                      Try again
                    </button>
                  </div>
                ) : !list ? (
                  <div role="status" className="flex items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-white py-10 text-sm text-on-surface-variant">
                    <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
                    Loading your projects...
                  </div>
                ) : shown.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-outline-variant bg-white px-6 py-10 text-center">
                    <FolderKanban size={22} className="text-primary" aria-hidden="true" />
                    <p className="text-sm text-on-surface-variant">{hasFilters ? PROMPT_PROJECT_MESSAGES.noMatch : PROMPT_PROJECT_MESSAGES.empty}</p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {shown.map((project) => {
                      const isSelected = current?.id === project.id
                      return (
                        <li key={project.id}>
                          <button
                            type="button"
                            onClick={() => choose(project)}
                            aria-current={isSelected ? "true" : undefined}
                            className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                              isSelected ? "border-primary bg-primary-fixed/40" : "border-outline-variant bg-white hover:bg-surface-container-lowest"
                            }`}
                          >
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                                isSelected ? "bg-primary text-white" : "bg-primary-fixed text-on-primary-fixed-variant"
                              }`}
                            >
                              {initialsOf(project.name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-semibold text-on-surface">{project.name}</span>
                              <span className="block truncate text-[12px] text-on-surface-variant">
                                {promptsLabel(project.promptCount)}
                                {project.instructions ? " · has instructions" : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* The chosen project */}
              <div ref={detailRef} className="flex scroll-mt-4 flex-col gap-4">
                {current ? (
                    <section aria-label="Project details" className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-5">
                      {/* The details column is full width below lg but only about 290px between lg and xl,
                          where the name and the buttons cannot share a row; it has the width again from xl */}
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between lg:flex-col xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white">
                            {initialsOf(current.name)}
                          </span>
                          <div className="min-w-0">
                            <h2 className="truncate text-xl font-bold text-on-surface">{current.name}</h2>
                            <p className="text-[13px] text-on-surface-variant">{promptsLabel(current.promptCount)} written in it</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={PROMPT_CREATOR_HREF}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant px-3 py-2 text-[13px] font-semibold text-on-surface transition-colors hover:border-primary/40 hover:text-primary"
                          >
                            <Sparkles size={14} aria-hidden="true" />
                            Write a prompt
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDialog({ project: current })}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null)
                              setDeleting(current)
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-[13px] font-semibold text-outline transition-colors hover:border-error/40 hover:text-error"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-1.5 border-t border-outline-variant/70 pt-4">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-outline">
                            <FileText size={12} aria-hidden="true" />
                            Instructions
                          </h3>
                          {current.instructions && <CopyButton text={current.instructions} label="Copy instructions" showLabel />}
                        </div>
                        {current.instructions ? (
                          <p className="whitespace-pre-wrap rounded-xl bg-surface-container-lowest px-3 py-2.5 text-[13px] leading-relaxed text-on-surface [overflow-wrap:anywhere]">
                            {current.instructions}
                          </p>
                        ) : (
                          <p className="text-[12px] text-outline">{PROMPT_PROJECT_MESSAGES.noInstructions}</p>
                        )}
                      </div>
                    </section>
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-outline-variant bg-white px-6 py-16 text-center">
                    <FolderKanban size={24} className="text-primary" aria-hidden="true" />
                    <p className="text-[15px] font-semibold text-on-surface">{PROMPT_PROJECT_MESSAGES.choose}</p>
                    <p className="max-w-sm text-sm text-on-surface-variant">{PROMPT_PROJECT_MESSAGES.chooseHint}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {dialog && (
        <ProjectDialog
          project={dialog.project}
          onSave={(input) => {
            const editing = dialog.project
            return editing ? projects.save(editing.id, input) : projects.create(input)
          }}
          onClose={() => setDialog(null)}
          onSaved={(project) => {
            setDialog(null)
            setSelectedId(project.id)
          }}
        />
      )}

      {deleting && (
        <Modal
          title={`Delete ${deleting.name}?`}
          description={PROMPT_PROJECT_MESSAGES.deleteExplains}
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
            <p className="text-sm text-on-surface-variant">
              {deleting.promptCount === 0
                ? "No prompts have been written in it yet."
                : `${promptsLabel(deleting.promptCount)} written in it will be kept and go back to no project.`}
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}
