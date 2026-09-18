"use client"

import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, Loader2, RotateCcw, ShieldCheck } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import { FEATURE_ACCESS_MESSAGES, manageableFeatures } from "@/constants/featureAccess"
import { FeatureSwitchboard } from "@/components/admin/FeatureSwitchboard"
import type { FeatureAccess } from "@/types/featureAccess"

// What one tool looks like for this account after it is set on or off, before the server answers
const withTools = (access: FeatureAccess, toolIds: string[], on: boolean): FeatureAccess => {
  const off = new Set(access.effective)
  for (const toolId of toolIds) {
    if (on) off.delete(toolId)
    else off.add(toolId)
  }
  return { ...access, effective: [...off] }
}

/**
 * Which tools one account may use, on its page in User Management. It starts from the settings for
 * every user; a switch changed here is this account's own choice and wins over them for it alone,
 * which the "Own choice" tag marks. "Follow all users" drops every choice of its own.
 *
 * A tool turned off leaves the account's sidebar, its pages send the account away and its API refuses
 * it, on the account's very next request: nothing it made is touched, and turning the tool back on
 * brings it back as it was. An admin's own tools are never turned off, and the panel says so.
 */
export const FeatureAccessPanel: React.FC<{ userId: string; isAdminAccount: boolean }> = ({ userId, isAdminAccount }) => {
  const [access, setAccess] = useState<FeatureAccess | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  // Changes go one after another, so two quick switches land in the order they were pressed
  const queue = useRef<Promise<void>>(Promise.resolve())
  const endpoint = `/api/admin/users/${userId}/features`
  const total = manageableFeatures().length

  useEffect(() => {
    if (isAdminAccount) return
    const controller = new AbortController()
    requestApi<FeatureAccess>(endpoint, { signal: controller.signal })
      .then(({ data }) => {
        setAccess(data)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : FEATURE_ACCESS_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [endpoint, isAdminAccount])

  const send = (body: { tools: string[]; on: boolean } | { reset: true }, touched: string[], optimistic: FeatureAccess | null) => {
    const previous = access
    if (optimistic) setAccess(optimistic)
    setBusy((current) => new Set([...current, ...touched]))
    setError(null)
    queue.current = queue.current.then(async () => {
      try {
        const { data } = await requestApi<FeatureAccess>(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        setAccess(data)
      } catch (reason: unknown) {
        // Back to what was saved, so the switches never show a change that did not happen
        setAccess(previous)
        setError(reason instanceof Error ? reason.message : FEATURE_ACCESS_MESSAGES.saveFailed)
      } finally {
        setBusy((current) => {
          const next = new Set(current)
          touched.forEach((toolId) => next.delete(toolId))
          return next
        })
      }
    })
  }

  if (isAdminAccount) {
    return (
      <section aria-label="Tools this account can use" className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-on-surface">
          <ShieldCheck size={15} className="text-primary" aria-hidden="true" />
          Tools this account can use
        </h3>
        <p className="mt-1.5 text-[13px] text-on-surface-variant">{FEATURE_ACCESS_MESSAGES.adminsKeepEverything}</p>
      </section>
    )
  }

  const off = new Set(access?.effective ?? [])
  const ownOff = new Set(access?.disabledTools ?? [])
  const ownOn = new Set(access?.enabledTools ?? [])
  const ownChoices = ownOff.size + ownOn.size

  return (
    <section aria-label="Tools this account can use" className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-on-surface">
          <ShieldCheck size={15} className="text-primary" aria-hidden="true" />
          Tools this account can use
        </h3>
        {access && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-outline">{off.size === 0 ? `All ${total} on` : `${total - off.size} of ${total} on`}</span>
            {ownChoices > 0 && (
              <button
                type="button"
                onClick={() => send({ reset: true }, [...ownOff, ...ownOn], { ...access, disabledTools: [], enabledTools: [], effective: access.defaults })}
                title="Drop this account's own choices, so it gets exactly what every user gets"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant bg-white px-2.5 py-1 text-[11px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
              >
                <RotateCcw size={12} aria-hidden="true" />
                Follow all users
              </button>
            )}
          </div>
        )}
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-on-surface-variant">{FEATURE_ACCESS_MESSAGES.perUserExplains}</p>
      {access && ownChoices > 0 && (
        <p className="mt-1 text-[12px] font-semibold text-on-surface-variant">
          {ownChoices === 1 ? "1 tool is this account's own choice." : `${ownChoices} tools are this account's own choice.`}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
          <AlertTriangle size={13} aria-hidden="true" />
          {error}
        </p>
      )}

      {!access && !error ? (
        <p role="status" className="mt-3 flex items-center gap-2 text-[13px] text-on-surface-variant">
          <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />
          Loading what this account can use...
        </p>
      ) : (
        access && (
          <div className="mt-3">
            <FeatureSwitchboard
              isOff={(toolId) => off.has(toolId)}
              busy={busy}
              noteFor={(toolId) =>
                ownOff.has(toolId) || ownOn.has(toolId) ? (
                  <span
                    title={ownOff.has(toolId) ? "Off for this account only" : "On for this account only, though off for every user"}
                    className="shrink-0 rounded-full bg-secondary-fixed px-1.5 py-px text-[10px] font-bold text-on-secondary-fixed-variant"
                  >
                    Own choice
                  </span>
                ) : null
              }
              onChange={(toolIds, on) => send({ tools: toolIds, on }, toolIds, withTools(access, toolIds, on))}
            />
          </div>
        )
      )}
    </section>
  )
}
