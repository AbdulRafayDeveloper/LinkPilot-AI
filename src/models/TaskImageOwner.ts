import mongoose, { Schema, type Model } from "mongoose"

/**
 * Who each stored attachment belongs to: one row per object an account uploaded. A task image, a
 * client project's voice note or file, and a Post Image brand photo are all named by an id the server
 * made and nothing else, so without this nothing said whose one was, and a record could be saved naming
 * another account's id (it was then shown to that account, and deleted from storage when the record
 * let it go). A save now accepts only ids this list gives to the right account, and a delete only
 * removes objects that are that account's (services/attachmentOwners.ts).
 *
 * The collection is still `task_images`, the name it had while task images were all it held; the
 * rows carry `kind` so one id is never accepted as another kind of attachment.
 */
export const ATTACHMENT_KINDS = ["task-image", "voice-note", "project-file", "brand-photo"] as const
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]

export interface ITaskImageOwner {
  assetId: string
  // The account that uploaded it (a client project's shared link uploads for the project's owner),
  // or for a brand photo the brand settings' scope (`user:<id>`, or `default` for the admins' set)
  ownerId: string
  // Rows written before other kinds existed have none and are task images
  kind: AttachmentKind
  contentType: string
  createdAt: Date
  updatedAt: Date
}

const TaskImageOwnerSchema = new Schema<ITaskImageOwner>(
  {
    assetId: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true, index: true },
    kind: { type: String, enum: ATTACHMENT_KINDS, default: "task-image" },
    contentType: { type: String, required: true },
  },
  { timestamps: true, collection: "task_images" }
)

export const TaskImageOwner =
  (mongoose.models.TaskImageOwner as Model<ITaskImageOwner> | undefined) ?? mongoose.model<ITaskImageOwner>("TaskImageOwner", TaskImageOwnerSchema)
