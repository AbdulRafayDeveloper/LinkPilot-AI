import type { PersonTypeId, WeekDayId } from "@/constants/profileScheduler"

export interface ProfileSchedule {
  id: string
  // Null until the person's LinkedIn profile has been found
  profileUrl: string | null
  name: string
  role: string
  location: string
  sector: string
  // In PERSON_TYPES order, each once
  types: PersonTypeId[]
  // In week order, Monday first, each once
  days: WeekDayId[]
  createdAt: string
  updatedAt: string
}

/** What the add form and the edit dialog hold; a blank link means none. */
export interface ProfileScheduleInput {
  profileUrl: string
  name: string
  role: string
  location: string
  sector: string
  types: PersonTypeId[]
  days: WeekDayId[]
}

/**
 * A person as the API takes it, once validated. Every field but the days may be left out: a create
 * fills what is missing with nothing, and an edit leaves it as it was, so a caller written before
 * people had details (`{ profileUrl, days }`) works exactly as it did.
 */
export interface ProfilePersonFields {
  profileUrl?: string | null
  name?: string
  role?: string
  location?: string
  sector?: string
  types?: PersonTypeId[]
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
  // How many of the viewer's profiles each type has, whatever the search, for the type filter
  typeCounts: Record<PersonTypeId, number>
}
