"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CalendarPlus, CheckCircle2, Loader2, Lock, RefreshCw, ShieldCheck, SlidersHorizontal, Trash2, UserCheck, Users, UsersRound, X } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { FeatureAccessPanel } from "@/components/admin/FeatureAccessPanel"
import { FilterPanel, SearchFilter, SelectFilter, historyLabelClass } from "@/components/history/HistoryFilters"
import { LoadMore } from "@/components/history/LoadMore"
import { DeviceLine, EventBadge, StatCard, dateTime, timeAgo } from "@/components/admin/AdminParts"
import { DeleteAccountDialog } from "@/components/admin/DeleteAccountDialog"
import { FeatureDefaultsDialog } from "@/components/admin/FeatureDefaultsDialog"
import { FEATURE_DEFAULTS_ENDPOINT, manageableFeatures } from "@/constants/featureAccess"
import type { FeatureDefaults } from "@/types/featureAccess"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useCursorList } from "@/hooks/useCursorList"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { requestApi } from "@/lib/apiClient"
import { HISTORY_DEBOUNCE_MS } from "@/constants/historyFilters"
import { ACTIVE_DAYS, ADMIN_ENDPOINTS, ADMIN_MESSAGES, AUDIT_HREF } from "@/constants/admin"
import { ROLE_LABELS, USER_ROLES } from "@/constants/auth"
import type { AccountDeletion, AdminUser, UserActivity, UsersPage } from "@/types/admin"

const idOf = (user: AdminUser) => user.id
const ROLE_OPTIONS = USER_ROLES.map((role) => ({ id: role, label: ROLE_LABELS[role] }))

