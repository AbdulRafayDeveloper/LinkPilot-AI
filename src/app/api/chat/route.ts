import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { Conversation } from "@/models/Conversation"
import { loadPrompt } from "@/services/prompts"
import { getModel, classifyComplexity } from "@/services/ai"
import { searchRAGContext } from "@/services/rag"
import { searchWeb } from "@/services/websearch"
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages"
import { z } from "zod"

const ChatInputSchema = z.object({
  message: z.string().min(1, "Message is required").max(4000, "Query exceeds maximum limit of 4000 characters"),
  conversationId: z.string().optional(),
  provider: z.enum(["openai", "gemini"]).default("openai"),
  isTemporary: z.boolean().optional().default(false),
  webSearch: z.boolean().optional().default(false),
  attachments: z.array(z.object({
    name: z.string(),
    type: z.string().optional(),
    content: z.string(),
  })).optional().default([]),
})

/**
 * POST: Server-Sent Events (SSE) streaming chatcompletion route
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ChatInputSchema.safeParse(body)
    if (!parsed.success) {
      const errMsg = parsed.error.issues[0]?.message || "ValidationException: Invalid request parameters"
      return NextResponse.json(
        { success: false, message: errMsg },
        { status: 400 }
      )
    }

    const { message, provider, conversationId, isTemporary, webSearch, attachments } = parsed.data

    // Prompt Injection Check (Simple security middleware verification)
    const isSuspicious = /system\s*prompt|ignore\s*previous\s*instruction/gi.test(message)
    if (isSuspicious) {
      return NextResponse.json(
        {
          success: false,
          message: "SecurityException: Input blocked. System guidelines alteration attempts detected.",
        },
        { status: 403 }
      )
    }

    await connectDB()

    // Load conversation history using sliding window (last 10 messages)
    let historyMessages: any[] = []
    if (conversationId && !isTemporary) {
      const conv = await Conversation.findById(conversationId)
      if (conv && conv.messages) {
        const recentMessages = conv.messages.slice(-10)
        historyMessages = recentMessages.map((m: any) => {
          if (m.role === "user") {
            return new HumanMessage(m.content)
          } else {
            return new AIMessage(m.content)
          }
        })
      }
    }

    // Client request cancellation detection
    let isAborted = false
    req.signal.addEventListener("abort", () => {
      isAborted = true
    })

    const encoder = new TextEncoder()
    const customStream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          let contextText = ""
          let sources: any[] = []

          if (webSearch) {
            // Perform Web Search
            send({ status: "WEB_SEARCHING", text: `Searching the web for "${message.substring(0, 30)}..."` })
            const searchHtmlResult = await searchWeb(message)
            contextText = searchHtmlResult

            // Parse searchHtmlResult to extract source links for UI reference
            // Format of results is "[Result #i]\nTitle: t\nSource: s\nSnippet: sn"
            const resultBlocks = searchHtmlResult.split("[Result #")
            resultBlocks.forEach((block) => {
              if (!block.trim()) return
              const lines = block.split("\n")
              let title = ""
              let sourceUrl = ""
              lines.forEach((line) => {
                if (line.startsWith("Title: ")) {
                  title = line.substring(7).trim()
                } else if (line.startsWith("Source: ")) {
                  sourceUrl = line.substring(8).trim()
                  // Prepend protocol if missing
                  if (sourceUrl && !sourceUrl.startsWith("http")) {
                    sourceUrl = "https://" + sourceUrl
                  }
                }
              })
              if (sourceUrl && title) {
                sources.push({
                  source: sourceUrl,
                  score: 1.0,
                  content: title
                })
              }
            })
          } else {
            // Run RAG Search to query vector DB
            send({ status: "RAG_SEARCHING", text: "Searching company documentation..." })
            const ragResult = await searchRAGContext(message)
            contextText = ragResult.contextText
            sources = ragResult.sources
          }

          if (isAborted) {
            controller.close()
            return
          }

          // Step 2: Route by Query Complexity
          send({ status: "ROUTING", text: "Analyzing query complexity..." })
          const complexityTier = await classifyComplexity(message)

          if (isAborted) {
            controller.close()
            return
          }

          // Step 3: Instantiate Model from Factory
          send({ status: "MODEL_SELECTING", text: `Initializing model (Tier: ${complexityTier})...` })
          const model = await getModel(provider, complexityTier)

          if (isAborted) {
            controller.close()
            return
          }

          // Step 4: Parse attached document files
          let attachmentContext = ""
          const textAttachments = attachments.filter(a => a.type !== "image")
          if (textAttachments.length > 0) {
            attachmentContext = textAttachments
              .map(a => `--- START UPLOADED ATTACHMENT: ${a.name} ---\n${a.content}\n--- END UPLOADED ATTACHMENT: ${a.name} ---`)
              .join("\n\n")
          }

          // Step 5: Load Prompt Instructions & construct multimodal user message
          const systemInstruction = loadPrompt("system")
          const promptTemplate = `${systemInstruction}

${attachmentContext ? `\nUPLOADED ATTACHMENT CONTENT:\n${attachmentContext}\n` : ""}
${contextText ? `\nRETRIEVED CONTEXT (RAG/WEB):\n${contextText}\n` : ""}

USER INSTRUCTIONS:
1. Prioritize answering based on the UPLOADED ATTACHMENT CONTENT if the user asks about the attached files.
2. If the information is not found in the attached files, check the RETRIEVED CONTEXT (RAG/WEB).
3. If the information is not in either, answer using your general knowledge but clearly begin or state in your response that the answer comes from general knowledge.`

          send({ status: "GENERATING", text: "Generating response...", sources })

          // Prepare multimodal user content if images exist using explicit HumanMessage array content
          const imageAttachments = attachments.filter(a => a.type === "image")
          let userMessage: HumanMessage
          if (imageAttachments.length > 0) {
            const contentArray: any[] = [{ type: "text", text: message }]
            for (const img of imageAttachments) {
              contentArray.push({
                type: "image_url",
                image_url: { url: img.content }
              })
            }
            userMessage = new HumanMessage({ content: contentArray })
          } else {
            userMessage = new HumanMessage(message)
          }

          // Step 6: Stream Completion Chunks
          const stream = await model.stream([
            new SystemMessage(promptTemplate),
            ...historyMessages,
            userMessage,
          ])

          let assistantText = ""
          for await (const chunk of stream) {
            if (isAborted) {
              break
            }
            const token = typeof chunk.content === "string" ? chunk.content : ""
            if (token) {
              assistantText += token
              send({ token })
            }
          }

          // Step 7: Save Chat history to MongoDB for non-temporary sessions
          if (!isTemporary && !isAborted) {
            if (conversationId) {
              await Conversation.findByIdAndUpdate(conversationId, {
                $push: {
                  messages: [
                    { role: "user", content: message, timestamp: new Date() },
                    { role: "assistant", content: assistantText, sources, timestamp: new Date() }
                  ]
                }
              })
            } else {
              const derivedTitle = message.length > 35 ? message.substring(0, 35) + "..." : message
              const newConv = await Conversation.create({
                title: derivedTitle,
                isTemporary: false,
                messages: [
                  { role: "user", content: message, timestamp: new Date() },
                  { role: "assistant", content: assistantText, sources, timestamp: new Date() }
                ]
              })
              send({ conversationId: newConv._id })
            }
          }

          send({ status: "COMPLETE" })
          controller.close()
        } catch (streamErr: unknown) {
          console.error("Chat streaming inner exception:", streamErr)
          send({
            status: "ERROR",
            text: streamErr instanceof Error ? streamErr.message : "Error streaming response",
          })
          controller.close()
        }
      },
    })

    return new NextResponse(customStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    })
  } catch (error: unknown) {
    console.error("POST Chat Route Exception:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}
