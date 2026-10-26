"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, CheckCircle2, CircleDollarSign, CircleSlash, Gauge, ListOrdered, Loader2, RefreshCw, RotateCcw, Table2, type LucideIcon } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { SortableList } from "@/components/ui/SortableList"
import { FilterPanel, SearchFilter, SelectFilter } from "@/components/history/HistoryFilters"
import { dateTime } from "@/components/admin/AdminParts"
import { AiCostView } from "@/components/admin/AiCostView"
import { AiPriceList } from "@/components/admin/AiPriceList"
import { ModelMapView } from "@/components/admin/ModelMapView"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useSavedFilters } from "@/hooks/useSavedFilters"
import { requestApi } from "@/lib/apiClient"
import { filtersOf, isFiltering, oneOf, savedText } from "@/lib/savedFilters"
import { filterModules, ORDER_CHOICES, SKIP_CHOICES, skipReasonOf, type ModuleOrderFilters } from "@/lib/modelPageFilters"
import { AI_PROVIDER_LABELS, type AiProviderId } from "@/constants/aiProviders"
import {
  AI_NEED_LABELS,
  DEFAULT_MODEL_PAGE_TAB,
  isModelPageTab,
  MODEL_PAGE_TABS,
  MODEL_PRIORITY_ENDPOINT,
  MODEL_PRIORITY_MESSAGES,
  type AiNeed,
  type ModelPageTab,
} from "@/constants/modelPriority"
import type { ModelPriorityModule, ModelPriorityOverview, ModelProviderStatus } from "@/types/modelPriority"

const TAB_ICONS: Record<ModelPageTab, LucideIcon> = { models: Table2, order: ListOrdered, usage: Gauge, prices: CircleDollarSign }

