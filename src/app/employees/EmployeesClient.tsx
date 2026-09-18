"use client"

import React, { useRef, useState } from "react"
import { AlertTriangle, Briefcase, CalendarDays, Contact, Loader2, MapPin, Pencil, Plus, RefreshCw, Trash2, UserRound } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { SortableList } from "@/components/ui/SortableList"
import { FilterPanel, SearchFilter, SelectFilter } from "@/components/history/HistoryFilters"
import { LoadMore } from "@/components/history/LoadMore"
import { EmployeeDialog } from "@/components/employees/EmployeeDialog"
import { PlanEditor } from "@/components/employees/PlanEditor"
import { PlanLinkActions, PlanLinkConfirmDialog, PlanLinkPanel, usePlanLink } from "@/components/employees/PlanLinkPanel"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useCursorList } from "@/hooks/useCursorList"
import { BulkDeleteBar, ConfirmBulkDelete } from "@/components/ui/BulkDelete"
import { requestApi } from "@/lib/apiClient"
import { HISTORY_DEBOUNCE_MS } from "@/constants/historyFilters"
import { EMPLOYEES_ENDPOINT, EMPLOYEE_MESSAGES, EMPLOYEE_STATUSES } from "@/constants/employees"
import type { Employee, EmployeesPage } from "@/types/employees"

const idOf = (employee: Employee) => employee.id
const nameOf = (employee: Employee) => employee.name

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

const joinedOn = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

// "2 years, 3 months" from the joining day to today; "Starts on …" for a future day
function tenure(day: string): string {
  const joined = new Date(`${day}T00:00:00Z`)
  const now = new Date()
  if (joined.getTime() > now.getTime()) return `Starts on ${joinedOn(day)}`
  const months = (now.getUTCFullYear() - joined.getUTCFullYear()) * 12 + now.getUTCMonth() - joined.getUTCMonth() - (now.getUTCDate() < joined.getUTCDate() ? 1 : 0)
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (months < 1) return "Joined this month"
  const parts = [years ? `${years} ${years === 1 ? "year" : "years"}` : "", rest ? `${rest} ${rest === 1 ? "month" : "months"}` : ""].filter(Boolean)
  return parts.join(", ")
}

const StatusBadge: React.FC<{ status: Employee["status"] }> = ({ status }) => (
  <span
    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      status === "active" ? "bg-success-container text-on-success-container" : "bg-surface-container-high text-on-surface-variant"
    }`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${status === "active" ? "bg-success" : "bg-outline"}`} aria-hidden="true" />
    {status === "active" ? "Active" : "Inactive"}
  </span>
)

/**
 * Employees Management: the team on the left (searched and filtered, and put in order by dragging),
 * the chosen employee on the right with their details, their plan link and their daily plan with its
 * history. The first employee is open when the page loads, so there is always someone to look at.
 */
