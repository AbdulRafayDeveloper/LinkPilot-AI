"use client"

import { useCallback, useEffect, useState } from "react"
import { requestApi } from "@/lib/apiClient"
import { BUDGET_ENDPOINT, BUDGET_MESSAGES } from "@/constants/budget"
import type { BudgetLedgerPage } from "@/types/budget"

/**
 * The person's whole budget (settings and every recorded month), read once per page. Both pages of
 * Budget Management work every total out from it, so they can never disagree with each other.
 */
export function useBudgetLedger() {
  const [ledger, setLedger] = useState<BudgetLedgerPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<BudgetLedgerPage>(BUDGET_ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        setLedger(data)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : BUDGET_MESSAGES.loadFailed)
      })
    return () => controller.abort()
  }, [attempt])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])
  return { ledger, setLedger, error, reload }
}
