"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { FilePenLine, Send, Users } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { ResetButton } from "@/components/ui/ResetButton"
import { RadioCardGroup } from "@/components/ui/RadioCardGroup"
import { VoiceRecorder } from "@/components/ui/VoiceRecorder"
import { appendSpokenText } from "@/lib/spokenText"
import { VOICE_MESSAGES } from "@/constants/voiceInput"
import { ClientMessageResult } from "@/components/client-messaging/ClientMessageResult"
import { ClientMessagePromptModal } from "@/components/client-messaging/ClientMessagePromptModal"
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
import { CLIENTS_TOOL } from "@/constants/clients"
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
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const [clients, setClients] = useState<Client[] | null>(null)
  const [clientsError, setClientsError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)
  const { clientId, update, channel } = useToolStore(formStore)
  const updateInputRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, error, generate, reset } = useGenerationRequest(generation)
  const isGenerating = status === "loading"
  const canReset = update !== "" || status !== "idle"

  // The clients themselves are managed in Clients Management; this page only reads them to write to one
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

  // What was spoken is added to whatever is already there, so several takes build one update;
  // past the limit the beginning is kept and the page says how much was left out
  const addTranscript = useCallback((text: string) => {
    const { text: update, skipped } = appendSpokenText(formStore.getSnapshot().update, text, UPDATE_MAX_LENGTH)
    formStore.update({ update })
    setVoiceNotice(skipped > 0 ? VOICE_MESSAGES.clipped(skipped, UPDATE_MAX_LENGTH) : null)
    setFormError(null)
  }, [])

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

  // Clears what you wanted to say and the message; the client and channel stay for the next one
  const resetTool = () => {
    formStore.update({ update: "" })
    setFormError(null)
    setVoiceError(null)
    setVoiceNotice(null)
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
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 xl:h-full short:py-4 short:gap-3">
            {/* Page header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <Users size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Client Tasks Messaging
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Write a formal message in your client&apos;s own format, ready to paste into the channel you send it on.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 xl:shrink-0">
                <ResetButton onReset={resetTool} disabled={!canReset} />
                <button
                  type="button"
                  onClick={() => setIsPromptOpen(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
                >
                  <FilePenLine size={16} aria-hidden="true" />
                  Update Prompt
                </button>
              </div>
            </div>

            {/* Side by side from xl, where the form still has room for its channel cards; stacked below. The row
                fills the screen but never shrinks under the form, so a short laptop screen scrolls instead of overlapping */}
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 xl:flex-1 short:gap-4">
              <section className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-4 short:p-4 short:gap-3">
                {/* Who the message is for, and on a short laptop window the channel beside it */}
                <div className="flex flex-col gap-4 short:grid short:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] short:items-start short:gap-3">
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
                  {selectedClient && (
                    <p className="text-[11px] text-outline">
                      Their format and {selectedClient.sampleMessages.filter((sample) => sample.trim()).length} sample messages are
                      used for every message written here.
                    </p>
                  )}
                  {/* Clients are added and edited in their own module, so this page only ever chooses one */}
                  {clients !== null && !hasClients && !clientsError && (
                    <p className="text-[11px] text-outline">
                      <Link href={CLIENTS_TOOL.href} className="font-semibold text-primary underline underline-offset-2 hover:text-on-primary-fixed-variant">
                        Add your first client
                      </Link>{" "}
                      in {CLIENTS_TOOL.title}, with their message format and two sample messages.
                    </p>
                  )}
                </div>

                {/* A short laptop window has no room for seven channel cards, so the same choice is a list here */}
                <div className="hidden flex-col gap-1.5 short:flex">
                  <label htmlFor="channel-select" className="text-[10px] font-bold text-outline uppercase tracking-wider">
                    Send it on
                  </label>
                  <select
                    id="channel-select"
                    value={channel ?? ""}
                    onChange={(event) => {
                      formStore.update({ channel: event.target.value as MessageChannelId })
                      if (formError === CLIENT_MESSAGING_MESSAGES.missingChannel) setFormError(null)
                    }}
                    disabled={isGenerating}
                    aria-invalid={formError === CLIENT_MESSAGING_MESSAGES.missingChannel}
                    className={`w-full rounded-xl border bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 ${
                      formError === CLIENT_MESSAGING_MESSAGES.missingChannel ? "border-error" : "border-outline-variant focus:border-primary/50"
                    }`}
                  >
                    {!channel && <option value="">Choose a channel</option>}
                    {MESSAGE_CHANNELS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} · {option.description}
                      </option>
                    ))}
                  </select>
                </div>
                </div>

                {/* What to tell them */}
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="client-update" className="text-[10px] font-bold text-outline uppercase tracking-wider">
                      What do you want to tell them
                    </label>
                    <VoiceRecorder
                      transcribeFor="client-messaging"
                      onTranscript={addTranscript}
                      onError={setVoiceError}
                      disabled={isGenerating}
                      what="what you want to tell them"
                    />
                  </div>
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
                    placeholder="Type it, or press Speak instead. Example: the payments page is done and on staging, the reports screen slipped to Friday because the API was late, and I need their logo files."
                    className={`w-full flex-1 min-h-[160px] short:min-h-[96px] resize-none rounded-xl border bg-surface-container-lowest px-4 py-3 text-sm leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 ${
                      updateInvalid ? "border-error" : "border-outline-variant focus:border-primary/50"
                    }`}
                  />
                  <p className="text-[11px] text-outline">
                    {update.length.toLocaleString()} / {UPDATE_MAX_LENGTH.toLocaleString()} characters
                  </p>
                  {voiceError && (
                    <p role="alert" className="rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[12px] text-error">
                      {voiceError}
                    </p>
                  )}
                  {voiceNotice && (
                    <p role="status" className="rounded-xl bg-secondary-container px-3 py-2 text-[12px] text-on-secondary-container">
                      {voiceNotice}
                    </p>
                  )}
                </div>

                {/* The channel cards, on every screen but a short laptop window (the list above takes their place there) */}
                <div className="short:hidden">
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
                  // Two across in the narrower side-by-side form (xl), three wherever the form has the width for their descriptions
                  columnsClassName="grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3"
                />
                </div>

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

      {isPromptOpen && <ClientMessagePromptModal onClose={() => setIsPromptOpen(false)} />}
    </div>
  )
}
