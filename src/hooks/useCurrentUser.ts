"use client"

import { useSyncExternalStore } from "react"
import { requestApi } from "@/lib/apiClient"
import { AUTH_ENDPOINTS } from "@/constants/auth"
import { toolsFor } from "@/constants/linkedinTools"
import type { Viewer } from "@/types/auth"

/**
 * The signed-in account, read once per page load and shared by every component that asks (the
 * header's account menu, the admin-only buttons). It decides only what is shown: every API route
 * checks the account again, so hiding a button is never the protection.
 */

type CurrentUser = { status: "loading"; user: null } | { status: "ready"; user: Viewer } | { status: "signed-out"; user: null }

const LOADING: CurrentUser = { status: "loading", user: null }
let current: CurrentUser = LOADING
let request: Promise<void> | null = null
const listeners = new Set<() => void>()

function load() {
  request ??= requestApi<Viewer>(AUTH_ENDPOINTS.me)
    .then(({ data }) => {
      current = { status: "ready", user: data }
    })
    .catch(() => {
      current = { status: "signed-out", user: null }
    })
    .finally(() => listeners.forEach((listener) => listener()))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  load()
  return () => listeners.delete(listener)
}

/**
 * The account has changed something about itself (its name or its photo, from Account Settings), so
 * everything showing it follows at once rather than at the next page load. It is a change to what is
 * already loaded, so it does nothing while the account is still loading or signed out; the server is
 * what saved it, and this only keeps the copy in this tab in step.
 */
export function updateCurrentUser(change: Partial<Viewer>): void {
  if (current.status !== "ready") return
  current = { status: "ready", user: { ...current.user, ...change } }
  listeners.forEach((listener) => listener())
}

export function useCurrentUser(): CurrentUser {
  return useSyncExternalStore(subscribe, () => current, () => LOADING)
}

/** True only once the account has loaded and is an admin, so admin-only controls never flash for a user. */
export function useIsAdmin(): boolean {
  const { user } = useCurrentUser()
  return user?.role === "admin"
}

/**
 * The tools this account may use. While the account is still loading nothing is hidden yet, which
 * is why a tool that is off is also refused by its page and its API rather than only left out here.
 */
export function useVisibleTools() {
  const { user } = useCurrentUser()
  return toolsFor(user?.role === "admin", user?.disabledTools ?? [])
}
