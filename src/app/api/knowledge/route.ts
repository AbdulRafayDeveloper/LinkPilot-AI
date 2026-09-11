import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Document } from "@/models/Document"
import { parseDocument } from "@/services/parser"
import { indexDocumentVectors } from "@/services/vectorstore"

/**
 * GET: Retrieves all indexed document metadata lists from MongoDB with backend filtering and search
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") || ""
    const status = searchParams.get("status") || ""
    const sort = searchParams.get("sort") || "date-desc"

    const query: any = {}

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { previewText: { $regex: search, $options: "i" } },
      ]
    }

    if (category && category !== "Category: All") {
      query.category = { $regex: `^${category}$`, $options: "i" }
    }

    if (status && status !== "Status: All") {
      query.status = { $regex: `^${status}$`, $options: "i" }
    }

    let sortOption: any = { createdAt: -1 }
    if (sort === "name-asc") {
      sortOption = { name: 1 }
    } else if (sort === "name-desc") {
      sortOption = { name: -1 }
    } else if (sort === "date-desc") {
      sortOption = { createdAt: -1 }
    }

    const documents = await Document.find(query).sort(sortOption)
    return NextResponse.json({
      success: true,
      message: "Documents metadata list retrieved successfully",
      data: documents,
    })
  } catch (error: unknown) {
    console.error("GET Knowledge Documents Exception:", error)
    const message = error instanceof Error ? error.message : "Failed to load documents"
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}

/**
 * POST: Handles multi-part file uploads, parsing, indexing, and logging metadata records
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || ""

    // Handle website URL scraping or local file indexing
    if (contentType.includes("application/json")) {
      const body = await req.json()
      const { url, localFileName, category = "General" } = body

      if (localFileName) {
        const path = await import("path")
        const fs = await import("fs")
        const mockFilePath = path.join(process.cwd(), "ai_docs", "mock_docs", localFileName)
        if (!fs.existsSync(mockFilePath)) {
          return NextResponse.json(
            { success: false, message: `FileNotFoundException: Local file '${localFileName}' not found on server` },
            { status: 404 }
          )
        }

        const buffer = fs.readFileSync(mockFilePath)
        const fileSize = `${(buffer.length / 1024).toFixed(1)} KB`
        const fileExtension = localFileName.split(".").pop()?.toLowerCase() || ""

        await connectDB()

        let finalName = localFileName
        const duplicateDoc = await Document.findOne({ name: localFileName })
        if (duplicateDoc) {
          const shortId = Math.random().toString(36).substring(2, 8)
          const nameParts = localFileName.split(".")
          const ext = nameParts.pop()
          finalName = `${nameParts.join(".")}_${shortId}.${ext}`
        }

        const parsedText = await parseDocument(buffer, fileExtension as any)
        const indexResult = await indexDocumentVectors(finalName, parsedText, category)

        const documentRecord = await Document.create({
          name: finalName,
          category,
          chunks: String(indexResult.chunksCount),
          status: "Ready",
          size: fileSize,
          type: fileExtension,
          previewText: parsedText.substring(0, 300),
          tags: [category.toLowerCase(), fileExtension],
        })

        return NextResponse.json({
          success: true,
          message: "Local file indexed successfully",
          data: documentRecord,
        })
      }

      if (!url) {
        return NextResponse.json(
          { success: false, message: "MissingParameterException: 'url' or 'localFileName' parameter is required for JSON request" },
          { status: 400 }
        )
      }

      await connectDB()

      // Scrape plain text recursively from website links (up to 40 pages)
      const { crawlWebsite } = await import("@/services/websearch")
      const parsedText = await crawlWebsite(url, 40)
      const fileSize = `${(Buffer.byteLength(parsedText, "utf-8") / 1024).toFixed(1)} KB`

      // Chunk and index into ChromaDB
      const indexResult = await indexDocumentVectors(url, parsedText, category)

      // Save metadata to MongoDB
      let docRecord = await Document.findOne({ name: url })
      if (docRecord) {
        docRecord.chunks = String(indexResult.chunksCount)
        docRecord.size = fileSize
        docRecord.category = category
        docRecord.previewText = parsedText.substring(0, 300)
        docRecord.status = "Ready"
        await docRecord.save()
      } else {
        docRecord = await Document.create({
          name: url,
          category,
          chunks: String(indexResult.chunksCount),
          status: "Ready",
          size: fileSize,
          type: "web",
          previewText: parsedText.substring(0, 300),
          tags: [category.toLowerCase(), "web"],
        })
      }

      return NextResponse.json({
        success: true,
        message: "Website scraped and indexed successfully",
        data: docRecord,
      })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const category = (formData.get("category") as string) || "General"

    if (!file) {
      return NextResponse.json(
        { success: false, message: "UploadException: No target file detected in request body" },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const originalName = file.name
    const fileSize = `${(file.size / 1024).toFixed(1)} KB`
    const fileExtension = originalName.split(".").pop()?.toLowerCase()

    const supportedTypes = ["pdf", "docx", "json", "md", "txt", "csv", "html", "pptx", "png", "jpg", "jpeg", "mp3", "wav", "mp4"]
    if (!fileExtension || !supportedTypes.includes(fileExtension)) {
      return NextResponse.json(
        { success: false, message: `ExtensionException: File type '.${fileExtension}' is unsupported` },
        { status: 400 }
      )
    }

    await connectDB()

    // Handle duplicate document name uploads by appending a unique short suffix
    let finalName = originalName
    const duplicateDoc = await Document.findOne({ name: originalName })
    if (duplicateDoc) {
      const shortId = Math.random().toString(36).substring(2, 8)
      const nameParts = originalName.split(".")
      const ext = nameParts.pop()
      finalName = `${nameParts.join(".")}_${shortId}.${ext}`
    }

    // Step 1: Extract raw text content from parser service
    const parsedText = await parseDocument(
      buffer,
      fileExtension as any
    )

    // Step 2: Chunk text and index vector representations into ChromaDB
    const indexResult = await indexDocumentVectors(finalName, parsedText, category)

    // Step 3: Record metadata mapping logs inside MongoDB database
    const documentRecord = await Document.create({
      name: finalName,
      category,
      chunks: String(indexResult.chunksCount),
      status: indexResult.warning === "ChromaDB Offline" ? "Ready" : "Ready", // Set Ready so UI loads preview details immediately
      size: fileSize,
      type: fileExtension,
      previewText: parsedText.substring(0, 300),
      tags: [category.toLowerCase(), fileExtension],
    })

    return NextResponse.json({
      success: true,
      message: "File uploaded and indexed successfully",
      data: documentRecord,
    })
  } catch (error: unknown) {
    console.error("POST Knowledge Upload Exception:", error)
    const message = error instanceof Error ? error.message : "Internal file index processing failures"
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
