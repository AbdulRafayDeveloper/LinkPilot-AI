"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Building2, FileText, Globe2, Loader2, MessageSquareText, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { CopyButton } from "@/components/ui/CopyButton"
import { FilterPanel, SearchFilter } from "@/components/history/HistoryFilters"
import { ClientDialog } from "@/components/clients/ClientDialog"
import { ClientProjectsPanel } from "@/components/clients/ClientProjectsPanel"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { CLIENTS_ENDPOINT, CLIENTS_MESSAGES } from "@/constants/clients"
import { SAMPLE_MESSAGE_COUNT } from "@/constants/clientMessaging"
import type { Client } from "@/types/clientMessaging"

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

// Every word typed must appear in the name or the country, in any order and whatever the case
const matches = (client: Client, search: string) => {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = `${client.name} ${client.country}`.toLowerCase()
  return words.every((word) => haystack.includes(word))
}

const filledSamples = (client: Client) => client.sampleMessages.filter((sample) => sample.trim())

/**
 * Clients Management: the clients on the left (searched by name or country), the chosen client on
 * the right with their details, their message format, their sample messages and the projects being
 * done for them. The first client is open when the page loads, so there is always one to look at.
 */
export default function ClientsClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [clients, setClients] = useState<Client[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ client: Client | null } | null>(null)
  const [deleting, setDeleting] = useState<Client | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  // The state all moves in the answer's callbacks, never in the effect body, so one load can't
  // cascade renders; the retry button is what turns the spinner back on
  const load = useCallback((signal: AbortSignal) => {
    requestApi<Client[]>(CLIENTS_ENDPOINT, { signal })
      .then(({ data }) => {
        setClients(data)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (signal.aborted) return
        setError(reason instanceof Error ? reason.message : CLIENTS_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!signal.aborted) setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load, attempt])

  const shown = (clients ?? []).filter((client) => matches(client, search))
  // Nobody chosen yet (a fresh load, or the chosen one was deleted): the first client is open
  const current = clients?.find((client) => client.id === selectedId) ?? shown[0] ?? null
  const hasFilters = search.trim().length > 0

  const choose = (client: Client) => {
    setSelectedId(client.id)
    // On a narrow screen the details sit below the list, so bring them into view
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    }
  }

  const saved = (client: Client) => {
    const isNew = dialog?.client === null
    setDialog(null)
    setSelectedId(client.id)
    setClients((current) => {
      if (!current) return [client]
      return isNew ? [...current, client] : current.map((entry) => (entry.id === client.id ? client : entry))
    })
  }

  const remove = async () => {
    if (!deleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await requestApi(`${CLIENTS_ENDPOINT}/${deleting.id}`, { method: "DELETE" })
      setClients((current) => current?.filter((entry) => entry.id !== deleting.id) ?? current)
      if (selectedId === deleting.id) setSelectedId(null)
      setDeleting(null)
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error ? reason.message : CLIENTS_MESSAGES.deleteFailed)
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
                  <Building2 size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  Clients Management
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Your clients, the format their messages follow, and the projects you are doing for each of them.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialog({ client: null })}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant sm:shrink-0"
              >
                <Plus size={16} aria-hidden="true" />
                Add client
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:items-start">
              {/* The clients */}
              <div className="flex flex-col gap-3">
                <FilterPanel
                  columnsClassName="lg:grid-cols-1"
                  canClear={hasFilters}
                  onClear={() => setSearch("")}
                  summary={clients ? `${shown.length.toLocaleString()} of ${clients.length.toLocaleString()} shown` : "Loading your clients..."}
                >
                  <SearchFilter value={search} onChange={setSearch} placeholder="Name or country" />
                </FilterPanel>

                {error && !clients ? (
                  <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-white py-10 text-center">
                    <AlertTriangle size={20} className="text-error" aria-hidden="true" />
                    <p className="max-w-xs text-sm text-on-surface-variant">{error}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLoading(true)
                        setAttempt((count) => count + 1)
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-container-high"
                    >
                      <RefreshCw size={15} aria-hidden="true" />
                      Try again
                    </button>
                  </div>
                ) : !clients ? (
                  <div role="status" className="flex items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-white py-10 text-sm text-on-surface-variant">
                    <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
                    Loading your clients...
                  </div>
                ) : shown.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-outline-variant bg-white px-6 py-10 text-center">
                    <Building2 size={22} className="text-primary" aria-hidden="true" />
                    <p className="text-sm text-on-surface-variant">{hasFilters ? CLIENTS_MESSAGES.noMatch : CLIENTS_MESSAGES.empty}</p>
                  </div>
                ) : (
                  <ul className={`flex flex-col gap-2 transition-opacity ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading}>
                    {shown.map((client) => {
                      const isSelected = current?.id === client.id
                      return (
                        <li key={client.id}>
                          <button
                            type="button"
                            onClick={() => choose(client)}
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
                              {initialsOf(client.name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-semibold text-on-surface">{client.name}</span>
                              <span className="block truncate text-[12px] text-on-surface-variant">{client.country}</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* The chosen client */}
              <div ref={detailRef} className="flex scroll-mt-4 flex-col gap-4">
                {current ? (
                  <>
                    <section aria-label="Client details" className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-5">
                      {/* The details column is full width below lg but only about 290px between lg and xl,
                          where the name and the buttons cannot share a row; it has the width again from xl */}
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between lg:flex-col xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white">
                            {initialsOf(current.name)}
                          </span>
                          <div className="min-w-0">
                            <h2 className="truncate text-xl font-bold text-on-surface">{current.name}</h2>
                            <p className="flex items-center gap-1.5 text-[13px] text-on-surface-variant">
                              <Globe2 size={13} className="shrink-0" aria-hidden="true" />
                              {current.country}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setDialog({ client: current })}
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

                      <div className="mt-4 flex flex-col gap-4 border-t border-outline-variant/70 pt-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-outline">
                              <FileText size={12} aria-hidden="true" />
                              Message format
                            </h3>
                            <CopyButton text={current.messageFormat} label="Copy message format" showLabel />
                          </div>
                          <p className="whitespace-pre-wrap rounded-xl bg-surface-container-lowest px-3 py-2.5 text-[13px] leading-relaxed text-on-surface [overflow-wrap:anywhere]">
                            {current.messageFormat}
                          </p>
                        </div>

                        {filledSamples(current).map((sample, index) => (
                          <div key={index} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-outline">
                                <MessageSquareText size={12} aria-hidden="true" />
                                Sample message {index + 1}
                              </h3>
                              <CopyButton text={sample} label={`Copy sample message ${index + 1}`} showLabel />
                            </div>
                            <p className="whitespace-pre-wrap rounded-xl bg-surface-container-lowest px-3 py-2.5 text-[13px] leading-relaxed text-on-surface [overflow-wrap:anywhere]">
                              {sample}
                            </p>
                          </div>
                        ))}
                        {filledSamples(current).length < SAMPLE_MESSAGE_COUNT && (
                          <p className="text-[12px] text-outline">
                            Every message written for this client follows {filledSamples(current).length} of the{" "}
                            {SAMPLE_MESSAGE_COUNT} sample messages. Edit them to fill the rest in.
                          </p>
                        )}
                      </div>
                    </section>

                    <ClientProjectsPanel key={current.id} client={current} />
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-outline-variant bg-white px-6 py-16 text-center">
                    <Building2 size={24} className="text-primary" aria-hidden="true" />
                    <p className="text-[15px] font-semibold text-on-surface">{CLIENTS_MESSAGES.choose}</p>
                    <p className="max-w-sm text-sm text-on-surface-variant">{CLIENTS_MESSAGES.chooseHint}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {dialog && <ClientDialog client={dialog.client} onClose={() => setDialog(null)} onSaved={saved} />}

      {deleting && (
        <Modal
          title={`Delete ${deleting.name}?`}
          description={CLIENTS_MESSAGES.deleteExplains}
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
                Delete client
              </button>
            </div>
          }
        >
          {deleteError ? (
            <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[13px] text-error">
              {deleteError}
            </p>
          ) : (
            <p className="text-sm text-on-surface-variant">A client in {deleting.country}.</p>
          )}
        </Modal>
      )}
    </div>
  )
}
