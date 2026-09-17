import mongoose, { Schema, type Model } from "mongoose"
import { OWNER_ID } from "./owner"

/**
 * Every Trending Topics search ever run, newest last. The page shows the newest one with
 * topics that hasn't been dismissed; Reset dismisses (never deletes), so the history stays.
 */
export interface ITrendingSearch {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  // The full TrendingResult, validated when read back
  result: unknown
  topicCount: number
  searchProvider: string
  searchedAt: Date
  // When someone pressed Reset while this was the search on show; null while it can still show
  dismissedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const TrendingSearchSchema = new Schema<ITrendingSearch>(
  {
    ownerId: OWNER_ID,
    result: { type: Schema.Types.Mixed, required: true },
    topicCount: { type: Number, required: true },
    searchProvider: { type: String, required: true },
    searchedAt: { type: Date, required: true },
    dismissedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "trending_searches" }
)
TrendingSearchSchema.index({ createdAt: -1 })

export const TrendingSearch =
  (mongoose.models.TrendingSearch as Model<ITrendingSearch> | undefined) ??
  mongoose.model<ITrendingSearch>("TrendingSearch", TrendingSearchSchema)
