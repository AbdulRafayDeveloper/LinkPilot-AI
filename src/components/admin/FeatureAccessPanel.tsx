"use client"

import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, Loader2, ShieldCheck } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import { TOOL_GROUPS, type ToolGroupId } from "@/constants/linkedinTools"
import { FEATURE_ACCESS_MESSAGES, manageableFeatures } from "@/constants/featureAccess"
import type { FeatureAccess } from "@/services/admin/featureAccess"

/**
 * Which tools one account may use, on that account's page in User Management. A tool turned off
 * here leaves their sidebar, its pages send them away and its API refuses them, on their very next
 * request: nothing they have made is touched, and turning it back on brings it back as it was.
 *
 * Every switch saves on its own, so the admin never has to remember to press Save. An admin's own
 * tools are never turned off, and the panel says so rather than showing switches that cannot move.
 */
export const FeatureAccessPanel: React.FC<{ userId: string; isAdminAccount: boolean }> = ({ userId, isAdminAccount }) => {
  const [access, setAccess] = useState<FeatureAccess | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set())
  // Saves go one after another, so two quick switches land in the order they were pressed
  const queue = useRef<Promise<void>>(Promise.resolve())
  const tools = manageableFeatures()

  useEffect(() => {
    if (isAdminAccount) return
    const controller = new AbortController()
    requestApi<FeatureAccess>(`/api/admin/users/${userId}/features`, { signal: controller.signal })
      .then(({ data }) => {
        setAccess(data)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : FEATURE_ACCESS_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [userId, isAdminAccount])

  const save = (disabledTools: string[], touched: string[]) => {
    const previous = access
    setAccess((current) => (current ? { ...current, disabledTools } : current))
    setSaving((current) => new Set([...current, ...touched]))
    setError(null)
    queue.current = queue.current.then(async () => {
      try {
        const { data } = await requestApi<FeatureAccess>(`/api/admin/users/${userId}/features`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ disabledTools }),
        })
        setAccess(data)
      } catch (reason: unknown) {
        // Put the switches back where they were, so the panel never shows a change that wasn't saved
        setAccess(previous)
        setError(reason instanceof Error ? reason.message : FEATURE_ACCESS_MESSAGES.saveFailed)
      } finally {
        setSaving((current) => {
          const next = new Set(current)
          touched.forEach((id) => next.delete(id))
          return next
        })
      }
    })
  }

  const toggle = (toolId: string) => {
    if (!access) return
    const off = access.disabledTools.includes(toolId)
    save(off ? access.disabledTools.filter((id) => id !== toolId) : [...access.disabledTools, toolId], [toolId])
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

  const off = new Set(access?.disabledTools ?? [])

  return (
    <section aria-label="Tools this account can use" className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-on-surface">
          <ShieldCheck size={15} className="text-primary" aria-hidden="true" />
          Tools this account can use
        </h3>
        {access && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-outline">
              {off.size === 0 ? `All ${tools.length} tools` : `${tools.length - off.size} of ${tools.length} on`}
            </span>
            {off.size > 0 && (
              <button
                type="button"
                onClick={() => save([], [...off])}
                className="rounded-lg border border-outline-variant bg-white px-2.5 py-1 text-[11px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
              >
                Turn all on
              </button>
            )}
          </div>
        )}
      </div>
      <p className="mt-1 text-[12px] text-on-surface-variant">
        A tool turned off leaves their sidebar and refuses them if they type its address. Nothing they have already made is deleted.
      </p>

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
          <div className="mt-3 flex flex-col gap-3">
            {TOOL_GROUPS.map((group) => {
              const inGroup = tools.filter((tool) => tool.group === (group.id as ToolGroupId))
              if (inGroup.length === 0) return null
              return (
                <div key={group.id}>
                  <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-outline">{group.label}</h4>
                  <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {inGroup.map((tool) => {
                      const isOff = off.has(tool.id)
                      const isSaving = saving.has(tool.id)
                      return (
                        <li key={tool.id}>
                          <button
                            type="button"
                            onClick={() => toggle(tool.id)}
                            disabled={isSaving}
                            role="switch"
                            aria-checked={!isOff}
                            title={tool.description}
                            className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors disabled:opacity-60 ${
                              isOff ? "border-outline-variant bg-white text-outline" : "border-primary/30 bg-primary-fixed/25 text-on-surface"
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{tool.title}</span>
                            {isSaving ? (
                              <Loader2 size={14} className="shrink-0 animate-spin text-primary" aria-hidden="true" />
                            ) : (
                              <span
                                aria-hidden="true"
                                className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${isOff ? "bg-outline-variant" : "bg-primary"}`}
                              >
                                <span
                                  className={`flex h-4 w-4 items-center justify-center rounded-full bg-white transition-transform ${isOff ? "" : "translate-x-4"}`}
                                >
                                  {!isOff && <Check size={10} className="text-primary" />}
                                </span>
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )
      )}
    </section>
  )
}
