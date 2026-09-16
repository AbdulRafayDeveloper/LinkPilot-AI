"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { FilePenLine, Send, UserPlus, Users } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { ResetButton } from "@/components/ui/ResetButton"
import { RadioCardGroup } from "@/components/ui/RadioCardGroup"
import { ClientMessageResult } from "@/components/client-messaging/ClientMessageResult"
import { ClientMessagePromptModal } from "@/components/client-messaging/ClientMessagePromptModal"
import { ClientsModal } from "@/components/client-messaging/ClientsModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { createGenerationRequest, useGenerationRequest } from "@/hooks/useGenerationRequest"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import { requestApi } from "@/lib/apiClient"
import {
  CLIENT_MESSAGING_ENDPOINT,
  CLIENT_MESSAGING_MESSAGES,
  DEFAULT_MESSAGE_CHANNEL,
  MESSAGE_CHANNELS,
  UPDATE_MAX_LENGTH,
  type MessageChannelId,
} from "@/constants/clientMessaging"
import type { Client, GeneratedClientMessage } from "@/types/clientMessaging"

interface GeneratePayload {
  clientId: string
  update: string
  channel: MessageChannelId
}

// The chosen client, what you want to say and the channel all outlive the page
const formStore = createToolStore(
  "client-messaging:form",
  { clientId: "", update: "", channel: DEFAULT_MESSAGE_CHANNEL as MessageChannelId | null },
  { version: 1 }
)
const generation = createGenerationRequest<GeneratePayload, GeneratedClientMessage>(
  "client-messaging",
  `${CLIENT_MESSAGING_ENDPOINT}/generate`,
  CLIENT_MESSAGING_MESSAGES.generationFailed
)

