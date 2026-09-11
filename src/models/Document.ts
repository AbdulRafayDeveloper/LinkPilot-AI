import mongoose, { Schema, Document as MongooseDocument } from "mongoose"

export interface IDocument extends MongooseDocument {
  name: string
  category: string
  chunks: string
  status: "Ready" | "Processing" | "Error"
  size: string
  type: "pdf" | "docx" | "json" | "md" | "txt" | "csv" | "html" | "web"
  previewText: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

const DocumentSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    chunks: { type: String, required: true, default: "0" },
    status: { type: String, enum: ["Ready", "Processing", "Error"], default: "Processing" },
    size: { type: String, required: true },
    type: { type: String, required: true },
    previewText: { type: String, default: "" },
    tags: { type: [String], default: [] },
  },
  {
    timestamps: true,
  }
)

export const Document =
  mongoose.models.Document || mongoose.model<IDocument>("Document", DocumentSchema)
