import mongoose, { Schema, type Model } from "mongoose"

/**
 * A client the user sends messages to: their name and country, the format their messages
 * follow, and the sample messages that show it. Clients are listed newest last.
 */
export interface IClient {
  name: string
  country: string
  messageFormat: string
  sampleMessages: string[]
  createdAt: Date
  updatedAt: Date
}

const ClientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    messageFormat: { type: String, required: true },
    sampleMessages: { type: [String], default: [] },
  },
  { timestamps: true, collection: "clients" }
)
ClientSchema.index({ createdAt: 1 })

export const Client = (mongoose.models.Client as Model<IClient> | undefined) ?? mongoose.model<IClient>("Client", ClientSchema)
