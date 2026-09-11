import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Conversation } from "@/models/Conversation"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/conversations/[id]: Fetches the full message history of a single conversation
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    await connectDB()
    const doc = await Conversation.findById(id)
    if (!doc) {
      return NextResponse.json({ success: false, message: "Conversation not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: doc })
  } catch (error: any) {
    console.error("GET Conversation Detail Error:", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

/**
 * PATCH /api/conversations/[id]: Renames the conversation title
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { title } = await req.json()
    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, message: "Title is required" }, { status: 400 })
    }

    await connectDB()
    const doc = await Conversation.findByIdAndUpdate(
      id,
      { title: title.trim() },
      { new: true }
    )

    if (!doc) {
      return NextResponse.json({ success: false, message: "Conversation not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: doc })
  } catch (error: any) {
    console.error("PATCH Rename Conversation Error:", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/conversations/[id]: Purges a conversation from the database
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    await connectDB()
    const doc = await Conversation.findByIdAndDelete(id)
    if (!doc) {
      return NextResponse.json({ success: false, message: "Conversation not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Conversation deleted successfully" })
  } catch (error: any) {
    console.error("DELETE Conversation Error:", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
