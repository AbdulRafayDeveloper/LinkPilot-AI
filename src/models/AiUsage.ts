import mongoose, { Schema, type Model } from "mongoose"

/**
 * One successful AI call, for budget tracking: which provider and model answered, for which module
 * and account, what kind of call it was, and what it used. Written by services/aiUsage.ts for every
 * call (text, screenshot, web search, speech, image). Never the prompt or the answer.
 */
export interface IAiUsage {
  ownerId: string | null
  module: string | null
  provider: string
  model: string
  kind: string
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  audioSeconds: number | null
  keyNumber: number | null
  createdAt: Date
  updatedAt: Date
}

const AiUsageSchema = new Schema<IAiUsage>(
  {
    ownerId: { type: String, default: null },
    module: { type: String, default: null },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    kind: { type: String, required: true },
    inputTokens: { type: Number, default: null },
    outputTokens: { type: Number, default: null },
    totalTokens: { type: Number, default: null },
    audioSeconds: { type: Number, default: null },
    keyNumber: { type: Number, default: null },
  },
  { timestamps: true, collection: "ai_usage" }
)
// The budget summaries read a time window, grouped by provider and by module
AiUsageSchema.index({ createdAt: -1, provider: 1 })

export const AiUsageModel = (mongoose.models.AiUsage as Model<IAiUsage> | undefined) ?? mongoose.model<IAiUsage>("AiUsage", AiUsageSchema)
