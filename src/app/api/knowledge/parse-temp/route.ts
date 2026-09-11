import { NextRequest, NextResponse } from "next/server"
import { parseDocument } from "@/services/parser"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ success: false, message: "No file detected" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || ""

    const parsedText = await parseDocument(buffer, fileExtension as any)

    return NextResponse.json({
      success: true,
      text: parsedText
    })
  } catch (error: any) {
    console.error("Temp file parse exception:", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
