"use client"

import React, { useState, useRef, useEffect } from "react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { SITE_NAME } from "@/config/site"
import {
  Sparkles,
  CreditCard,
  AlertTriangle,
  Key,
  Bug,
  Paperclip,
  Image as ImageIcon,
  ArrowUp,
  Mic,
  MoreHorizontal,
  Globe,
  RefreshCw,
  BookOpen,
  Copy,
  Check,
  X,
  FileText,
  Share2,
} from "lucide-react"

interface PromptItem {
  id: string
  title: string
  desc: string
  category: "Billing" | "DevOps" | "Security" | "Helpdesk"
  icon: React.ReactNode
}

interface MessageItem {
  role: "user" | "assistant"
  content: string
  status?: string
  sources?: Array<{ source: string; score: number; content: string }>
}

interface AttachedFile {
  name: string
  size: string
  type: string
  content: string
  url?: string
}

export default function WelcomePage() {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>("All")
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)

  // Advanced features state
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isTemporaryChat, setIsTemporaryChat] = useState(false)
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const categories = ["All", "Helpdesk", "DevOps", "Security", "Billing"]

  const promptItems: PromptItem[] = [
    {
      id: "1",
      title: "Explain Billing API Authentication",
      desc: "Learn about HMAC signing and secure headers.",
      category: "Billing",
      icon: <CreditCard size={14} />,
    },
    {
      id: "2",
      title: "Deployment keeps failing",
      desc: "Analyze recent CI/CD logs for common bottlenecks.",
      category: "DevOps",
      icon: <AlertTriangle size={14} />,
    },
    {
      id: "3",
      title: "OAuth integration help",
      desc: "Step-by-step guide for third-party SSO setup.",
      category: "Security",
      icon: <Key size={14} />,
    },
    {
      id: "4",
      title: "Debug 403 API Error",
      desc: "Trace permission scopes and access policies.",
      category: "Helpdesk",
      icon: <Bug size={14} />,
    },
  ]

  // Sync isSidebarCollapsed with localStorage to avoid layout shifts
  useEffect(() => {
    const val = localStorage.getItem("isSidebarCollapsed")
    if (val !== null) {
      setIsSidebarCollapsed(val === "true")
    }
  }, [])

  // Auto-scroll to latest messages
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Track recording elapsed time
  useEffect(() => {
    if (isListening) {
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setRecordingSeconds(0)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isListening])

  const formatRecordingTime = (sec: number) => {
    const minutes = Math.floor(sec / 60)
    const seconds = sec % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Toast Helper
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const rec = new SpeechRecognition()
        rec.continuous = false
        rec.interimResults = false
        rec.lang = "en-US"

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          setMessage((prev) => (prev ? prev + " " + transcript : transcript))
          setIsListening(false)
        }

        rec.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error)
          setIsListening(false)
        }

        rec.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current = rec
      }
    }
  }, [])

  const handleToggleCollapse = () => {
    const nextVal = !isSidebarCollapsed
    setIsSidebarCollapsed(nextVal)
    localStorage.setItem("isSidebarCollapsed", String(nextVal))
  }

  // Select an existing conversation and load its history
  const handleSelectConversation = async (id: string | null) => {
    if (!id) {
      setActiveConversationId(null)
      setMessages([])
      return
    }

    try {
      const res = await fetch(`/api/conversations/${id}`)
      const data = await res.json()
      if (data.success && data.data) {
        setActiveConversationId(id)
        setMessages(
          data.data.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
            sources: m.sources,
          }))
        )
      }
    } catch (err) {
      console.error("Error loading conversation:", err)
    }
  }

  const handleNewChat = () => {
    setActiveConversationId(null)
    setMessages([])
    setMessage("")
    setAttachedFiles([])
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }

  // Voice recording toggle
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.")
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setIsListening(true)
      recognitionRef.current.start()
    }
  }

  // File attachments handlers
  const triggerFileSelect = () => fileInputRef.current?.click()
  const triggerImageSelect = () => imageInputRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isImage = false) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const f of Array.from(files)) {
      if (isImage) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const base64 = event.target?.result as string
          setAttachedFiles((prev) => [
            ...prev,
            {
              name: f.name,
              size: `${(f.size / 1024).toFixed(1)} KB`,
              type: "image",
              content: base64,
              url: base64,
            },
          ])
        }
        reader.readAsDataURL(f)
      } else {
        try {
          const formData = new FormData()
          formData.append("file", f)
          const res = await fetch("/api/knowledge/parse-temp", {
            method: "POST",
            body: formData,
          })
          const data = await res.json()
          if (data.success) {
            setAttachedFiles((prev) => [
              ...prev,
              {
                name: f.name,
                size: `${(f.size / 1024).toFixed(1)} KB`,
                type: f.type || "text/plain",
                content: data.text,
              },
            ])
            showToast(`Attached file "${f.name}" loaded successfully!`)
          } else {
            let readableMsg = data.message || "Failed to parse file."
            if (readableMsg.includes("CorruptPDFException") || readableMsg.includes("Invalid PDF structure")) {
              readableMsg = `CorruptPDFException: Failed to parse PDF "${f.name}" - Invalid PDF structure.`
            }
            showToast(readableMsg, "error")
          }
        } catch (err: any) {
          console.error("Error parsing file:", err)
          showToast(`Error parsing file: ${err.message || String(err)}`, "error")
        }
      }
    }

    e.target.value = ""
  }

  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Copy to clipboard helper
  const handleCopyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  // Web Share API helper
  const handleShare = async (text: string) => {
    if (typeof window !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "AI Chat Response",
          text: text,
        })
      } catch (err) {
        console.error("Web Share failed:", err)
      }
    } else {
      navigator.clipboard.writeText(text)
      showToast("Web Share is not supported. Content has been copied to your clipboard!")
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    adjustTextareaHeight()
  }

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  const handleSuggestionClick = (promptText: string) => {
    setMessage(promptText)
    setTimeout(() => {
      adjustTextareaHeight()
      textareaRef.current?.focus()
    }, 50)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() && attachedFiles.length === 0) return
    if (isGenerating) return

    const userQuery = message.trim()
    setMessage("")
    
    const payloadAttachments = attachedFiles.map((f) => ({
      name: f.name,
      type: f.type,
      content: f.content,
    }))
    setAttachedFiles([])
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    const newMessages: MessageItem[] = [...messages, { role: "user", content: userQuery }]
    setMessages(newMessages)
    setIsGenerating(true)

    const assistantIndex = newMessages.length
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", status: "Initializing pipeline..." },
    ])

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userQuery,
          provider: "openai",
          webSearch: webSearchEnabled,
          conversationId: activeConversationId || undefined,
          isTemporary: isTemporaryChat,
          attachments: payloadAttachments,
        }),
      })

      if (!response.body) {
        throw new Error("No response body received")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ""
      let statusText = "Generating..."
      let sources: any[] = []

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6))
              
              if (data.conversationId) {
                setActiveConversationId(data.conversationId)
                setSidebarRefreshTrigger((prev) => prev + 1)
              }
              
              if (data.status) {
                statusText = data.text || statusText
                if (data.sources) {
                  sources = data.sources
                }
              }
              if (data.token) {
                assistantText += data.token
                statusText = ""
              }
              setMessages((prev) => {
                const copy = [...prev]
                if (copy[assistantIndex]) {
                  copy[assistantIndex] = {
                    role: "assistant",
                    content: assistantText,
                    status: statusText || undefined,
                    sources: sources.length > 0 ? sources : undefined,
                  }
                }
                return copy
              })
            } catch {
              // Ignore parsing errors for partial json chunks
            }
          }
        }
      }
    } catch (err: unknown) {
      console.error("Chat completion error:", err)
      setMessages((prev) => {
        const copy = [...prev]
        if (copy[assistantIndex]) {
          copy[assistantIndex] = {
            role: "assistant",
            content: "❌ Failed to connect with system services. Verify that env parameters are loaded.",
          }
        }
        return copy
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Custom Markdown & formatting parser for chat text rendering
  const renderMessageContent = (content: string) => {
    if (!content) return null

    const parts = content.split(/(```[\s\S]*?```)/g)

    return parts.map((part, idx) => {
      if (part.startsWith("```")) {
        const lines = part.split("\n")
        const header = lines[0].replace("```", "").trim() || "code"
        const codeText = lines.slice(1, -1).join("\n")
        return (
          <div key={idx} className="my-3 rounded-lg overflow-hidden border border-outline-variant bg-neutral-900 text-neutral-100 shadow-sm max-w-full">
            <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-800 text-[11px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-700 select-none">
              <span>{header}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(codeText)}
                className="hover:text-white transition-colors"
              >
                Copy code
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed select-text whitespace-pre">
              <code>{codeText}</code>
            </pre>
          </div>
        )
      } else {
        const textLines = part.split("\n")
        return textLines.map((line, lineIdx) => {
          let renderedLine = line

          const boldRegex = /\*\*(.*?)\*\*/g
          const boldParts = renderedLine.split(boldRegex)
          const elements = boldParts.map((bp, bpIdx) => {
            if (bpIdx % 2 === 1) {
              return <strong key={bpIdx} className="font-bold">{bp}</strong>
            }
            return bp
          })

          // Detect headings starting with #, ##, ###
          if (line.startsWith("# ")) {
            return (
              <h1 key={lineIdx} className="text-base md:text-lg font-bold my-3 text-primary border-b border-outline-variant pb-1 leading-tight">
                {elements.slice(1)}
              </h1>
            )
          }

          if (line.startsWith("## ")) {
            return (
              <h2 key={lineIdx} className="text-sm md:text-base font-bold my-2 text-primary leading-snug">
                {elements.slice(1)}
              </h2>
            )
          }

          if (line.startsWith("### ")) {
            return (
              <h3 key={lineIdx} className="text-xs md:text-sm font-bold my-1.5 text-primary leading-normal">
                {elements.slice(1)}
              </h3>
            )
          }

          if (line.startsWith("- ") || line.startsWith("* ")) {
            return (
              <li key={lineIdx} className="list-disc ml-6 my-1 pl-0.5 text-sm leading-relaxed">
                {elements.slice(1)}
              </li>
            )
          }

          if (/^\d+\.\s/.test(line)) {
            const cleanLine = line.replace(/^\d+\.\s/, "")
            const cleanParts = cleanLine.split(boldRegex)
            const cleanElements = cleanParts.map((bp, bpIdx) => {
              if (bpIdx % 2 === 1) {
                return <strong key={bpIdx} className="font-bold">{bp}</strong>
              }
              return bp
            })
            return (
              <li key={lineIdx} className="list-decimal ml-6 my-1 pl-0.5 text-sm leading-relaxed">
                {cleanElements}
              </li>
            )
          }

          if (line.startsWith("|") && line.endsWith("|")) {
            const cols = line.split("|").map(c => c.trim()).filter(c => c !== "")
            if (cols.every(c => c.startsWith("-"))) return null
            return (
              <div key={lineIdx} className="overflow-x-auto my-2">
                <table className="min-w-full border border-collapse border-outline-variant bg-white rounded-lg">
                  <tbody>
                    <tr className="border-b border-outline-variant hover:bg-neutral-50">
                      {cols.map((col, colIdx) => (
                        <td key={colIdx} className="px-4 py-2 border-r border-outline-variant text-xs font-semibold text-on-surface">
                          {col}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          }

          return (
            <p key={lineIdx} className="min-h-[1.2rem] text-sm leading-relaxed mb-1">
              {elements}
            </p>
          )
        })
      }
    })
  }

  const filteredPrompts =
    activeCategory === "All"
      ? promptItems
      : promptItems.filter((p) => p.category === activeCategory)

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      {/* Collapsible Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={handleNewChat}
        isCollapsed={isSidebarCollapsed}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        isTemporaryChat={isTemporaryChat}
        onToggleTemporaryChat={setIsTemporaryChat}
        refreshTrigger={sidebarRefreshTrigger}
      />

      {/* Main Page Layout */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />

        <main className="flex-1 overflow-y-auto relative bg-[#FAF7F2] flex flex-col">
          {messages.length === 0 ? (
            <div className="stage-container flex-1 flex flex-col items-center justify-center px-4 md:px-12 pt-4 pb-8">
              <div className="text-center mb-4 w-full px-2">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-white border border-outline-variant shadow-sm text-primary mb-3">
                  <Sparkles size={22} className="text-primary" />
                </div>
                <h1 className="text-[19px] md:text-[23px] font-bold text-on-surface mb-1.5 leading-tight">
                  Welcome to {SITE_NAME}
                </h1>
                <p className="text-xs md:text-[13.5px] text-on-surface-variant max-w-xl mx-auto leading-relaxed">
                  Your intelligent companion for troubleshooting, technical documentation, and real-time enterprise monitoring. How can I assist you today?
                </p>
              </div>

              {/* Prompt Categories Pills */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all duration-150 active:scale-95 ${
                      activeCategory === cat
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-white text-on-surface-variant border-outline-variant hover:bg-surface-container-low"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Suggested Prompts Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5 w-full max-w-[1100px] mx-auto px-2">
                {filteredPrompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => handleSuggestionClick(prompt.title)}
                    className="suggestion-card flex flex-col p-4 bg-white border border-outline-variant rounded-2xl shadow-sm premium-hover-card text-left group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-surface-container-low text-primary flex items-center justify-center mb-3 group-hover:bg-primary-container group-hover:text-on-primary-container transition-colors">
                      {prompt.icon}
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <p className="font-label-md text-[13px] text-on-surface group-hover:text-primary transition-colors font-semibold leading-snug">
                          {prompt.title}
                        </p>
                        <p className="text-[11px] text-outline-variant mt-1.5 leading-relaxed">
                          {prompt.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Active Chat Thread View */
            <div className="flex-1 w-full max-w-[850px] mx-auto flex flex-col gap-6 py-8 px-4">
              {messages.map((msg, i) => {
                // Filter sources: only render retrieved sources panel if the assistant's content actually references the source name.
                // Or if it cited it in square brackets like [source_name].
                const filteredSources = msg.sources ? msg.sources.filter((src) => {
                  const baseName = src.source.split(/[\\/]/).pop() || src.source
                  if (src.source.startsWith("http")) {
                    const cleanDomain = src.source.replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
                    return msg.content.toLowerCase().includes(baseName.toLowerCase()) || msg.content.toLowerCase().includes(cleanDomain.toLowerCase())
                  }
                  return msg.content.toLowerCase().includes(baseName.toLowerCase())
                }) : []

                return (
                  <div
                    key={i}
                    className={`flex flex-col gap-2 ${
                      msg.role === "user" ? "items-end" : "items-start"
                    } animate-fadeIn`}
                  >
                    <div className="flex flex-col items-start gap-1 max-w-[80%]">
                      <div
                        className={`rounded-2xl px-4 py-3 break-words whitespace-pre-wrap text-sm leading-relaxed shadow-sm ${
                          msg.role === "user"
                            ? "bg-primary text-white"
                            : "bg-white border border-outline-variant text-on-surface"
                        }`}
                      >
                        {msg.status && (
                          <span className="text-xs text-on-surface-variant flex items-center gap-2 mb-1.5 font-semibold">
                            <RefreshCw className="animate-spin text-primary" size={12} />
                            {msg.status}
                          </span>
                        )}
                        {msg.role === "assistant" ? renderMessageContent(msg.content) : msg.content}
                        {!msg.content && isGenerating && i === messages.length - 1 && (
                          <span className="inline-block w-1.5 h-4 bg-primary animate-pulse"></span>
                        )}
                      </div>

                      {/* Copy & Share to Clipboard Triggers - Aligned below response bubble */}
                      {msg.role === "assistant" && msg.content && (
                        <div className="flex items-center gap-2 mt-1.5 ml-2 text-outline-variant">
                          <button
                            onClick={() => handleCopyToClipboard(msg.content, i)}
                            className="p-1 hover:text-primary transition-all rounded hover:bg-surface-container-high"
                            aria-label="Copy to Clipboard"
                            title="Copy to Clipboard"
                          >
                            {copiedIndex === i ? (
                              <Check size={14} className="text-emerald-600 animate-scaleUp" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => handleShare(msg.content)}
                            className="p-1 hover:text-primary transition-all rounded hover:bg-surface-container-high pl-1.5 border-l border-outline-variant/20"
                            aria-label="Share response"
                            title="Share response"
                          >
                            <Share2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Retrieved Sources Card Panel - Only render if filteredSources is non-empty */}
                    {filteredSources.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-1 max-w-[80%] self-start animate-fadeIn">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                          <BookOpen size={10} />
                          Retrieved Sources:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {filteredSources.map((src, srcIdx) => {
                            const isWebLink = src.source.startsWith("http");
                            const cleanUrlLabel = src.source.replace("https://", "").replace("http://", "").replace("www.", "");
                            return isWebLink ? (
                              <a
                                key={srcIdx}
                                href={src.source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white border border-primary/20 p-2 rounded-lg text-[11px] shadow-sm text-primary flex items-center gap-1.5 hover:bg-primary/5 transition-all cursor-pointer font-semibold"
                                title={src.source}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                <span className="truncate max-w-[180px]">{cleanUrlLabel}</span>
                              </a>
                            ) : (
                              <div
                                key={srcIdx}
                                className="bg-white border border-outline-variant p-2 rounded-lg text-[11px] shadow-sm text-on-surface flex items-center gap-1.5 hover:border-primary transition-colors cursor-pointer"
                                title={`Similarity Score: ${src.score.toFixed(3)}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span className="font-semibold truncate max-w-[120px]">{src.source.split(/[\\/]/).pop()}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Footer Area with Centered Chat Composer */}
        <div className="flex-shrink-0 px-4 md:px-8 pb-6 pt-2 bg-[#FAF7F2] w-full">
          <form onSubmit={handleSendMessage} className="w-full max-w-[800px] mx-auto">
            {/* Attached Files Preview Panel */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 p-2 bg-white border border-outline-variant rounded-xl max-h-32 overflow-y-auto">
                {attachedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-xs font-semibold relative group animate-scaleUp"
                  >
                    {file.url && file.type === "image" ? (
                      <img src={file.url} alt="Attached Preview" className="w-5 h-5 rounded object-cover shrink-0" />
                    ) : (
                      <FileText size={14} className="text-primary shrink-0" />
                    )}
                    <span className="truncate max-w-[120px] text-on-surface-variant">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachedFile(idx)}
                      className="p-0.5 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-red-600 transition-colors"
                      aria-label="Remove Attachment"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-2xl composer-shadow border border-outline-variant p-2 flex flex-col gap-2 relative focus-within:ring-2 focus-within:ring-primary focus-within:ring-opacity-20">
              <div className="flex items-start gap-4 px-3 pt-2">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={handleInputChange}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-body-md font-body-md resize-none min-h-[50px] max-h-[160px] outline-none"
                  placeholder={
                    isListening
                      ? `Listening (${formatRecordingTime(recordingSeconds)})... Speak now.`
                      : `Message ${SITE_NAME}...`
                  }
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage(e)
                    }
                  }}
                />
              </div>

              {/* Input Helper Attachments */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileChange(e, false)}
                className="hidden"
                accept=".pdf,.docx,.txt,.md,.csv,.json,.html"
              />
              <input
                type="file"
                ref={imageInputRef}
                onChange={(e) => handleFileChange(e, true)}
                className="hidden"
                accept="image/*"
              />

              <div className="flex items-center justify-between px-3 pb-2 relative">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={triggerFileSelect}
                    className="p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary rounded-lg transition-colors flex items-center justify-center font-semibold text-sm"
                    aria-label="Attach File"
                    title="Attach File"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={triggerImageSelect}
                    className="p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary rounded-lg transition-colors flex items-center justify-center font-semibold text-sm"
                    aria-label="Upload Image"
                    title="Upload Image"
                  >
                    <ImageIcon size={18} />
                  </button>

                  {/* Three Dots Menu Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsMoreDropdownOpen(!isMoreDropdownOpen)}
                      className={`p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary rounded-lg transition-colors flex items-center justify-center ${
                        isMoreDropdownOpen ? "bg-surface-container text-primary" : ""
                      }`}
                      aria-label="More Options"
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    {/* More Dropdown Menu */}
                    {isMoreDropdownOpen && (
                      <>
                        <div onClick={() => setIsMoreDropdownOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                        <div className="absolute bottom-10 left-0 bg-white border border-outline-variant rounded-xl shadow-xl p-1.5 min-w-[180px] z-50 animate-scaleUp">
                          <button
                            type="button"
                            onClick={() => {
                              setWebSearchEnabled(!webSearchEnabled)
                              setIsMoreDropdownOpen(false)
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors text-left ${
                              webSearchEnabled ? "bg-primary/5 text-primary" : "text-on-surface hover:bg-surface-container-low"
                            }`}
                          >
                            <Globe size={14} className={webSearchEnabled ? "text-primary" : "text-on-surface-variant"} />
                            <span>Web Search {webSearchEnabled ? "(Enabled)" : ""}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  {/* Voice Input Microphone Button */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`p-2 rounded-lg transition-all flex items-center justify-center mr-1 ${
                      isListening
                        ? "bg-red-50 text-red-600 border border-red-200 animate-pulse animate-duration-1000"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-primary"
                    }`}
                    aria-label="Voice Input"
                    title={isListening ? "Stop listening" : "Start Voice Input"}
                  >
                    <Mic size={18} />
                  </button>

                  <button
                    type="submit"
                    className="bg-primary text-white rounded-xl h-10 w-10 flex items-center justify-center hover:bg-[#004741] transition-all active:scale-95 shadow-sm"
                    aria-label="Send Message"
                  >
                    <ArrowUp size={18} />
                  </button>
                </div>
              </div>
            </div>
            <p className="text-center mt-3 font-label-sm text-label-sm text-outline-variant">
              AI-generated content may require human verification.
            </p>
          </form>
        </div>
      </div>

      {/* HTML Toast Notifier */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold animate-scaleUp z-50 flex items-center gap-2.5 transition-all ${
          toast.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
