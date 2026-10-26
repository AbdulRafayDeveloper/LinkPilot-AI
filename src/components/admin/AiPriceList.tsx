"use client"

import React, { useEffect, useState } from "react"
import { Check, Loader2, Plus, Trash2 } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import { formatInstant } from "@/lib/timeZone"
import { NO_PRICES } from "@/lib/aiCost"
import { AI_COST_MESSAGES, AI_PRICES_ENDPOINT, MODEL_ID_MAX_LENGTH, PRICE_FIELDS, PRICE_MAX, PROVIDER_ID_MAX_LENGTH } from "@/constants/aiCosts"
import { AI_PROVIDER_LABELS, MODEL_PROVIDERS } from "@/constants/aiProviders"
import type { ModelPriceRow, ModelPrices } from "@/types/aiCosts"

type PriceKey = keyof ModelPrices
type Draft = Record<PriceKey, string>

const fieldClass =
  "h-9 w-full rounded-lg border border-outline-variant bg-white px-2 text-[13px] text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
const buttonClass =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"

const draftOf = (prices: ModelPrices | null): Draft =>
  Object.fromEntries(PRICE_FIELDS.map(({ key }) => [key, prices ? String(prices[key]) : ""])) as Draft

/** The draft as prices, or null when a field is not a price; an empty field means 0. */
const pricesOf = (draft: Draft): ModelPrices | null => {
  const prices = { ...NO_PRICES }
  for (const { key } of PRICE_FIELDS) {
    const text = draft[key].trim()
    const value = text === "" ? 0 : Number(text)
    if (!Number.isFinite(value) || value < 0 || value > PRICE_MAX) return null
    prices[key] = value
  }
  return prices
}

interface PriceFieldsProps {
  draft: Draft
  onChange: (key: PriceKey, value: string) => void
  idPrefix: string
}

const PriceFields: React.FC<PriceFieldsProps> = ({ draft, onChange, idPrefix }) => (
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {PRICE_FIELDS.map(({ key, label, unit }) => (
      <label key={key} htmlFor={`${idPrefix}-${key}`} className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
          {label} <span className="font-semibold normal-case tracking-normal">($ {unit})</span>
        </span>
        <input
          id={`${idPrefix}-${key}`}
          type="number"
          inputMode="decimal"
          min={0}
          max={PRICE_MAX}
          step="any"
          placeholder="0"
          value={draft[key]}
          onChange={(event) => onChange(key, event.target.value)}
          className={fieldClass}
        />
      </label>
    ))}
  </div>
)

interface PriceRowProps {
  row: ModelPriceRow
  onSaved: (rows: ModelPriceRow[]) => void
}

