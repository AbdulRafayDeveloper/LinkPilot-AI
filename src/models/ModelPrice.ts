import mongoose, { Schema, type Model } from "mongoose"

/**
 * What one provider's model costs, in US dollars, kept by an admin (AI Model Priority → Cost by
 * model → Prices). One document per provider and model. Shared by the whole app, like the model
 * priorities, so it has no owner. A model fills only what it is billed by; the rest stay 0.
 */
export interface IModelPrice {
  provider: string
  model: string
  inputPerMillion: number
  outputPerMillion: number
  perAudioMinute: number
  perCall: number
  // The admin who last changed it, by email
  updatedBy: string | null
  createdAt: Date
  updatedAt: Date
}

const ModelPriceSchema = new Schema<IModelPrice>(
  {
    provider: { type: String, required: true },
    model: { type: String, required: true },
    inputPerMillion: { type: Number, default: 0 },
    outputPerMillion: { type: Number, default: 0 },
    perAudioMinute: { type: Number, default: 0 },
    perCall: { type: Number, default: 0 },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, collection: "model_prices" }
)
ModelPriceSchema.index({ provider: 1, model: 1 }, { unique: true })

export const ModelPriceModel =
  (mongoose.models.ModelPrice as Model<IModelPrice> | undefined) ?? mongoose.model<IModelPrice>("ModelPrice", ModelPriceSchema)
