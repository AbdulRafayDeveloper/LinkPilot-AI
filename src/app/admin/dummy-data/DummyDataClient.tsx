"use client"

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical, Loader2, Pencil, Play, Plus, RefreshCw, Search } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { DummyDataModal } from "@/components/dummy-data/DummyDataModal"
import { DummyItemDialog } from "@/components/dummy-data/DummyItemDialog"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { putDummyHandoff } from "@/lib/dummyHandoff"
import { matchesWords } from "@/lib/nameSearch"
import { dummyTools, type DummyTool } from "@/lib/dummyTools"
import { DUMMY_DATA_ENDPOINT, DUMMY_DATA_KINDS, DUMMY_DATA_MESSAGES, type DummyDataKind } from "@/constants/dummyData"
import type { DummyDataGroup, DummyItem } from "@/types/dummyData"

/**
 * Dummy Data for Testing: every piece of sample data in the app, read **tool wise**.
 *
 * It used to be a button on each tool's own header, which cost every tool a button for something
 * only an admin ever uses. Then it became one page listing every kind at once, which is how it grew
 * an "All" chip and cards carrying three tool names each. An admin is never testing "all tools":
 * they are about to use one, so the tools are the chips, one is always chosen, and the page shows
 * that tool's sample data alone with a single **Use in <tool>** on each card. The names and their
 * order come from `APP_TOOLS` through `lib/dummyTools.ts`, so they are exactly the sidebar's own.
 *
 * Admins only, three times over as the rest of the admin area is: the page checks the role, every
 * route behind it checks the role, and the sidebar never offers it to a user.
 */

interface Row {
  kind: DummyDataKind
  item: DummyItem
}

const TOOLS = dummyTools()
const FIRST_TOOL = TOOLS[0]?.href ?? ""

/**
 * Which tool was last looked at, kept per browser the way the sidebar keeps being collapsed: an
 * admin testing one tool opens this page several times in a row, and landing on the first tool each
 * time is work. Read through `useSyncExternalStore`, as the sidebar's own choices are, so the
 * server render and the browser's first render agree and nothing is set from inside an effect.
 */
const CHOICE_KEY = "linkpilot:dummy-data-tool"
const CHOICE_EVENT = "dummy-data-tool-change"

const subscribeChoice = (onChange: () => void) => {
  window.addEventListener(CHOICE_EVENT, onChange)
  return () => window.removeEventListener(CHOICE_EVENT, onChange)
}

const readChoice = () => {
  try {
    const saved = localStorage.getItem(CHOICE_KEY)
    return saved && TOOLS.some((tool) => tool.href === saved) ? saved : FIRST_TOOL
  } catch {
    return FIRST_TOOL
  }
}

const rememberChoice = (href: string) => {
  try {
    localStorage.setItem(CHOICE_KEY, href)
  } catch {
    // Not being able to remember it costs nothing: the chip is still chosen for this visit
  }
  window.dispatchEvent(new Event(CHOICE_EVENT))
}

const charactersOf = (item: DummyItem) => Object.values(item.fields).reduce((total, value) => total + value.length, 0)

/** "Connection Note and InMail Message", or nothing when this tool's sample data is its own. */
const sharedWith = (kind: DummyDataKind, href: string) => {
  const others = DUMMY_DATA_KINDS[kind].uses
    .filter((entry) => entry !== href)
    .map((entry) => TOOLS.find((tool) => tool.href === entry)?.title ?? entry)
  if (others.length === 0) return ""
  const last = others[others.length - 1]
  return others.length === 1 ? last : `${others.slice(0, -1).join(", ")} and ${last}`
}