/** One model and its prices, saved on its own. */
const PriceRow: React.FC<PriceRowProps> = ({ row, onSaved }) => {
  const [draft, setDraft] = useState<Draft>(() => draftOf(row.prices))
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle")
  const [error, setError] = useState<string | null>(null)
  const prices = pricesOf(draft)
  // Compared as numbers, so "" and "0" are the same price; a model with no price can always be saved
  const saved = row.prices
  const isChanged = !saved || !prices || PRICE_FIELDS.some(({ key }) => prices[key] !== saved[key])

  const send = async (method: "PUT" | "DELETE") => {
    if (method === "PUT" && !prices) {
      setError(AI_COST_MESSAGES.badPrice)
      return
    }
    setState("saving")
    setError(null)
    try {
      const body = method === "PUT" ? { provider: row.provider, model: row.model, ...prices } : { provider: row.provider, model: row.model }
      // A repeat lands on the same prices, so a dropped request may safely go again
      const { data } = await requestApi<ModelPriceRow[]>(
        AI_PRICES_ENDPOINT,
        { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        { retry: true }
      )
      setState("saved")
      onSaved(data)
    } catch (reason: unknown) {
      setState("idle")
      setError(reason instanceof Error ? reason.message : method === "PUT" ? AI_COST_MESSAGES.saveFailed : AI_COST_MESSAGES.removeFailed)
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-[13px]">
          <span className="font-semibold text-on-surface">{row.providerLabel}</span>
          <span className="text-outline"> · </span>
          <span className="break-all font-mono text-[12px] text-on-surface">{row.model}</span>
        </p>
        <p className="text-[11px] text-outline">
          {row.calls.toLocaleString()} {row.calls === 1 ? "call" : "calls"}
          {row.lastUsedAt && ` · last used ${formatInstant(row.lastUsedAt, { dateStyle: "medium" })}`}
          {!row.prices && (
            <span className="ml-2 rounded-full bg-secondary-fixed px-2 py-0.5 font-semibold text-on-secondary-fixed-variant">{AI_COST_MESSAGES.noPrice}</span>
          )}
        </p>
      </div>
      <PriceFields
        draft={draft}
        idPrefix={`price-${row.provider}-${row.model}`.replace(/[^a-zA-Z0-9-]/g, "-")}
        onChange={(key, value) => {
          setState("idle")
          setDraft((current) => ({ ...current, [key]: value }))
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => send("PUT")}
          disabled={state === "saving" || !isChanged}
          className={`${buttonClass} bg-primary text-white hover:bg-on-primary-fixed-variant`}
        >
          {state === "saving" ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}
          {AI_COST_MESSAGES.save}
        </button>
        {row.prices && (
          <button
            type="button"
            onClick={() => send("DELETE")}
            disabled={state === "saving"}
            className={`${buttonClass} text-outline hover:bg-error-container hover:text-error`}
          >
            <Trash2 size={13} aria-hidden="true" />
            {AI_COST_MESSAGES.remove}
          </button>
        )}
        {state === "saved" && !isChanged && (
          <span role="status" className="inline-flex items-center gap-1 text-[12px] font-semibold text-success">
            <Check size={13} aria-hidden="true" />
            {AI_COST_MESSAGES.saved}
          </span>
        )}
        {row.updatedBy && row.updatedAt && (
          <span className="text-[11px] text-outline">
            Changed {formatInstant(row.updatedAt, { dateStyle: "medium" })} by {row.updatedBy}
          </span>
        )}
        {error && (
          <span role="alert" className="text-[12px] text-error">
            {error}
          </span>
        )}
      </div>
    </li>
  )
}

/** Pricing a model before it is used, or one from a provider the app has just started using. */
const AddModel: React.FC<{ rows: ModelPriceRow[]; onSaved: (rows: ModelPriceRow[]) => void }> = ({ rows, onSaved }) => {
  const [provider, setProvider] = useState("")
  const [model, setModel] = useState("")
  const [draft, setDraft] = useState<Draft>(() => draftOf(null))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const knownProviders = [...new Set([...MODEL_PROVIDERS, ...rows.map((row) => row.provider)])]

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const prices = pricesOf(draft)
    if (!provider.trim() || !model.trim()) {
      setError(AI_COST_MESSAGES.needsModel)
      return
    }
    if (!prices) {
      setError(AI_COST_MESSAGES.badPrice)
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await requestApi<ModelPriceRow[]>(
        AI_PRICES_ENDPOINT,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: provider.trim(), model: model.trim(), ...prices }) },
        { retry: true }
      )
      onSaved(data)
      setProvider("")
      setModel("")
      setDraft(draftOf(null))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : AI_COST_MESSAGES.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3">
      <div>
        <p className="text-[13px] font-semibold text-on-surface">{AI_COST_MESSAGES.addModel}</p>
        <p className="text-[12px] text-on-surface-variant">{AI_COST_MESSAGES.addModelHint}</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-outline">{AI_COST_MESSAGES.provider}</span>
          <input list="ai-cost-providers" value={provider} maxLength={PROVIDER_ID_MAX_LENGTH} onChange={(event) => setProvider(event.target.value)} className={fieldClass} placeholder="groq" />
          <datalist id="ai-cost-providers">
            {knownProviders.map((id) => (
              <option key={id} value={id}>
                {(AI_PROVIDER_LABELS as Record<string, string>)[id] ?? id}
              </option>
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-outline">{AI_COST_MESSAGES.model}</span>
          <input list="ai-cost-models" value={model} maxLength={MODEL_ID_MAX_LENGTH} onChange={(event) => setModel(event.target.value)} className={fieldClass} placeholder="openai/gpt-oss-120b" />
          <datalist id="ai-cost-models">
            {rows
              .filter((row) => !provider || row.provider === provider)
              .map((row) => (
                <option key={`${row.provider}-${row.model}`} value={row.model} />
              ))}
          </datalist>
        </label>
      </div>
      <PriceFields draft={draft} idPrefix="price-new" onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={isSaving} className={`${buttonClass} bg-primary text-white hover:bg-on-primary-fixed-variant`}>
          {isSaving ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}
          {AI_COST_MESSAGES.save}
        </button>
        {error && (
          <span role="alert" className="text-[12px] text-error">
            {error}
          </span>
        )}
      </div>
    </form>
  )
}

/**
 * The Prices tab: every model the app has used (most used first, the ones with no price marked),
 * each with its four prices to set, plus a form for a model or provider not used yet.
 */
export const AiPriceList: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const [rows, setRows] = useState<ModelPriceRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<ModelPriceRow[]>(AI_PRICES_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => setRows(data))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : AI_COST_MESSAGES.pricesFailed)
      })
    return () => controller.abort()
  }, [])

  const saved = (next: ModelPriceRow[]) => {
    setRows(next)
    onChanged()
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-xl bg-surface-container-lowest px-3 py-2 text-[12px] leading-relaxed text-on-surface-variant">
        {AI_COST_MESSAGES.pricesIntro} {AI_COST_MESSAGES.groqFree}
      </p>
      {error ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[13px] text-error">
          {error}
        </p>
      ) : !rows ? (
        <p role="status" className="flex items-center gap-2 text-[13px] text-on-surface-variant">
          <Loader2 size={15} className="animate-spin text-primary" aria-hidden="true" />
          Loading prices...
        </p>
      ) : (
        <>
          <AddModel rows={rows} onSaved={saved} />
          <ul className="flex flex-col gap-2" aria-label="Model prices">
            {rows.map((row) => (
              <PriceRow key={`${row.provider}\u0000${row.model}`} row={row} onSaved={saved} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