export default function EmployeesClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [selected, setSelected] = useState<Employee | null>(null)
  const [dialog, setDialog] = useState<{ employee: Employee | null } | null>(null)
  const [deleting, setDeleting] = useState<Employee | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Deleting the ticked employees, confirmed the same way one employee is
  const [isConfirmingPicked, setIsConfirmingPicked] = useState(false)
  const [isDeletingPicked, setIsDeletingPicked] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  // Orders are saved one after another, so two quick drags land in the order they were made
  const orderQueue = useRef<Promise<void>>(Promise.resolve())

  const settledSearch = useDebouncedValue(search.trim(), HISTORY_DEBOUNCE_MS)
  const params = new URLSearchParams()
  if (search.trim() && settledSearch) params.set("search", settledSearch)
  if (status) params.set("status", status)

  const list = useCursorList<Employee, EmployeesPage>({
    endpoint: EMPLOYEES_ENDPOINT,
    query: params.toString(),
    enabled: true,
    loadFailed: EMPLOYEE_MESSAGES.loadFailed,
    idOf,
  })
  const counts = list.latest?.counts ?? { active: 0, inactive: 0 }
  const hasFilters = Boolean(search || status)
  // Nobody chosen yet (a fresh load, or the chosen one was deleted): the first employee is open
  const current = selected ?? list.items[0] ?? null
  // The people picked in the list's own circles: dragging moves them together, and the bar deletes them
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  // Dragging puts the whole team in order, so it needs the whole team on screen and no filter
  const canReorder = !hasFilters && list.hasAnswer && list.items.length > 1 && list.items.length === list.total

  const reorderTeam = (orderedIds: string[]) => {
    setOrderError(null)
    // The employee open by default stays open: moving someone to the top must not switch the details to them
    if (!selected && current) setSelected(current)
    list.update((items) => {
      const byId = new Map(items.map((item) => [item.id, item]))
      return orderedIds.map((id) => byId.get(id)).filter((item): item is Employee => Boolean(item))
    })
    orderQueue.current = orderQueue.current.then(async () => {
      try {
        await requestApi(`${EMPLOYEES_ENDPOINT}/order`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds }),
        })
      } catch (reason: unknown) {
        setOrderError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.teamOrderFailed)
        // The server's order is the truth once a save fails
        list.retry()
      }
    })
  }

  const choose = (employee: Employee) => {
    setSelected(employee)
    // On a narrow screen the details sit below the list, so bring them into view
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    }
  }

  const saved = (employee: Employee) => {
    const isNew = dialog?.employee === null
    setDialog(null)
    setSelected(employee)
    // A new employee may not match the filters on screen, so the list is asked for again rather than guessed at
    if (isNew) list.retry()
    else list.update((items) => items.map((item) => (item.id === employee.id ? employee : item)))
  }

  const linkChanged = (employee: Employee) => {
    setSelected(employee)
    list.update((items) => items.map((item) => (item.id === employee.id ? employee : item)))
  }

  // The plan link is changed from the row of actions at the top and shown further down, so its
  // state is held here and handed to both
  const planLink = usePlanLink(current, linkChanged)

  /**
   * Deletes the ticked employees in one call. Each takes their daily plans with them, exactly as
   * deleting one does. Final, so it only runs from the confirmation.
   */
  const removePicked = async () => {
    if (isDeletingPicked) return
    setIsDeletingPicked(true)
    setDeleteError(null)
    try {
      const ids = [...picked]
      await requestApi(EMPLOYEES_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      if (current && ids.includes(current.id)) setSelected(null)
      setPicked(new Set())
      setIsConfirmingPicked(false)
      list.retry()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.deleteFailed)
      setIsConfirmingPicked(false)
    } finally {
      setIsDeletingPicked(false)
    }
  }

  const remove = async () => {
    if (!deleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await requestApi(`${EMPLOYEES_ENDPOINT}/${deleting.id}`, { method: "DELETE" })
      list.update((items) => items.filter((item) => item.id !== deleting.id), -1)
      if (current?.id === deleting.id) setSelected(null)
      setDeleting(null)
      list.retry()
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.deleteFailed)
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
                  <Contact size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  Employees Management
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">Your team, a daily plan for each of them, and a link they can tick their tasks off from.</p>
              </div>
              <button
                type="button"
                onClick={() => setDialog({ employee: null })}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant sm:shrink-0"
              >
                <Plus size={16} aria-hidden="true" />
                Add employee
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:items-start">
              {/* The team */}
              <div className="flex flex-col gap-3">
                <FilterPanel
                  columnsClassName="lg:grid-cols-1"
                  canClear={hasFilters}
                  onClear={() => {
                    setSearch("")
                    setStatus("")
                  }}
                  summary={
                    list.hasAnswer
                      ? `${list.total.toLocaleString()} shown · ${counts.active} active · ${counts.inactive} inactive`
                      : "Loading the team..."
                  }
                >
                  <SearchFilter value={search} onChange={setSearch} placeholder="Name, city or role" />
                  <div className="col-span-2 lg:col-span-1">
                    <SelectFilter label="Status" allLabel="Active and inactive" value={status} options={EMPLOYEE_STATUSES} onChange={setStatus} />
                  </div>
                </FilterPanel>

                {list.error && !list.hasAnswer ? (
                  <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-white py-10 text-center">
                    <AlertTriangle size={20} className="text-error" aria-hidden="true" />
                    <p className="max-w-xs text-sm text-on-surface-variant">{list.error}</p>
                    <button type="button" onClick={list.retry} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold">
                      <RefreshCw size={15} aria-hidden="true" />
                      Try again
                    </button>
                  </div>
                ) : !list.hasAnswer ? (
                  <div role="status" className="flex items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-white py-10 text-sm text-on-surface-variant">
                    <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
                    Loading the team...
                  </div>
                ) : list.items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-outline-variant bg-white px-6 py-10 text-center">
                    <UserRound size={22} className="text-primary" aria-hidden="true" />
                    <p className="text-sm text-on-surface-variant">
                      {hasFilters ? "No employees match these filters." : "No employees yet. Add the first one to start planning their work."}
                    </p>
                  </div>
                ) : (
                  <div className={`flex flex-col gap-2 transition-opacity ${list.isLoading ? "opacity-60" : ""}`} aria-busy={list.isLoading}>
                    {orderError && (
                      <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
                        {orderError}
                      </p>
                    )}
                    {hasFilters && list.items.length > 1 && <p className="px-1 text-[12px] text-outline">{EMPLOYEE_MESSAGES.reorderNeedsAll}</p>}
                    <BulkDeleteBar
                      pickedCount={picked.size}
                      total={null}
                      noun={{ one: "employee", many: "employees" }}
                      isBusy={isDeletingPicked}
                      onDeletePicked={() => setIsConfirmingPicked(true)}
                      onClear={() => setPicked(new Set())}
                    />
                    <SortableList
                      items={list.items}
                      picked={picked}
                      onPickedChange={setPicked}
                      getId={idOf}
                      getLabel={nameOf}
                      onReorder={reorderTeam}
                      label="Employees"
                      multiSelect
                      itemNoun="people"
                      className="flex flex-col gap-2"
                      disabled={!canReorder}
                      renderItem={(employee, handle) => {
                        const isSelected = current?.id === employee.id
                        return (
                          <div
                            className={`flex items-center rounded-2xl border pl-1.5 transition-colors ${
                              isSelected ? "border-primary bg-primary-fixed/40" : "border-outline-variant bg-white hover:bg-surface-container-lowest"
                            }`}
                          >
                            {handle}
                            <button
                              type="button"
                              onClick={() => choose(employee)}
                              aria-current={isSelected ? "true" : undefined}
                              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-3 pl-1.5 pr-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${isSelected ? "bg-primary text-white" : "bg-primary-fixed text-on-primary-fixed-variant"}`}>
                                {initialsOf(employee.name)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-semibold text-on-surface">{employee.name}</span>
                                <span className="block truncate text-[12px] text-on-surface-variant">
                                  {employee.role} · {employee.city}
                                </span>
                                {employee.owner && <span className="block truncate text-[11px] text-outline">By {employee.owner}</span>}
                              </span>
                              <StatusBadge status={employee.status} />
                            </button>
                          </div>
                        )
                      }}
                    />
                    <LoadMore hasMore={list.hasMore} isLoadingMore={list.isLoadingMore} error={list.moreError} onLoadMore={list.loadMore} doneText="That is the whole team." />
                  </div>
                )}
              </div>

              {/* The chosen employee */}
              <div ref={detailRef} className="flex scroll-mt-4 flex-col gap-4">
                {current ? (
                  <>
                    <section aria-label="Employee details" className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-5">
                      {/* Four actions need the width: below xl they go on their own line under the
                          name, so they never squeeze it (the same rule the tool headers follow) */}
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white">{initialsOf(current.name)}</span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="truncate text-xl font-bold text-on-surface">{current.name}</h2>
                              <StatusBadge status={current.status} />
                            </div>
                            {current.owner && <p className="text-[12px] text-outline">Added by {current.owner}</p>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setDialog({ employee: current })}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant px-3 py-2 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Edit
                          </button>
                          <PlanLinkActions link={planLink} />
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null)
                              setDeleting(current)
                            }}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant px-3 py-2 text-[13px] font-semibold text-outline transition-colors hover:border-error/40 hover:text-error"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Delete
                          </button>
                        </div>
                      </div>
                      <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-outline-variant/70 pt-4 sm:grid-cols-3">
                        {[
                          { icon: Briefcase, label: "Role", value: current.role },
                          { icon: MapPin, label: "City", value: current.city },
                          { icon: CalendarDays, label: "Joined", value: `${joinedOn(current.joiningDate)} (${tenure(current.joiningDate)})` },
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="flex gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                              <Icon size={15} aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <dt className="text-[10px] font-bold uppercase tracking-wider text-outline">{label}</dt>
                              <dd className="break-words text-[13px] text-on-surface">{value}</dd>
                            </div>
                          </div>
                        ))}
                      </dl>
                      <PlanLinkPanel employee={current} link={planLink} />
                    </section>
                    <PlanEditor key={current.id} employee={current} />
                    {/* Neither New link nor Turn off happens until this is confirmed */}
                    <PlanLinkConfirmDialog employee={current} link={planLink} />
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-outline-variant bg-white px-6 py-16 text-center">
                    <CalendarDays size={24} className="text-primary" aria-hidden="true" />
                    <p className="text-[15px] font-semibold text-on-surface">Choose an employee</p>
                    <p className="max-w-sm text-sm text-on-surface-variant">Their details, their daily plan and its history open here.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {dialog && <EmployeeDialog employee={dialog.employee} onClose={() => setDialog(null)} onSaved={saved} />}

      {isConfirmingPicked && (
        <ConfirmBulkDelete
          count={picked.size}
          noun={{ one: "employee", many: "employees" }}
          alsoGoes="Their daily plans and history go with them."
          isDeleting={isDeletingPicked}
          onConfirm={() => void removePicked()}
          onClose={() => setIsConfirmingPicked(false)}
        />
      )}
      {deleting && (
        <Modal
          title={`Delete ${deleting.name}?`}
          description="Their daily plans, their history and their link are deleted with them. This can't be undone."
          onClose={() => setDeleting(null)}
          isCloseDisabled={isDeleting}
          size="compact"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} disabled={isDeleting} className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-high">
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isDeleting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                Delete employee
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
              {deleting.role} in {deleting.city}.
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}
