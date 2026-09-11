import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Conversation } from "@/models/Conversation"

/**
 * GET /api/conversations: Returns a list of all saved conversations
 */
export async function GET() {
  try {
    await connectDB()
    const list = await Conversation.find({ isTemporary: false })
      .sort({ updatedAt: -1 })
      .select("title createdAt updatedAt")
    
    return NextResponse.json({ success: true, data: list })
  } catch (error: any) {
    console.error("GET Conversations List Error:", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

/**
 * POST /api/conversations: Creates a new conversation session
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json().catch(() => ({}))
    const isTemporary = !!body.isTemporary

    const doc = await Conversation.create({
      title: "New Chat",
      messages: [],
      isTemporary,
    })

    return NextResponse.json({ success: true, data: doc })
  } catch (error: any) {
    console.error("POST Create Conversation Error:", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
