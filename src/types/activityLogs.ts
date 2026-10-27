import type { ActivityAction, ActivityOutcome } from "@/constants/activityLogs"

/** One activity as a page reads it. The user agent itself stays on the server; the page gets what it says. */
export interface ActivityEntry {
  id: string
  action: ActivityAction
  outcome: ActivityOutcome
  module: string
  moduleTitle: string
  // "Updated tasks in Client Projects", worked out on the server so every surface says the same
  summary: string
  resource: string
  method: string
  path: string
  targetId: string | null
  count: number
  createdAt: string
  lastAt: string
  browser: string
  os: string
  device: string
  ipAddress: string | null
  // When the person deleted it from their own list; only an admin's list ever carries one
  deletedAt: string | null
}

export interface ActivityModuleOption {
  id: string
  label: string
}

export interface ActivityPage {
  items: ActivityEntry[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  // The modules this list's activities are in, whatever the filters, for the module filter
  modules: ActivityModuleOption[]
}

/** What an admin reads about one account's activities, beside the page. */
export interface AdminActivityPage extends ActivityPage {
  user: { id: string; name: string; email: string }
  summary: { total: number; deleted: number; refused: number; lastAt: string | null }
}

export interface ActivityDeletion {
  deleted: number
}
