"use client"

import React, { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, CircleSlash, ListOrdered, Loader2, RefreshCw, RotateCcw } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { SortableList } from "@/components/ui/SortableList"
import { dateTime } from "@/components/admin/AdminParts"
import { AiUsagePanel } from "@/components/admin/AiUsagePanel"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { AI_PROVIDER_LABELS, type AiProviderId } from "@/constants/aiProviders"
import { AI_NEED_LABELS, MODEL_PRIORITY_ENDPOINT, MODEL_PRIORITY_MESSAGES } from "@/constants/modelPriority"
import type { ModelPriorityModule, ModelPriorityOverview, ModelProviderStatus } from "@/types/modelPriority"

/** Why a provider will be passed over in this module on this deployment, or null when it can take part. */
function skipReason(provider: ModelProviderStatus | undefined, module: ModelPriorityModule): string | null {
  if (!provider?.configured) return "Not configured, skipped"
  const missing = module.needs.filter((need) => !provider.can[need])
  return missing.length > 0 ? `Skipped for ${missing.map((need) => AI_NEED_LABELS[need]).join(" and ")}` : null
}

const ModuleCard: React.FC<{
  module: ModelPriorityModule
  providers: ModelProviderStatus[]
  isSaving: boolean
  onReorder: (order: AiProviderId[]) => void
  onReset: () => void
}> = ({ module, providers, isSaving, onReorder, onReset }) => (
  <section aria-labelledby={`module-${module.id}`} className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 id={`module-${module.id}`} className="text-[15px] font-bold text-on-surface">
          {module.title}
        </h2>
        <p className="mt-0.5 text-[12px] text-on-surface-variant">
          {module.needs.length > 0 ? `Writes text and uses ${module.needs.map((need) => AI_NEED_LABELS[need]).join(" and ")}` : "Writes text"}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {isSaving && <Loader2 size={14} className="animate-spin text-primary" aria-label="Saving" />}
        {module.isDefault ? (
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">Default</span>
        ) : (
          <>
            <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[11px] font-semibold text-primary">Custom</span>
            <button
              type="button"
              onClick={onReset}
              disabled={isSaving}
              aria-label={`Put ${module.title} back on the default order`}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary disabled:opacity-50"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Default
            </button>
          </>
        )}
      </div>
    </div>

    <SortableList
      items={module.order}
      getId={(id) => id}
      getLabel={(id) => AI_PROVIDER_LABELS[id]}
      label={`Provider order for ${module.title}`}
      disabled={isSaving}
      onReorder={(ids) => onReorder(ids as AiProviderId[])}
      className="flex flex-col gap-1.5"
      renderItem={(id, handle) => {
        const reason = skipReason(
          providers.find((provider) => provider.id === id),
          module
        )
        const position = module.order.indexOf(id) + 1
        return (
          <div className={`flex items-center gap-2 rounded-xl border py-1.5 pl-1 pr-3 ${reason ? "border-outline-variant/70 bg-surface-container-lowest" : "border-outline-variant bg-white"}`}>
            {handle}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-[12px] font-bold text-on-surface-variant">{position}</span>
            <span className={`min-w-0 flex-1 text-[13px] font-semibold ${reason ? "text-outline" : "text-on-surface"}`}>{AI_PROVIDER_LABELS[id]}</span>
            {reason ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-outline">
                <CircleSlash size={12} aria-hidden="true" />
                {reason}
              </span>
            ) : (
              <CheckCircle2 size={14} className="text-success" aria-label="Ready" />
            )}
          </div>
        )
      }}
    />

    {!module.isDefault && module.updatedAt && (
      <p className="text-[11px] text-outline">
        Changed {dateTime(module.updatedAt)}
        {module.updatedBy ? ` by ${module.updatedBy}` : ""}
      </p>
    )}
  </section>
)

/**
 * AI Model Priority (admin only): each module's provider order, dragged into place (or moved with the
 * arrow keys). A change saves at once and applies to admins' own requests to that module; regular
 * users always get the default order, Groq first.
 */
export default function ModelPriorityClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [overview, setOverview] = useState<ModelPriorityOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<ModelPriorityOverview>(MODEL_PRIORITY_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        setOverview(data)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : MODEL_PRIORITY_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [attempt])

  const save = async (module: ModelPriorityModule, order: AiProviderId[] | null) => {
    if (!overview) return
    const previous = overview
    // The new order shows at once and goes back if the save fails
    if (order) setOverview({ ...overview, modules: overview.modules.map((entry) => (entry.id === module.id ? { ...entry, order } : entry)) })
    setSavingId(module.id)
    setSaveError(null)
    try {
      const { data } = await requestApi<ModelPriorityOverview>(`${MODEL_PRIORITY_ENDPOINT}/${module.id}`, {
        method: order ? "PUT" : "DELETE",
        ...(order ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order }) } : {}),
      })
      setOverview(data)
    } catch (reason: unknown) {
      setOverview(previous)
      setSaveError(reason instanceof Error ? reason.message : MODEL_PRIORITY_MESSAGES.saveFailed)
    } finally {
      setSavingId(null)
    }
  }

  const defaultOrder = overview?.defaultOrder.map((id) => AI_PROVIDER_LABELS[id]).join(", then ")

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:p-8">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                <ListOrdered size={24} className="shrink-0 text-primary" aria-hidden="true" />
                AI Model Priority
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                The order each module tries the AI models in. Drag a model up or down; it saves at once. Your order applies to admin accounts only, and
                everyone else always uses the default{defaultOrder ? `: ${defaultOrder}` : ""}. Groq tries each of its keys before the next model.
              </p>
            </div>

            <AiUsagePanel />

            {overview && (
              <div className="flex flex-wrap gap-2" aria-label="Models on this deployment">
                {overview.providers.map((provider) => (
                  <span
                    key={provider.id}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold ${
                      provider.configured ? "border-success/40 bg-success-container/40 text-on-success-container" : "border-outline-variant bg-surface-container-lowest text-outline"
                    }`}
                  >
                    {provider.configured ? <CheckCircle2 size={13} aria-hidden="true" /> : <CircleSlash size={13} aria-hidden="true" />}
                    {provider.label}: {provider.configured ? "configured" : "not configured"}
                  </span>
                ))}
              </div>
            )}

            {saveError && (
              <p role="alert" className="flex items-center gap-2 rounded-xl bg-error-container px-3 py-2 text-sm text-error">
                <AlertTriangle size={15} aria-hidden="true" />
                {saveError}
              </p>
            )}

            {error ? (
              <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-white px-6 py-12 text-center">
                <p className="text-sm text-error">{error}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((count) => count + 1)}
                  className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-high"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : !overview ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
                <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
                Loading the model priorities...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {overview.modules.map((module) => (
                  <ModuleCard
                    key={module.id}
                    module={module}
                    providers={overview.providers}
                    isSaving={savingId === module.id}
                    onReorder={(order) => void save(module, order)}
                    onReset={() => void save(module, null)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
