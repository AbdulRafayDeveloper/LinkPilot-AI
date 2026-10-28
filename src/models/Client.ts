import mongoose, { Schema, type Model } from "mongoose"
import { CLIENT_KIND_IDS, DEFAULT_CLIENT_KIND, type ClientKind } from "@/constants/clients"
import { OWNER_ID } from "./owner"

/**
 * A client the user sends messages to: their name and country, the format their messages
 * follow, and the sample messages that show it. Clients are listed in the order they were dragged
 * into, ties (clients from before ordering) oldest first.
 */
export interface IClient {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  name: string
  country: string
  // One person or a company; individual on every client saved before it was asked
  kind: ClientKind
  // Where it sits in the list, dragged into place (lower is higher up); 0 on a client saved before ordering
  position: number
  messageFormat: string
  sampleMessages: string[]
  createdAt: Date
  updatedAt: Date
}

const ClientSchema = new Schema<IClient>(
  {
    ownerId: OWNER_ID,
    name: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    kind: { type: String, enum: CLIENT_KIND_IDS, default: DEFAULT_CLIENT_KIND },
    position: { type: Number, default: 0 },
    messageFormat: { type: String, required: true },
    sampleMessages: { type: [String], default: [] },
  },
  { timestamps: true, collection: "clients" }
)
ClientSchema.index({ position: 1, createdAt: 1 })

export const Client = (mongoose.models.Client as Model<IClient> | undefined) ?? mongoose.model<IClient>("Client", ClientSchema)
