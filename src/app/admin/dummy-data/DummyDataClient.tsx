"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical, Loader2, Pencil, Play, RefreshCw, Search } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { DummyDataModal } from "@/components/dummy-data/DummyDataModal"
import { DummyItemDialog } from "@/components/dummy-data/DummyItemDialog"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { putDummyHandoff } from "@/lib/dummyHandoff"
import { matchesWords } from "@/lib/nameSearch"
import { APP_TOOLS } from "@/constants/linkedinTools"
import { DUMMY_DATA_ENDPOINT, DUMMY_DATA_KINDS, DUMMY_DATA_MESSAGES, type DummyDataKind } from "@/constants/dummyData"
import type { DummyDataGroup, DummyItem } from "@/types/dummyData"

/**
 * Dummy Data for Testing: every piece of sample data in the app, in one place.
 *
 * It used to be a button on each tool's own header, which cost every tool a button for something
 * only an admin ever uses. Now the tools carry nothing: an item is opened here, read in full, and
 * **Use** opens the tool it belongs to with its inputs already filled (lib/dummyHandoff.ts). A kind
 * several tools share, like a profile, offers each of them.
 *
 * Admins only, three times over as the rest of the admin area is: the page checks the role, every
 * route behind it checks the role, and the sidebar never offers it to a user.
 */

// What a kind is called on screen; written out per kind, since two kinds share an item name
const kindLabel = (kind: DummyDataKind) => DUMMY_DATA_KINDS[kind].label

const toolTitle = (href: string) => APP_TOOLS.find((tool) => tool.href === href)?.title ?? href

interface Row {
  kind: DummyDataKind
  item: DummyItem
}

export default function DummyDataClient() {
  const router = useRouter()
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [groups, setGroups] = useState<DummyDataGroup[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [kind, setKind] = useState<DummyDataKind | "all">("all")
  const [search, setSearch] = useState("")
  // The item being read, and the kind whose editor is open
  const [reading, setReading] = useState<Row | null>(null)
  const [editing, setEditing] = useState<DummyDataKind | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<DummyDataGroup[]>(DUMMY_DATA_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        setGroups(data)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : DUMMY_DATA_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [attempt])

  const rows = useMemo<Row[]>(() => {
    const all = (groups ?? []).flatMap((group) => group.items.map((item) => ({ kind: group.kind, item })))
    return all
      .filter((row) => kind === "all" || row.kind === kind)
      .filter((row) => !search.trim() || matchesWords(`${row.item.name} ${kindLabel(row.kind)}`, search))
  }, [groups, kind, search])

  const counts = useMemo(() => {
    const byKind = new Map<DummyDataKind, number>()
    for (const group of groups ?? []) byKind.set(group.kind, group.items.length)
    return byKind
  }, [groups])

  /** Leaves the item for the tool and opens it; the popup goes with the page. */
  const use = (row: Row, href: string) => {
    putDummyHandoff(row.kind, row.item.name, row.item.fields)
    setReading(null)
    router.push(href)
  }

  const kinds = (groups ?? []).map((group) => group.kind)
  const buttonClass =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />
      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:p-8">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                  <FlaskConical size={22} className="text-primary" aria-hidden="true" />
                  Dummy Data for Testing
                </h1>
                <p className="mt-1 max-w-3xl text-[13px] text-on-surface-variant">{DUMMY_DATA_MESSAGES.intro}</p>
              </div>
              <button type="button" onClick={() => setAttempt((count) => count + 1)} className={`${buttonClass} shrink-0 py-2.5`}>
                <RefreshCw size={15} aria-hidden="true" />
                Reload
              </button>
            </div>

            {/* One chip per kind, each with how much it holds, plus a search over the names */}
            <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setKind("all")}
                  aria-pressed={kind === "all"}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    kind === "all" ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  All ({(groups ?? []).reduce((total, group) => total + group.items.length, 0)})
                </button>
                {kinds.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setKind(entry)}
                    aria-pressed={kind === entry}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      kind === entry ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    {kindLabel(entry)} ({counts.get(entry) ?? 0})
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-outline-variant px-3 py-2">
                <Search size={15} className="shrink-0 text-outline" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name"
                  aria-label="Search the sample data by name"
                  className="min-w-0 flex-1 bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
                />
              </div>
            </div>

            {error ? (
              <p role="alert" className="rounded-2xl border border-error/40 bg-error-container px-4 py-3 text-[13px] text-error">
                {error}
              </p>
            ) : !groups ? (
              <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
                <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
                Loading the sample data...
              </p>
            ) : rows.length === 0 ? (
              <p className="rounded-2xl border border-outline-variant bg-white px-4 py-10 text-center text-sm text-on-surface-variant">
                {search.trim() ? DUMMY_DATA_MESSAGES.noResults : DUMMY_DATA_MESSAGES.empty}
              </p>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {rows.map((row) => (
                  <li key={`${row.kind}:${row.item.id}`}>
                    <div className="flex h-full flex-col gap-2 rounded-2xl border border-outline-variant bg-white p-3 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setReading(row)}
                        className="group min-w-0 text-left"
                        aria-label={`Read ${row.item.name}`}
                      >
                        <span className="block truncate text-[13px] font-semibold text-on-surface group-hover:text-primary">
                          {row.item.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-outline">
                          {kindLabel(row.kind)} · {DUMMY_DATA_KINDS[row.kind].uses.map(toolTitle).join(", ")}
                        </span>
                      </button>
                      <div className="mt-auto flex flex-wrap items-center gap-1.5">
                        <button type="button" onClick={() => setReading(row)} className={buttonClass}>
                          Open
                        </button>
                        {DUMMY_DATA_KINDS[row.kind].uses.map((href) => (
                          <button
                            key={href}
                            type="button"
                            onClick={() => use(row, href)}
                            title={`Open ${toolTitle(href)} with this filled in`}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant"
                          >
                            <Play size={12} aria-hidden="true" />
                            Use in {toolTitle(href)}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditing(row.kind)}
                          title={`Edit the sample ${DUMMY_DATA_KINDS[row.kind].item}s`}
                          className={`${buttonClass} ml-auto`}
                        >
                          <Pencil size={13} aria-hidden="true" />
                          Edit
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Adding and removing stays in the editor each kind already had */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-outline">Add or remove:</span>
              {kinds.map((entry) => (
                <button key={entry} type="button" onClick={() => setEditing(entry)} className={buttonClass}>
                  {kindLabel(entry)}
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>

      {reading && (
        <DummyItemDialog
          kind={reading.kind}
          item={reading.item}
          onUse={(href) => use(reading, href)}
          onEdit={() => {
            setEditing(reading.kind)
            setReading(null)
          }}
          onClose={() => setReading(null)}
        />
      )}
      {editing && (
        <DummyDataModal
          kind={editing}
          onUse={(fields) => {
            const href = DUMMY_DATA_KINDS[editing].uses[0]
            putDummyHandoff(editing, "sample data", fields)
            setEditing(null)
            router.push(href)
          }}
          onClose={() => {
            setEditing(null)
            setAttempt((count) => count + 1)
          }}
        />
      )}
    </div>
  )
}
