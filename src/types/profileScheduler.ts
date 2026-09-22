import type { WeekDayId } from "@/constants/profileScheduler"

export interface ProfileSchedule {
  id: string
  profileUrl: string
  // In week order, Monday first, each once
  days: WeekDayId[]
  createdAt: string
  updatedAt: string
}

export interface ProfileScheduleInput {
  profileUrl: string
  days: WeekDayId[]
}

export interface ProfileSchedulePage {
  items: ProfileSchedule[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  // How many of the viewer's profiles each day has, whatever the search, for the day filter
  dayCounts: Record<WeekDayId, number>
}