export default function DummyDataClient() {
  const router = useRouter()
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [groups, setGroups] = useState<DummyDataGroup[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // The tool being tested. One is always chosen: there is no "every tool at once" to choose
  const href = useSyncExternalStore(subscribeChoice, readChoice, () => FIRST_TOOL)
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

  const chosen = useMemo<DummyTool | null>(() => TOOLS.find((tool) => tool.href === href) ?? TOOLS[0] ?? null, [href])

  /** How much sample data each tool has, so a chip says whether it is worth opening. */
  const counts = useMemo(() => {
    const byKind = new Map<DummyDataKind, number>()
    for (const group of groups ?? []) byKind.set(group.kind, group.items.length)
    const byTool = new Map<string, number>()
    for (const tool of TOOLS) {
      byTool.set(
        tool.href,
        tool.kinds.reduce((total, kind) => total + (byKind.get(kind) ?? 0), 0)
      )
    }
    return byTool
  }, [groups])

  const rows = useMemo<Row[]>(() => {
    if (!chosen) return []
    const kinds = new Set<DummyDataKind>(chosen.kinds)
    return (groups ?? [])
      .filter((group) => kinds.has(group.kind))
      .flatMap((group) => group.items.map((item) => ({ kind: group.kind, item })))
      .filter((row) => !search.trim() || matchesWords(row.item.name, search))
  }, [groups, chosen, search])

  const choose = (where: string) => {
    rememberChoice(where)
    setSearch("")
  }

  /** Leaves the item for the tool and opens it; the popup goes with the page. */
  const use = (row: Row, where: string) => {
    putDummyHandoff(row.kind, row.item.name, row.item.fields)
    setReading(null)
    router.push(where)
  }

  const buttonClass =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
  // The headings the chips are grouped under, in the sidebar's own order
  const headings = TOOLS.reduce<string[]>((all, tool) => (all.includes(tool.heading) ? all : [...all, tool.heading]), [])
  const shared = chosen ? chosen.kinds.map((kind) => sharedWith(kind, chosen.href)).filter(Boolean) : []

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

            {/* One chip per tool, under its sidebar heading, each saying how much sample data it has */}
            <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 shadow-sm">
              <div className="flex flex-col gap-2" role="group" aria-label="Which tool to show the sample data of">
                {headings.map((heading) => (
                  <div key={heading} className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 shrink-0 text-[11px] font-bold uppercase tracking-wider text-outline">{heading}</span>
                    {TOOLS.filter((tool) => tool.heading === heading).map((tool) => (
                      <button
                        key={tool.href}
                        type="button"
                        onClick={() => choose(tool.href)}
                        aria-pressed={chosen?.href === tool.href}
                        title={`Show the sample data for ${tool.title}`}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                          chosen?.href === tool.href
                            ? "bg-primary text-white"
                            : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                        }`}
                      >
                        {tool.title} ({counts.get(tool.href) ?? 0})
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-outline-variant px-3 py-2">
                <Search size={15} className="shrink-0 text-outline" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={chosen ? `Search the sample data for ${chosen.title}` : "Search by name"}
                  aria-label="Search this tool's sample data by name"
                  className="min-w-0 flex-1 bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
                />
              </div>
            </div>

            {chosen && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold text-on-surface">
                    {chosen.title}
                    <span className="ml-2 text-[12px] font-semibold text-outline">
                      {rows.length} {rows.length === 1 ? "piece" : "pieces"} of sample data
                    </span>
                  </h2>
                  {shared.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-outline">
                      The same {DUMMY_DATA_KINDS[chosen.kinds[0]].item}s fill {shared.join("; ")}, so a change here changes them there too.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {chosen.kinds.map((kind) => (
                    <button key={kind} type="button" onClick={() => setEditing(kind)} className={buttonClass}>
                      <Plus size={13} aria-hidden="true" />
                      Add or remove {DUMMY_DATA_KINDS[kind].item}s
                    </button>
                  ))}
                </div>
              </div>
            )}

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
              <p className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-10 text-center text-sm text-on-surface-variant">
                {search.trim() ? DUMMY_DATA_MESSAGES.noResults : DUMMY_DATA_MESSAGES.empty}
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {/* `grid-cols-1` is not decoration: without it the single column is sized by a card's
                    own buttons, which pushed a card 45px past the right edge of a phone */}
                {rows.map((row) => (
                  <li key={`${row.kind}:${row.item.id}`}>
                    <div className="flex h-full flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 shadow-sm">
                      <button type="button" onClick={() => setReading(row)} className="group min-w-0 text-left" aria-label={`Read ${row.item.name}`}>
                        <span className="block truncate text-[13px] font-semibold text-on-surface group-hover:text-primary">{row.item.name}</span>
                        <span className="mt-0.5 block text-[11px] text-outline">
                          {DUMMY_DATA_KINDS[row.kind].item} · {charactersOf(row.item).toLocaleString()} characters
                        </span>
                      </button>
                      <div className="mt-auto flex flex-wrap items-center gap-1.5">
                        <button type="button" onClick={() => setReading(row)} className={buttonClass}>
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => use(row, chosen?.href ?? DUMMY_DATA_KINDS[row.kind].uses[0])}
                          title={`Open ${chosen?.title ?? "the tool"} with this filled in`}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-hover"
                        >
                          <Play size={12} aria-hidden="true" />
                          Use in {chosen?.title ?? "the tool"}
                        </button>
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
          </div>
        </main>
      </div>

      {reading && (
        <DummyItemDialog
          kind={reading.kind}
          item={reading.item}
          tool={chosen ?? undefined}
          onUse={(where) => use(reading, where)}
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
            const where = chosen?.href ?? DUMMY_DATA_KINDS[editing].uses[0]
            putDummyHandoff(editing, "sample data", fields)
            setEditing(null)
            router.push(where)
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