export default function ClientMessagingClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isClientsOpen, setIsClientsOpen] = useState(false)
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const [clients, setClients] = useState<Client[] | null>(null)
  const [clientsError, setClientsError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const { clientId, update, channel } = useToolStore(formStore)
  const updateInputRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, error, generate, reset } = useGenerationRequest(generation)
  const isGenerating = status === "loading"
  const canReset = update !== "" || status !== "idle"

  // The client list is shared, so it is read on arrival and after the popup changes it
  const loadClients = useCallback((signal?: AbortSignal) => {
    return requestApi<Client[]>(`${CLIENT_MESSAGING_ENDPOINT}/clients`, { signal })
      .then(({ data }) => {
        setClients(data)
        setClientsError(null)
      })
      .catch((requestError: unknown) => {
        if (signal?.aborted) return
        setClients([])
        setClientsError(requestError instanceof Error ? requestError.message : CLIENT_MESSAGING_MESSAGES.loadFailed)
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadClients(controller.signal)
    return () => controller.abort()
  }, [loadClients])

  const selectedClient = clients?.find((client) => client.id === clientId) ?? null

  const submit = () => {
    if (isGenerating) return
    if (!clientId || !selectedClient) {
      setFormError(clients && clients.length === 0 ? CLIENT_MESSAGING_MESSAGES.noClients : CLIENT_MESSAGING_MESSAGES.missingClient)
      return
    }
    if (!update.trim()) {
      setFormError(CLIENT_MESSAGING_MESSAGES.missingUpdate)
      updateInputRef.current?.focus()
      return
    }
    if (!channel) {
      setFormError(CLIENT_MESSAGING_MESSAGES.missingChannel)
      return
    }
    setFormError(null)
    generate({ clientId, update, channel })
  }

  // A client chosen in the popup replaces the message written for the previous one
  const selectClient = (client: Client) => {
    formStore.update({ clientId: client.id })
    reset()
    setFormError(null)
  }

  // Clears what you wanted to say and the message; the client and channel stay for the next one
  const resetTool = () => {
    formStore.update({ update: "" })
    setFormError(null)
    reset()
    updateInputRef.current?.focus()
  }

  const hasClients = (clients?.length ?? 0) > 0
  const updateInvalid = formError === CLIENT_MESSAGING_MESSAGES.missingUpdate
  const clientInvalid = formError === CLIENT_MESSAGING_MESSAGES.missingClient || formError === CLIENT_MESSAGING_MESSAGES.noClients

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto bg-background overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 lg:h-full">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <Users size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Client Messaging
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Write a formal message in your client&apos;s own format, ready to paste into the channel you send it on.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <ResetButton onReset={resetTool} disabled={!canReset} />
                <button
                  type="button"
                  onClick={() => setIsClientsOpen(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
                >
                  <UserPlus size={16} aria-hidden="true" />
                  Clients
                </button>
                <button
                  type="button"
                  onClick={() => setIsPromptOpen(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
                >
                  <FilePenLine size={16} aria-hidden="true" />
                  Update Prompt
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 lg:flex-1 lg:min-h-0">
              <section className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-4 min-h-0">
                {/* Who the message is for */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <label htmlFor="client-select" className="text-[10px] font-bold text-outline uppercase tracking-wider">
                    Client
                  </label>
                  <select
                    id="client-select"
                    value={clientId}
                    onChange={(event) => {
                      formStore.update({ clientId: event.target.value })
                      if (clientInvalid) setFormError(null)
                    }}
                    disabled={isGenerating || !hasClients}
                    aria-invalid={clientInvalid}
                    className={`w-full rounded-xl border bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 ${
                      clientInvalid ? "border-error" : "border-outline-variant focus:border-primary/50"
                    }`}
                  >
                    <option value="">{hasClients ? "Choose a client" : "No clients yet"}</option>
                    {clients?.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} · {client.country}
                      </option>
                    ))}
                  </select>
                  {clientsError && (
                    <p role="alert" className="text-[12px] text-error">
                      {clientsError}
                    </p>
                  )}
                  {clients !== null && !hasClients && !clientsError && (
                    <p className="text-[12px] text-on-surface-variant">
                      {CLIENT_MESSAGING_MESSAGES.noClients}{" "}
                      <button type="button" onClick={() => setIsClientsOpen(true)} className="font-semibold text-primary hover:underline">
                        Add your first client
                      </button>
                    </p>
                  )}
                  {selectedClient && (
                    <p className="text-[11px] text-outline">
                      Their format and {selectedClient.sampleMessages.filter((sample) => sample.trim()).length} sample messages are
                      used for every message written here.
                    </p>
                  )}
                </div>

                {/* What to tell them */}
                <div className="flex flex-col gap-2 min-h-0 flex-1">
                  <label htmlFor="client-update" className="text-[10px] font-bold text-outline uppercase tracking-wider">
                    What do you want to tell them
                  </label>
                  <textarea
                    id="client-update"
                    ref={updateInputRef}
                    value={update}
                    onChange={(event) => {
                      formStore.update({ update: event.target.value })
                      if (updateInvalid) setFormError(null)
                    }}
                    maxLength={UPDATE_MAX_LENGTH}
                    disabled={isGenerating}
                    aria-invalid={updateInvalid}
                    placeholder="In your own words. Example: the payments page is done and on staging, the reports screen slipped to Friday because the API was late, and I need their logo files."
                    className={`w-full flex-1 min-h-[160px] resize-none rounded-xl border bg-surface-container-lowest px-4 py-3 text-sm leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 ${
                      updateInvalid ? "border-error" : "border-outline-variant focus:border-primary/50"
                    }`}
                  />
                  <p className="text-[11px] text-outline">
                    {update.length.toLocaleString()} / {UPDATE_MAX_LENGTH.toLocaleString()} characters
                  </p>
                </div>

                <RadioCardGroup
                  name="message-channel"
                  legend="Send it on"
                  options={MESSAGE_CHANNELS}
                  value={channel}
                  onChange={(nextChannel) => {
                    formStore.update({ channel: nextChannel })
                    if (formError === CLIENT_MESSAGING_MESSAGES.missingChannel) setFormError(null)
                  }}
                  disabled={isGenerating}
                  invalid={formError === CLIENT_MESSAGING_MESSAGES.missingChannel}
                  columnsClassName="grid-cols-2 sm:grid-cols-3"
                />

                {formError && (
                  <p role="alert" className="text-[12px] text-error">
                    {formError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={submit}
                  disabled={isGenerating}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send size={16} aria-hidden="true" />
                  {isGenerating ? "Writing the message..." : "Write Message"}
                </button>
              </section>

              <ClientMessageResult status={status} result={result} error={error} onRetry={submit} />
            </div>
          </div>
        </main>
      </div>

      {isClientsOpen && (
        <ClientsModal
          onUse={selectClient}
          onChanged={(saved) => {
            setClients(saved)
            setClientsError(null)
          }}
          onClose={() => {
            setIsClientsOpen(false)
            void loadClients()
          }}
        />
      )}
      {isPromptOpen && <ClientMessagePromptModal onClose={() => setIsPromptOpen(false)} />}
    </div>
  )
}
