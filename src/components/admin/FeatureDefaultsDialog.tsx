"use client"

import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import { FEATURE_ACCESS_MESSAGES, FEATURE_DEFAULTS_ENDPOINT, manageableFeatures } from "@/constants/featureAccess"
import { FeatureSwitchboard } from "@/components/admin/FeatureSwitchboard"
import type { FeatureDefaults } from "@/types/featureAccess"

/**
 * Which tools every user gets, set once for all of them from User Management. A tool turned off here
 * leaves every user's sidebar and is refused to them, unless an account has its own choice for it
 * (set from that account's page), which wins for that account alone. Admins always keep every tool.
 *
 * Every switch saves on its own and only moves the tools it names, so two admins changing different
 * tools at once never undo each other.
 */
export const FeatureDefaultsDialog: React.FC<{ onClose: () => void; onChanged: (defaults: FeatureDefaults) => void }> = ({ onClose, onChanged }) => {
  const [defaults, setDefaults] = useState<FeatureDefaults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const queue = useRef<Promise<void>>(Promise.resolve())
  const total = manageableFeatures().length

  useEffect(() => {
    const controller = new AbortController()
    requestApi<FeatureDefaults>(FEATURE_DEFAULTS_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => setDefaults(data))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : FEATURE_ACCESS_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [])

  const change = (toolIds: string[], on: boolean) => {
    if (!defaults) return
    const previous = defaults
    const off = new Set(defaults.disabledTools)
    for (const toolId of toolIds) {
      if (on) off.delete(toolId)
      else off.add(toolId)
    }
    setDefaults({ ...defaults, disabledTools: [...off] })
    setBusy((current) => new Set([...current, ...toolIds]))
    setError(null)
    queue.current = queue.current.then(async () => {
      try {
        const { data } = await requestApi<FeatureDefaults>(FEATURE_DEFAULTS_ENDPOINT, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tools: toolIds, on }),
        })
        setDefaults(data)
        onChanged(data)
      } catch (reason: unknown) {
        setDefaults(previous)
        setError(reason instanceof Error ? reason.message : FEATURE_ACCESS_MESSAGES.saveFailed)
      } finally {
        setBusy((current) => {
          const next = new Set(current)
          toolIds.forEach((toolId) => next.delete(toolId))
          return next
        })
      }
    })
  }

  const offCount = defaults?.disabledTools.length ?? 0
  const allOff = defaults?.disabledTools ?? []

  return (
    <Modal title="Tools for all users" description={FEATURE_ACCESS_MESSAGES.defaultsExplains} onClose={onClose} isCloseDisabled={busy.size > 0}>
      <div className="flex flex-col gap-3">
        {defaults && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-container-lowest px-3 py-2.5">
            <p className="text-[13px] text-on-surface">
              <span className="font-semibold">{offCount === 0 ? `All ${total} tools on` : `${total - offCount} of ${total} tools on`}</span> for every user
              {defaults.customisedUsers > 0 && (
                <span className="text-on-surface-variant">
                  {" · "}
                  {defaults.customisedUsers === 1 ? "1 account has" : `${defaults.customisedUsers} accounts have`} its own choices, which win for it
                </span>
              )}
            </p>
            {offCount > 0 && (
              <button
                type="button"
                onClick={() => change(allOff, true)}
                disabled={busy.size > 0}
                className="whitespace-nowrap rounded-lg border border-outline-variant bg-white px-2.5 py-1 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
              >
                Turn everything on
              </button>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="flex items-center gap-1.5 rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
            <AlertTriangle size={13} aria-hidden="true" />
            {error}
          </p>
        )}

        {!defaults && !error ? (
          <p role="status" className="flex items-center gap-2 text-[13px] text-on-surface-variant">
            <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />
            Loading the tools for every user...
          </p>
        ) : (
          defaults && <FeatureSwitchboard isOff={(toolId) => defaults.disabledTools.includes(toolId)} busy={busy} onChange={change} />
        )}
      </div>
    </Modal>
  )
}
