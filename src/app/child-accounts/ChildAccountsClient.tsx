"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Info, KeyRound, Loader2, Plus, RefreshCw, Trash2, UsersRound } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { FeatureSwitchboard } from "@/components/admin/FeatureSwitchboard"
import { timeAgo } from "@/components/admin/AdminParts"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { manageableFeatures } from "@/constants/featureAccess"
import { PASSWORD_MIN_LENGTH } from "@/constants/auth"
import { CHILDREN_ENDPOINT, CHILDREN_MESSAGES, MAX_CHILDREN } from "@/constants/children"
import type { ChildAccount, ChildrenPage } from "@/types/children"

/**
 * Child Accounts: the accounts that share this workspace. The accounts on the left, the chosen one
 * on the right with the tools it may open, laid out the way Clients Management and Projects are.
 *
 * A child reads and writes **this** workspace, so nothing here copies data: the only things on the
 * page are who may sign in, what each of them opens, their password and removing them. The switches
 * are the same `FeatureSwitchboard` the admin panels use, narrowed to the tools this account has
 * itself, so a child can never be offered more than its parent.
 */
export default function ChildAccountsClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [page, setPage] = useState<ChildrenPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Which tools are mid-save for the chosen account, so neither switch is pressed twice
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [changingPassword, setChangingPassword] = useState<ChildAccount | null>(null)
  const [deleting, setDeleting] = useState<ChildAccount | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<ChildrenPage>(CHILDREN_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        setPage(data)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : CHILDREN_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [attempt])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])
  const items = page?.items ?? []
  // The first account is open on every load, so the page is never a list nobody has clicked
  const chosen = items.find((child) => child.id === chosenId) ?? items[0] ?? null

  // Only the tools this account has itself can be offered, in the navigation's own order
  const offered = useMemo(() => {
    const grantable = new Set(page?.grantableTools ?? [])
    return manageableFeatures().filter((tool) => grantable.has(tool.id))
  }, [page?.grantableTools])

  /** Takes one changed account back into the list, so nothing else on the page is reloaded. */
  const replace = (child: ChildAccount) =>
    setPage((current) => (current ? { ...current, items: current.items.map((entry) => (entry.id === child.id ? child : entry)) } : current))

  const setTools = async (child: ChildAccount, tools: string[], on: boolean) => {
    setBusy(new Set(tools))
    setNotice(null)
    try {
      const { data } = await requestApi<ChildAccount>(`${CHILDREN_ENDPOINT}/${child.id}/tools`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools, on }),
      })
      replace(data)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : CHILDREN_MESSAGES.saveFailed)
    } finally {
      setBusy(new Set())
    }
  }

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
                  <UsersRound size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  Child Accounts
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">{CHILDREN_MESSAGES.sharesWorkspace}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={reload}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  disabled={!page || page.remaining === 0}
                  title={page?.remaining === 0 ? CHILDREN_MESSAGES.tooMany : `Up to ${MAX_CHILDREN} child accounts`}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
                >
                  <Plus size={15} aria-hidden="true" />
                  New account
                </button>
              </div>
            </div>

            {notice && (
              <p role="status" className="flex items-start gap-2 rounded-xl bg-primary-fixed/50 px-3 py-2 text-[13px] text-on-surface">
                <Info size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-container px-3 py-2 text-[13px] text-error">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}

            {!page && !error ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading your child accounts...
              </div>
            ) : items.length === 0 ? (
              <p className="py-16 text-center text-sm text-on-surface-variant">{CHILDREN_MESSAGES.noneYet}</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                <ul className="flex flex-col gap-2">
                  {items.map((child) => (
                    <li key={child.id}>
                      <button
                        type="button"
                        onClick={() => setChosenId(child.id)}
                        aria-current={chosen?.id === child.id ? "true" : undefined}
                        className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                          chosen?.id === child.id
                            ? "border-primary bg-primary-fixed/40"
                            : "border-outline-variant bg-white hover:bg-surface-container-lowest"
                        }`}
                      >
                        <p className="truncate text-[14px] font-semibold text-on-surface">{child.name}</p>
                        <p className="truncate text-[12px] text-on-surface-variant">{child.email}</p>
                        <p className="mt-1 text-[11px] text-outline">
                          {child.grantedTools.length === 0
                            ? "No tools yet"
                            : `${child.grantedTools.length} ${child.grantedTools.length === 1 ? "tool" : "tools"}`}
                          {" · "}
                          {child.loginCount > 0 ? `signed in ${timeAgo(child.lastLoginAt)}` : "never signed in"}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>

                {chosen && (
                  <section aria-label={`What ${chosen.name} can use`} className="flex min-w-0 flex-col gap-4">
                    <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-on-surface">{chosen.name}</h2>
                        <p className="truncate text-[13px] text-on-surface-variant">{chosen.email}</p>
                        <p className="mt-1 text-[11px] text-outline">Added {timeAgo(chosen.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setChangingPassword(chosen)}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-3 py-2 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                        >
                          <KeyRound size={14} aria-hidden="true" />
                          Change password
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(chosen)}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-error/40 bg-white px-3 py-2 text-[13px] font-semibold text-error transition-colors hover:bg-error-container"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
                      <h3 className="text-[13px] font-bold text-on-surface">Tools this account can open</h3>
                      <p className="mb-3 mt-1 text-[12px] text-on-surface-variant">
                        Only the tools you have yourself are offered. A tool you lose later goes from this account too.
                      </p>
                      {chosen.withheldTools.length > 0 && (
                        <p className="mb-3 rounded-xl bg-secondary-fixed px-3 py-2 text-[12px] text-on-secondary-fixed-variant">
                          {chosen.withheldTools.length} {chosen.withheldTools.length === 1 ? "tool was" : "tools were"} granted before and you no longer
                          have {chosen.withheldTools.length === 1 ? "it" : "them"}, so this account does not either.
                        </p>
                      )}
                      <FeatureSwitchboard
                        tools={offered}
                        isOff={(toolId) => !chosen.grantedTools.includes(toolId)}
                        busy={busy}
                        onChange={(tools, on) => void setTools(chosen, tools, on)}
                      />
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {adding && (
        <AddChildDialog
          onClose={() => setAdding(false)}
          onAdded={(child, message) => {
            setAdding(false)
            setChosenId(child.id)
            setNotice(message)
            reload()
          }}
        />
      )}

      {changingPassword && (
        <ChildPasswordDialog
          child={changingPassword}
          onClose={() => setChangingPassword(null)}
          onChanged={(message) => {
            setChangingPassword(null)
            setNotice(message)
          }}
        />
      )}

      {deleting && (
        <DeleteChildDialog
          child={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(message) => {
            setDeleting(null)
            setChosenId(null)
            setNotice(message)
            reload()
          }}
        />
      )}
    </div>
  )
}

const fieldClass =
  "h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
const labelClass = "text-[12px] font-semibold text-on-surface"

/** The one submit button every dialog here uses, so they read and behave the same. */
const SaveButton: React.FC<{ isSaving: boolean; label: string; tone?: "primary" | "error"; disabled?: boolean }> = ({
  isSaving,
  label,
  tone = "primary",
  disabled = false,
}) => (
  <button
    type="submit"
    disabled={isSaving || disabled}
    className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
      tone === "error" ? "bg-error hover:bg-error/90" : "bg-primary hover:bg-on-primary-fixed-variant"
    }`}
  >
    {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
    {label}
  </button>
)

const AddChildDialog: React.FC<{ onClose: () => void; onAdded: (child: ChildAccount, message: string) => void }> = ({ onClose, onAdded }) => {
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [isSaving, setIsSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setProblem(null)
    try {
      const { data, message } = await requestApi<ChildAccount>(
        CHILDREN_ENDPOINT,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) },
        { idempotent: true }
      )
      onAdded(data, message ?? CHILDREN_MESSAGES.created)
    } catch (reason: unknown) {
      setProblem(reason instanceof Error ? reason.message : CHILDREN_MESSAGES.createFailed)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title="New child account" description="They sign in with this email and password, and work in your workspace." onClose={onClose} size="compact">
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={fieldClass} autoComplete="off" required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className={fieldClass}
            autoComplete="off"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            minLength={PASSWORD_MIN_LENGTH}
            className={fieldClass}
            autoComplete="new-password"
            required
          />
          <span className="text-[11px] text-outline">At least {PASSWORD_MIN_LENGTH} characters. Tell it to them yourself; it is never shown again.</span>
        </label>
        <p className="rounded-xl bg-primary-fixed/50 px-3 py-2 text-[12px] text-on-surface">
          It starts with no tools at all. Give it the ones it needs once it is created.
        </p>
        {problem && (
          <p role="alert" className="text-[12px] font-semibold text-error">
            {problem}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container">
            Cancel
          </button>
          <SaveButton isSaving={isSaving} label="Create account" />
        </div>
      </form>
    </Modal>
  )
}

const ChildPasswordDialog: React.FC<{ child: ChildAccount; onClose: () => void; onChanged: (message: string) => void }> = ({
  child,
  onClose,
  onChanged,
}) => {
  const [password, setPassword] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setProblem(null)
    try {
      const { message } = await requestApi<{ id: string }>(`${CHILDREN_ENDPOINT}/${child.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      onChanged(message ?? CHILDREN_MESSAGES.passwordChanged)
    } catch (reason: unknown) {
      setProblem(reason instanceof Error ? reason.message : CHILDREN_MESSAGES.passwordFailed)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title={`New password for ${child.name}`} description="It signs that account out everywhere. Yours is not affected." onClose={onClose} size="compact">
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>New password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={PASSWORD_MIN_LENGTH}
            className={fieldClass}
            autoComplete="new-password"
            required
          />
          <span className="text-[11px] text-outline">At least {PASSWORD_MIN_LENGTH} characters.</span>
        </label>
        {problem && (
          <p role="alert" className="text-[12px] font-semibold text-error">
            {problem}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container">
            Cancel
          </button>
          <SaveButton isSaving={isSaving} label="Change password" />
        </div>
      </form>
    </Modal>
  )
}

const DeleteChildDialog: React.FC<{ child: ChildAccount; onClose: () => void; onDeleted: (message: string) => void }> = ({
  child,
  onClose,
  onDeleted,
}) => {
  const [isSaving, setIsSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setProblem(null)
    try {
      const { message } = await requestApi<{ id: string }>(`${CHILDREN_ENDPOINT}/${child.id}`, { method: "DELETE" })
      onDeleted(message ?? CHILDREN_MESSAGES.deleted)
    } catch (reason: unknown) {
      setProblem(reason instanceof Error ? reason.message : CHILDREN_MESSAGES.deleteFailed)
      setIsSaving(false)
    }
  }

  return (
    <Modal title={`Delete ${child.name}?`} description={child.email} onClose={onClose} size="compact">
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
        <p className="text-[13px] text-on-surface-variant">{CHILDREN_MESSAGES.deleteExplains}</p>
        {problem && (
          <p role="alert" className="text-[12px] font-semibold text-error">
            {problem}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container">
            Cancel
          </button>
          <SaveButton isSaving={isSaving} label="Delete account" tone="error" />
        </div>
      </form>
    </Modal>
  )
}