const NEED_CHOICES = [
  { id: "text", label: "Writes text only" },
  ...(Object.entries(AI_NEED_LABELS) as [AiNeed, string][]).map(([id, label]) => ({ id, label: `Uses ${label}` })),
]
const NO_ORDER_FILTERS: ModuleOrderFilters = { search: "", order: "", need: "", skipped: "" }

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
        const reason = skipReasonOf(
          providers.find((provider) => provider.id === id),
          module.needs,
          AI_NEED_LABELS
        )
        const position = module.order.indexOf(id) + 1
        return (
          <div className={`flex items-center gap-2 rounded-xl border py-1.5 pl-1 pr-3 ${reason ? "border-outline-variant/70 bg-surface-container-lowest" : "border-outline-variant bg-white"}`}>
            {handle}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-[12px] font-bold text-on-surface-variant">{position}</span>
            {/* Why a provider is skipped goes under its name, not beside it: beside it, the name was
                squeezed to 79px and "Open-source model" took three lines */}
            <span className="min-w-0 flex-1">
              <span className={`block text-[13px] font-semibold ${reason ? "text-outline" : "text-on-surface"}`}>{AI_PROVIDER_LABELS[id]}</span>
              {reason && (
                <span className="mt-0.5 flex items-center gap-1 text-[11px] text-outline">
                  <CircleSlash size={12} className="shrink-0" aria-hidden="true" />
                  {reason}
                </span>
              )}
            </span>
            {!reason && <CheckCircle2 size={14} className="shrink-0 text-success" aria-label="Ready" />}
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

/** The Priority order tab: each module's provider order, dragged into place, narrowed by its filters. */
const ModuleOrderView: React.FC<{
  overview: ModelPriorityOverview
  savingId: string | null
  onSave: (module: ModelPriorityModule, order: AiProviderId[] | null) => void
}> = ({ overview, savingId, onSave }) => {
  const [filters, setFilters] = useState<ModuleOrderFilters>(NO_ORDER_FILTERS)
  const set = (patch: Partial<ModuleOrderFilters>) => setFilters((current) => ({ ...current, ...patch }))

  useSavedFilters({
    view: "admin-model-order",
    filters: filtersOf(filters),
    apply: (kept) =>
      setFilters({
        search: savedText(kept.search),
        order: oneOf(kept.order, ORDER_CHOICES.map((choice) => choice.id)),
        need: oneOf(kept.need, NEED_CHOICES.map((choice) => choice.id)),
        skipped: oneOf(kept.skipped, SKIP_CHOICES.map((choice) => choice.id)),
      }),
  })

  const shown = filterModules(overview.modules, overview.providers, filters, AI_NEED_LABELS)
  const defaultOrder = overview.defaultOrder.map((id) => AI_PROVIDER_LABELS[id]).join(", then ")

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-xl bg-surface-container-lowest px-3 py-2 text-[12.5px] leading-relaxed text-on-surface-variant">
        Drag a provider up or down; it saves at once. Your order applies to admin accounts only, and everyone else always uses the default: {defaultOrder}. Groq
        tries each of its keys before the next provider.
      </p>
      <FilterPanel
        columnsClassName="md:grid-cols-4"
        summary={`${shown.length} of ${overview.modules.length} modules`}
        canClear={isFiltering(filtersOf(filters))}
        onClear={() => setFilters(NO_ORDER_FILTERS)}
      >
        <SearchFilter value={filters.search} onChange={(search) => set({ search })} placeholder="Search a module" />
        <SelectFilter label="Order" allLabel="Any order" value={filters.order} options={ORDER_CHOICES} onChange={(order) => set({ order })} />
        <SelectFilter label="What it needs" allLabel="Anything" value={filters.need} options={NEED_CHOICES} onChange={(need) => set({ need })} />
        <SelectFilter label="Providers" allLabel="All modules" value={filters.skipped} options={SKIP_CHOICES} onChange={(skipped) => set({ skipped })} />
      </FilterPanel>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant bg-white px-3 py-6 text-center text-[13px] text-on-surface-variant">
          {MODEL_PRIORITY_MESSAGES.nothingMatches}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              providers={overview.providers}
              isSaving={savingId === module.id}
              onReorder={(order) => onSave(module, order)}
              onReset={() => onSave(module, null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * AI Model Priority (admin only), as four tabs that each answer one question: which model does
 * each job (Models in use), the order the providers are tried in (Priority order), what the calls
 * used and cost (Usage & cost) and what each model costs (Prices). Every tab has its own filters,
 * kept on the account, and the open tab is in the address (`?tab=`), so a reload or a link opens it.
 */
export default function ModelPriorityClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const router = useRouter()
  const searchParams = useSearchParams()
  const askedTab = searchParams.get("tab")
  const tab: ModelPageTab = isModelPageTab(askedTab) ? askedTab : DEFAULT_MODEL_PAGE_TAB
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

  // The open tab is in the address, replaced rather than pushed, so Back still leaves the page
  const choose = (next: ModelPageTab) => router.replace(next === DEFAULT_MODEL_PAGE_TAB ? "?" : `?tab=${next}`, { scroll: false })

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

  const current = MODEL_PAGE_TABS.find((entry) => entry.id === tab) ?? MODEL_PAGE_TABS[0]
  // The first two tabs read the overview; the other two load their own data
  const needsOverview = tab === "models" || tab === "order"

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
              <p className="mt-1 text-sm text-on-surface-variant">The AI models this app uses, the order it tries them in, what they cost and their prices.</p>
            </div>

            <div className="flex flex-col gap-2">
              <div role="tablist" aria-label="AI Model Priority" className="flex flex-wrap gap-1 rounded-2xl border border-outline-variant bg-white p-1">
                {MODEL_PAGE_TABS.map((entry) => {
                  const Icon = TAB_ICONS[entry.id]
                  const isChosen = entry.id === tab
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="tab"
                      id={`model-tab-${entry.id}`}
                      aria-selected={isChosen}
                      aria-controls={`model-panel-${entry.id}`}
                      onClick={() => choose(entry.id)}
                      className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-4 sm:text-[14px] ${
                        isChosen ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      }`}
                    >
                      <Icon size={16} aria-hidden="true" />
                      {entry.label}
                    </button>
                  )
                })}
              </div>
              {/* What the open tab is for, in one line, so nobody has to guess */}
              <p className="px-1 text-[13px] text-on-surface-variant">{current.hint}</p>
            </div>

            {saveError && (
              <p role="alert" className="flex items-center gap-2 rounded-xl bg-error-container px-3 py-2 text-sm text-error">
                <AlertTriangle size={15} aria-hidden="true" />
                {saveError}
              </p>
            )}

            <div id={`model-panel-${tab}`} role="tabpanel" aria-labelledby={`model-tab-${tab}`} className="min-w-0">
              {needsOverview && error ? (
                <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-white px-6 py-12 short:py-4 text-center">
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
              ) : needsOverview && !overview ? (
                <div role="status" className="flex items-center justify-center gap-2 py-16 short:py-5 text-sm text-on-surface-variant">
                  <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
                  Loading the models...
                </div>
              ) : tab === "models" && overview ? (
                <ModelMapView overview={overview} />
              ) : tab === "order" && overview ? (
                <ModuleOrderView overview={overview} savingId={savingId} onSave={(module, order) => void save(module, order)} />
              ) : tab === "usage" ? (
                <AiCostView onSetPrices={() => choose("prices")} />
              ) : (
                <AiPriceList />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
