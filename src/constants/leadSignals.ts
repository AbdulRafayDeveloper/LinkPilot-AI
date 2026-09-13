/**
 * The Lead Signals table shared by Follow-Up Message and Conversation Reply. Each tool has
 * its own separately saved Lead Signals prompt under this tab id; the signals, their label
 * options and the fixed rules are the same in both.
 */
export const LEAD_SIGNALS_PROMPT_ID = "lead-signals"
export const LEAD_SIGNALS_TAB_LABEL = "Lead Signals"

export const TECHNICAL_LEVELS = ["Non-Technical", "Semi-Technical", "Full Technical", "Unknown"] as const
export type TechnicalLevel = (typeof TECHNICAL_LEVELS)[number]

export const SENIORITY_LEVELS = ["Junior", "Mid-Level", "Full Senior", "Unknown"] as const
export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number]

export const LEAD_TEMPERATURES = ["Hot", "Warm", "Cold"] as const
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number]

export const DECISION_ROLES = ["Decision Maker", "Influencer", "End User", "Unknown"] as const
export type DecisionRole = (typeof DECISION_ROLES)[number]

export const URGENCY_LEVELS = ["Urgent", "Soon", "No Rush", "Unknown"] as const
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number]

export const BUDGET_SIGNALS = ["Stated", "Implied", "Not Seen"] as const
export type BudgetSignal = (typeof BUDGET_SIGNALS)[number]

export const COMPANY_SIZES = ["Solo", "Startup", "SMB", "Mid-Market", "Enterprise", "Unknown"] as const
export type CompanySize = (typeof COMPANY_SIZES)[number]

// Shown when a signal has no evidence; the table renders these muted
export const UNKNOWN_VALUE = "Unknown"
export const NONE_SEEN = "None seen"
export const EMPTY_SIGNAL_VALUES: readonly string[] = [UNKNOWN_VALUE, NONE_SEEN, "Not Seen"]
