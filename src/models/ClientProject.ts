import mongoose, { Schema, type Model } from "mongoose"
import { CLIENT_PROJECT_STATUS_IDS, DEFAULT_CLIENT_PROJECT_STATUS } from "@/constants/clients"
import type { ClientProjectStatus } from "@/constants/clients"
import { OWNER_ID } from "./owner"

/**
 * A project being done for one client (models/Client.ts): its name, what the work is, and whether
 * it is still running. The client it belongs to is held here, on the project, so deleting a project
 * never touches the client and a client's projects are one indexed read.
 *
 * **It is also what a created prompt was written for** (`projectId` on `created_prompts`): the
 * separate `prompt_projects` collection and its `/projects` page are gone, at the owner's request,
 * so a project is made once, under its client. Two fields serve that: `promptInstructions`, which
 * every prompt written for the project ends with, and `folderId`, the Prompt Creator folder those
 * prompts are filed in. Both are optional, so every project saved before this reads as one with no
 * instructions and no folder yet, and gets a folder the next time a prompt is written for it.
 */
export interface IClientProject {
  // The account it belongs to (models/owner.ts)
  ownerId: string | null
  // The client this project is for, as the client's id
  clientId: string
  name: string
  description: string
  status: ClientProjectStatus
  /**
   * The read-only link, if one has been made (lib/projectLink.ts). Nothing secret is stored: the
   * version is what the token is signed with, so a new link stops every earlier one, and turning
   * the link off stops them all without losing which version comes next.
   */
  publicLinkVersion: number
  publicLinkActive: boolean
  // The standing instructions every Prompt Creator prompt written for this project ends with
  promptInstructions: string
  // The Prompt Creator folder its prompts are filed in, which carries the project's name
  folderId: string | null
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
    // Both optional in effect: a project saved before links reads as version 0 with no link on
    publicLinkVersion: { type: Number, default: 0 },
    publicLinkActive: { type: Boolean, default: false },
    promptInstructions: { type: String, default: "" },
    folderId: { type: String, default: null },
  },
  { timestamps: true, collection: "client_projects" }
)
// A client's projects, newest first; the _id keeps the order stable when two share a millisecond
ClientProjectSchema.index({ clientId: 1, createdAt: -1, _id: -1 })

export const ClientProjectModel =
  (mongoose.models.ClientProject as Model<IClientProject> | undefined) ??
  mongoose.model<IClientProject>("ClientProject", ClientProjectSchema)
