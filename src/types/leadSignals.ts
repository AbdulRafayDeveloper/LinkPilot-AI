import type {
  BudgetSignal,
  CompanySize,
  DecisionRole,
  LeadTemperature,
  SeniorityLevel,
  TechnicalLevel,
  UrgencyLevel,
} from "@/constants/leadSignals"

export interface LeadScore {
  score: number
  // One short line, shown on hover
  reason: string
}

/**
 * The lead signals, estimated with a tool's saved Lead Signals prompt independently of the
 * chosen type or tone. Free-text values are a few words, or "Unknown" / "None seen".
 */
export interface LeadSignals {
  meetingChance: LeadScore
  relationshipStrength: LeadScore
  clientPotential: LeadScore
  country: string
  technicalLevel: TechnicalLevel
  seniority: SeniorityLevel
  buyingIntent: LeadScore
  leadTemperature: LeadTemperature
  decisionRole: DecisionRole
  urgency: UrgencyLevel
  budgetSignal: BudgetSignal
  companySize: CompanySize
  industry: string
  mainNeed: string
  mainObjection: string
  nextStep: string
}
