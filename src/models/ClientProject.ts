import mongoose, { Schema, type Model } from "mongoose"
import { CLIENT_PROJECT_STATUS_IDS, DEFAULT_CLIENT_PROJECT_STATUS } from "@/constants/clients"
import type { ClientProjectStatus } from "@/constants/clients"
import { OWNER_ID } from "./owner"

/**
 * A project being done for one client (models/Client.ts): its name, what the work is, and whether
 * it is still running. The client it belongs to is held here, on the project, so deleting a project
 * never touches the client and a client's projects are one indexed read.
 *
 * Nothing to do with `prompt_projects` (models/PromptProject.ts), which is what a created prompt was
 * written for.
 */
export interface IClientProject {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  // The client this project is for, as the client's id
  clientId: string
  name: string
  description: string
  status: ClientProjectStatus
  createdAt: Date
  updatedAt: Date
}

const ClientProjectSchema = new Schema<IClientProject>(
  {
    ownerId: OWNER_ID,
    clientId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: CLIENT_PROJECT_STATUS_IDS, default: DEFAULT_CLIENT_PROJECT_STATUS },
  },
  { timestamps: true, collection: "client_projects" }
)
// A client's projects, newest first; the _id keeps the order stable when two share a millisecond
ClientProjectSchema.index({ clientId: 1, createdAt: -1, _id: -1 })

export const ClientProjectModel =
  (mongoose.models.ClientProject as Model<IClientProject> | undefined) ??
  mongoose.model<IClientProject>("ClientProject", ClientProjectSchema)