const RoleBadge: React.FC<{ user: AdminUser }> = ({ user }) => (
  <span className="inline-flex items-center gap-1">
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        user.role === "admin" ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"
      }`}
    >
      {user.role === "admin" && <ShieldCheck size={11} aria-hidden="true" />}
      {ROLE_LABELS[user.role]}
    </span>
    {user.isLocked && (
      <span className="inline-flex items-center gap-1 rounded-full bg-error-container px-2 py-0.5 text-[11px] font-semibold text-error">
        <Lock size={11} aria-hidden="true" />
        Locked
      </span>
    )}
  </span>
)

/** One account in detail: counts, the tools it used with when, and its latest sign-ins. */
const UserDetail: React.FC<{ user: AdminUser; canDelete: boolean; onDelete: () => void; onClose: () => void }> = ({ user, canDelete, onDelete, onClose }) => {
  const [activity, setActivity] = useState<UserActivity | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<UserActivity>(`${ADMIN_ENDPOINTS.users}/${user.id}`, { signal: controller.signal })
      .then(({ data }) => setActivity(data))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : ADMIN_MESSAGES.usersLoadFailed)
      })
    return () => controller.abort()
  }, [user.id])

  const used = activity?.tools.filter((tool) => tool.count > 0) ?? []
  const unused = activity?.tools.filter((tool) => tool.count === 0) ?? []

  return (
    <Modal
      title={user.name}
      description={user.email}
      onClose={onClose}
      size="large"
      footer={
        canDelete ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-2 rounded-xl border border-error/40 px-4 py-2 text-sm font-semibold text-error transition-colors hover:bg-error/5"
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete account
            </button>
          </div>
        ) : undefined
      }
    >
      {error ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-sm text-error">
          {error}
        </p>
      ) : !activity ? (
        <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-on-surface-variant">
          <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
          Loading their activity...
        </div>
      ) : (
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge user={activity.user} />
            <span className="text-[12px] text-outline">Joined {dateTime(activity.user.createdAt)}</span>
          </div>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Sign-ins", value: activity.user.loginCount.toLocaleString() },
              { label: "Wrong passwords", value: activity.user.failedLoginCount.toLocaleString() },
              { label: "Records created", value: activity.user.recordCount.toLocaleString() },
              { label: "Last active", value: timeAgo(activity.user.lastActivityAt ?? activity.user.lastLoginAt) },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
                <dt className={historyLabelClass}>{item.label}</dt>
                <dd className="mt-0.5 text-lg font-bold text-on-surface">{item.value}</dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="tools-used" className="flex flex-col gap-2">
            <h3 id="tools-used" className="text-[14px] font-bold text-on-surface">
              Tools used
            </h3>
            {used.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Nothing created in any tool yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-outline-variant">
                <table className="w-full min-w-[520px] border-collapse text-left">
                  <thead className="bg-surface-container-lowest">
                    <tr className="border-b border-outline-variant">
                      {["Tool", "Records", "Share", "Last used"].map((heading) => (
                        <th key={heading} scope="col" className={`px-3 py-2 ${historyLabelClass}`}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {used.map((tool) => (
                      <tr key={tool.title} className="border-b border-outline-variant/60 last:border-b-0">
                        <td className="px-3 py-2 text-[13px] font-semibold text-on-surface">{tool.title}</td>
                        <td className="px-3 py-2 text-[13px] text-on-surface">{tool.count.toLocaleString()}</td>
                        <td className="w-[30%] px-3 py-2">
                          <div className="h-2 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, Math.round((tool.count / activity.user.recordCount) * 100))}%` }} />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-[12px] text-on-surface-variant" title={tool.lastUsedAt ? dateTime(tool.lastUsedAt) : undefined}>
                          {timeAgo(tool.lastUsedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {unused.length > 0 && <p className="text-[12px] text-outline">Not used yet: {unused.map((tool) => tool.title).join(", ")}.</p>}
          </section>

          {/* What this account is allowed to open at all, which is a different question from what it has used */}
          <FeatureAccessPanel userId={activity.user.id} isAdminAccount={activity.user.role === "admin"} />

          <section aria-labelledby="recent-logins" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="recent-logins" className="text-[14px] font-bold text-on-surface">
                Latest sign-in activity
              </h3>
              <Link href={`${AUDIT_HREF}?user=${activity.user.id}`} className="text-[12px] font-semibold text-primary hover:underline">
                See all in Audit Management
              </Link>
            </div>
            {activity.recentLogins.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No sign-in activity recorded yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant/60 rounded-xl border border-outline-variant">
                {activity.recentLogins.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <EventBadge event={entry.event} />
                    <DeviceLine device={entry} />
                    <span className="ml-auto whitespace-nowrap text-[12px] text-on-surface-variant">{dateTime(entry.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}

/**
 * User Management: how many accounts there are, and for each one its sign-ins, the device it last
 * used, how much it has made and when it was last active. Opening an account shows the tools it
 * used and its latest sign-ins.
 */
export default function UsersClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("")
  const [open, setOpen] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState<AdminUser | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { user: me } = useCurrentUser()
  const settledSearch = useDebouncedValue(search.trim(), HISTORY_DEBOUNCE_MS)

  const params = new URLSearchParams()
  if (search.trim() && settledSearch) params.set("search", settledSearch)
  if (role) params.set("role", role)

  const list = useCursorList<AdminUser, UsersPage>({
    endpoint: ADMIN_ENDPOINTS.users,
    query: params.toString(),
    enabled: true,
    loadFailed: ADMIN_MESSAGES.usersLoadFailed,
    idOf,
  })
  const summary = list.latest?.summary ?? null
  const hasFilters = Boolean(search || role)

  // The tools for every user, shown beside the button that changes them
  const [isDefaultsOpen, setIsDefaultsOpen] = useState(false)
  const [defaults, setDefaults] = useState<FeatureDefaults | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    requestApi<FeatureDefaults>(FEATURE_DEFAULTS_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => setDefaults(data))
      // Only a summary line: without it the page is still whole, and the dialog says why it failed
      .catch(() => undefined)
    return () => controller.abort()
  }, [])
  const toolCount = manageableFeatures().length

  // An admin never deletes their own account, nor the last admin; the server refuses both as well
  const canDelete = (user: AdminUser) => Boolean(me) && user.id !== me?.id && !(user.role === "admin" && (summary?.admins ?? 0) <= 1)

  const handleDeleted = (deletion: AccountDeletion) => {
    const deletedId = deleting?.id
    setDeleting(null)
    setOpen(null)
    list.update((items) => items.filter((item) => item.id !== deletedId), -1)
    setNotice(
      `${deletion.name}'s account (${deletion.email}) was deleted` +
        (deletion.records > 0 ? `, with ${deletion.records.toLocaleString()} ${deletion.records === 1 ? "record" : "records"}` : "") +
        (deletion.files > 0 ? ` and ${deletion.files.toLocaleString()} stored ${deletion.files === 1 ? "file" : "files"}` : "") +
        "."
    )
    // The totals at the top follow
    list.retry()
  }

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                  <UsersRound size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  User Management
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Every account, its sign-ins and what it has been doing. Open one for the tools it used, and to give it its own tools.
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-1 sm:shrink-0 sm:items-end">
                <button
                  type="button"
                  onClick={() => setIsDefaultsOpen(true)}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant"
                >
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  Tools for all users
                </button>
                {defaults && (
                  <span className="text-center text-[12px] text-on-surface-variant sm:text-right">
                    {defaults.disabledTools.length === 0
                      ? `All ${toolCount} tools on for every user`
                      : `${toolCount - defaults.disabledTools.length} of ${toolCount} tools on for every user`}
                  </span>
                )}
              </div>
            </div>

            {notice && (
              <p role="status" className="flex items-start gap-2 rounded-xl bg-success-container px-3 py-2 text-[13px] text-on-success-container">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="flex-1">{notice}</span>
                <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="shrink-0 rounded p-0.5 hover:bg-black/5">
                  <X size={14} aria-hidden="true" />
                </button>
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Users} label="Total accounts" value={summary?.totalUsers ?? null} hint={summary ? `${summary.admins} admin, ${summary.users} user` : undefined} />
              <StatCard icon={ShieldCheck} label="Admins" value={summary?.admins ?? null} />
              <StatCard icon={UserCheck} label={`Signed in, last ${ACTIVE_DAYS} days`} value={summary?.active7d ?? null} tone="success" />
              <StatCard icon={CalendarPlus} label="New, last 30 days" value={summary?.new30d ?? null} />
            </div>

            <FilterPanel
              columnsClassName="lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
              canClear={hasFilters}
              onClear={() => {
                setSearch("")
                setRole("")
              }}
              summary={list.hasAnswer ? `Showing ${list.items.length.toLocaleString()} of ${list.total.toLocaleString()} ${list.total === 1 ? "account" : "accounts"}` : "Loading accounts..."}
            >
              <SearchFilter value={search} onChange={setSearch} placeholder="Name or email" />
              <SelectFilter label="Role" allLabel="Admins and users" value={role} options={ROLE_OPTIONS} onChange={setRole} />
            </FilterPanel>

            {list.error && !list.hasAnswer ? (
              <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
                <AlertTriangle size={20} className="text-error" aria-hidden="true" />
                <p className="max-w-sm text-sm text-on-surface-variant">{list.error}</p>
                <button type="button" onClick={list.retry} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold">
                  <RefreshCw size={15} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : !list.hasAnswer ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading accounts...
              </div>
            ) : list.items.length === 0 ? (
              <p className="py-16 text-center text-sm text-on-surface-variant">No accounts match these filters.</p>
            ) : (
              <div className={`flex flex-col gap-3 transition-opacity ${list.isLoading ? "opacity-60" : ""}`} aria-busy={list.isLoading}>
                {/* The table from xl, where it fits beside the open sidebar; cards below, two to a row on a tablet */}
                <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-white shadow-sm xl:block">
                  <table className="w-full min-w-[900px] border-collapse text-left">
                    <caption className="sr-only">Accounts, newest first</caption>
                    <thead className="bg-surface-container-lowest">
                      <tr className="border-b border-outline-variant">
                        {["Account", "Role", "Sign-ins", "Last sign-in", "Records", "Last active", ""].map((heading, index) => (
                          <th key={heading || index} scope="col" className={`px-3 py-2.5 ${historyLabelClass}`}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((user) => (
                        <tr key={user.id} className="border-b border-outline-variant/60 last:border-b-0 hover:bg-surface-container-lowest">
                          <td className="max-w-[260px] px-3 py-2.5">
                            <p className="truncate text-[13px] font-semibold text-on-surface">{user.name}</p>
                            <p className="truncate text-[12px] text-on-surface-variant">{user.email}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <RoleBadge user={user} />
                          </td>
                          <td className="px-3 py-2.5 text-[13px] text-on-surface">
                            {user.loginCount.toLocaleString()}
                            {user.failedLoginCount > 0 && <span className="block text-[11px] text-outline">{user.failedLoginCount} wrong password{user.failedLoginCount === 1 ? "" : "s"}</span>}
                          </td>
                          <td className="max-w-[220px] px-3 py-2.5">
                            <p className="text-[12px] text-on-surface" title={user.lastLoginAt ? dateTime(user.lastLoginAt) : undefined}>
                              {timeAgo(user.lastLoginAt)}
                            </p>
                            <DeviceLine device={user.lastDevice} />
                          </td>
                          <td className="px-3 py-2.5 text-[13px] text-on-surface">{user.recordCount.toLocaleString()}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-on-surface-variant">{timeAgo(user.lastActivityAt)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setOpen(user)}
                                className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                              >
                                View activity
                              </button>
                              {canDelete(user) && (
                                <button
                                  type="button"
                                  onClick={() => setDeleting(user)}
                                  aria-label={`Delete ${user.name}'s account`}
                                  title="Delete account"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition-colors hover:border-error/40 hover:bg-error-container hover:text-error"
                                >
                                  <Trash2 size={15} aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden">
                  {list.items.map((user) => (
                    <li key={user.id}>
                      <button type="button" onClick={() => setOpen(user)} className="flex w-full flex-col gap-1.5 rounded-2xl border border-outline-variant bg-white p-3 text-left shadow-sm">
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold text-on-surface">{user.name}</span>
                            <span className="block truncate text-[12px] text-on-surface-variant">{user.email}</span>
                          </span>
                          <RoleBadge user={user} />
                        </span>
                        <DeviceLine device={user.lastDevice} />
                        <span className="text-[11px] text-outline">
                          {user.loginCount} sign-ins · {user.recordCount} records · active {timeAgo(user.lastActivityAt ?? user.lastLoginAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                <LoadMore hasMore={list.hasMore} isLoadingMore={list.isLoadingMore} error={list.moreError} onLoadMore={list.loadMore} doneText="That is every account." />
              </div>
            )}
          </div>
        </main>
      </div>

      {open && !deleting && <UserDetail user={open} canDelete={canDelete(open)} onDelete={() => setDeleting(open)} onClose={() => setOpen(null)} />}
      {deleting && <DeleteAccountDialog user={deleting} onClose={() => setDeleting(null)} onDeleted={handleDeleted} />}
      {isDefaultsOpen && <FeatureDefaultsDialog onClose={() => setIsDefaultsOpen(false)} onChanged={setDefaults} />}
    </div>
  )
}
