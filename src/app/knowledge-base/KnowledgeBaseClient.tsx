"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import {
  Upload,
  Filter,
  ArrowUpDown,
  Search,
  Eye,
  RefreshCw,
  Trash2,
  X,
  UploadCloud,
  FileText,
  FileCode,
  FileJson,
  AlertTriangle,
  Globe,
  Image as ImageIcon,
  Music,
  Video,
  Presentation,
} from "lucide-react"

interface DocItem {
  id: string
  name: string
  category: string
  chunks: string
  status: "Ready" | "Processing" | "Error"
  size: string
  type: "pdf" | "docx" | "json" | "md" | "txt" | "csv" | "html" | "web" | "pptx" | "png" | "jpg" | "jpeg" | "mp3" | "wav" | "mp4"
  uploadDate: string
  previewText: string
  tags: string[]
  createdAt?: string
}

export default function HistoryPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [docs, setDocs] = useState<DocItem[]>([])
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("Category: All")
  const [selectedStatus, setSelectedStatus] = useState("Status: All")
  const [sortOrder, setSortOrder] = useState<"date-desc" | "name-asc" | "name-desc">("date-desc")
  const [uploadCategory, setUploadCategory] = useState("General")
  const [totalDocsCount, setTotalDocsCount] = useState(0)
  const [totalChunksCount, setTotalChunksCount] = useState(0)
  const [totalStorageStr, setTotalStorageStr] = useState("0 KB")
  const [lastIndexTime, setLastIndexTime] = useState("Never")
  const [isPageLoading, setIsPageLoading] = useState(true)

  // Website scraping states
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [websiteCategory, setWebsiteCategory] = useState("General")

  // Sync isSidebarCollapsed with localStorage to avoid layout shifts
  useEffect(() => {
    const val = localStorage.getItem("isSidebarCollapsed")
    if (val !== null) {
      setIsSidebarCollapsed(val === "true")
    }
  }, [])

  const handleToggleCollapse = () => {
    const nextVal = !isSidebarCollapsed
    setIsSidebarCollapsed(nextVal)
    localStorage.setItem("isSidebarCollapsed", String(nextVal))
  }

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [docToDeleteId, setDocToDeleteId] = useState<string | null>(null)

  // Upload and pagination states
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // Pre-upload list preview states
  const [selectedFilesToUpload, setSelectedFilesToUpload] = useState<File[]>([])
  const [isUploadPreviewModalOpen, setIsUploadPreviewModalOpen] = useState(false)
  const [invalidFilesWarning, setInvalidFilesWarning] = useState<string | null>(null)

  const fetchGlobalStats = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge")
      const data = await res.json()
      if (data.success && data.data) {
        setTotalDocsCount(data.data.length)
        const chunksSum = data.data.reduce((acc: number, d: any) => acc + parseInt(d.chunks || "0", 10), 0)
        setTotalChunksCount(chunksSum)
        
        let totalKB = 0
        data.data.forEach((doc: any) => {
          const sizeStr = doc.size || "0 KB"
          const val = parseFloat(sizeStr)
          if (sizeStr.includes("MB")) {
            totalKB += val * 1024
          } else if (sizeStr.includes("GB")) {
            totalKB += val * 1024 * 1024
          } else {
            totalKB += val
          }
        })
        let sizeFormatted = "0 KB"
        if (totalKB > 0) {
          if (totalKB < 1024) sizeFormatted = `${totalKB.toFixed(1)} KB`
          else {
            const totalMB = totalKB / 1024
            if (totalMB < 1024) sizeFormatted = `${totalMB.toFixed(1)} MB`
            else sizeFormatted = `${(totalMB / 1024).toFixed(1)} GB`
          }
        }
        setTotalStorageStr(sizeFormatted)

        if (data.data.length > 0) {
          const dates = data.data.map((d: any) => new Date(d.updatedAt || d.createdAt || 0).getTime())
          const maxDate = new Date(Math.max(...dates))
          const diffMs = Date.now() - maxDate.getTime()
          const diffMins = Math.floor(diffMs / 60000)
          let relativeTime = ""
          if (diffMins < 1) relativeTime = "Just now"
          else if (diffMins === 1) relativeTime = "1 min ago"
          else if (diffMins < 60) relativeTime = `${diffMins} mins ago`
          else {
            const diffHours = Math.floor(diffMins / 60)
            if (diffHours === 1) relativeTime = "1 hour ago"
            else if (diffHours < 24) relativeTime = `${diffHours} hours ago`
            else relativeTime = maxDate.toLocaleDateString()
          }
          setLastIndexTime(relativeTime)
        } else {
          setLastIndexTime("Never")
        }
      } else {
        setTotalDocsCount(0)
        setTotalChunksCount(0)
        setTotalStorageStr("0 KB")
        setLastIndexTime("Never")
      }
    } catch (err) {
      console.error("Failed to load global stats:", err)
    }
  }, [])

  const fetchDocs = useCallback(async () => {
    try {
      setIsPageLoading(true)
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      if (selectedCategory && selectedCategory !== "Category: All") params.append("category", selectedCategory)
      if (selectedStatus && selectedStatus !== "Status: All") params.append("status", selectedStatus)
      if (sortOrder) params.append("sort", sortOrder)

      const res = await fetch(`/api/knowledge?${params.toString()}`)
      const data = await res.json()
      if (data.success && data.data) {
        const mapped: DocItem[] = data.data.map((d: any) => ({
          id: d._id,
          name: d.name,
          category: d.category,
          chunks: d.chunks,
          status: d.status,
          size: d.size,
          type: d.type,
          uploadDate: new Date(d.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          previewText: d.previewText,
          tags: d.tags || [],
          createdAt: d.createdAt,
        }))
        setDocs(mapped)
        if (mapped.length > 0) {
          setSelectedDoc((current) => {
            if (current && mapped.some(m => m.id === current.id)) {
              return mapped.find(m => m.id === current.id) || current
            }
            return mapped[0]
          })
        } else {
          setSelectedDoc(null)
        }
      }
    } catch (err) {
      console.error("Failed to load documents catalog:", err)
    } finally {
      setIsPageLoading(false)
    }
  }, [searchQuery, selectedCategory, selectedStatus, sortOrder])

  // Fetch document lists and update global stats from the API on query changes
  useEffect(() => {
    fetchDocs()
    fetchGlobalStats()
  }, [fetchDocs, fetchGlobalStats])

  const getFileIcon = (type: DocItem["type"]) => {
    switch (type) {
      case "pdf":
        return <FileText className="text-red-500 flex-shrink-0" size={20} />
      case "docx":
        return <FileText className="text-blue-500 flex-shrink-0" size={20} />
      case "json":
        return <FileJson className="text-amber-500 flex-shrink-0" size={20} />
      case "web":
        return <Globe className="text-primary flex-shrink-0" size={20} />
      case "pptx":
        return <Presentation className="text-orange-500 flex-shrink-0" size={20} />
      case "png":
      case "jpg":
      case "jpeg":
        return <ImageIcon className="text-purple-500 flex-shrink-0" size={20} />
      case "mp3":
      case "wav":
        return <Music className="text-pink-500 flex-shrink-0" size={20} />
      case "mp4":
        return <Video className="text-rose-500 flex-shrink-0" size={20} />
      case "md":
      default:
        return <FileCode className="text-emerald-600 flex-shrink-0" size={20} />
    }
  }

  const triggerDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDocToDeleteId(id)
    setIsDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!docToDeleteId) return
    try {
      const res = await fetch(`/api/knowledge/${docToDeleteId}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (data.success) {
        const updated = docs.filter((d) => d.id !== docToDeleteId)
        setDocs(updated)
        if (selectedDoc?.id === docToDeleteId) {
          setSelectedDoc(updated.length > 0 ? updated[0] : null)
        }
        fetchGlobalStats()
      }
    } catch (err) {
      console.error("Failed to delete document:", err)
    }
    setIsDeleteModalOpen(false)
    setDocToDeleteId(null)
  }

  const handleReindex = async (id: string) => {
    try {
      setIsUploading(true)
      setUploadProgress(20)
      const res = await fetch(`/api/knowledge/${id}`, {
        method: "PUT",
      })
      setUploadProgress(70)
      const data = await res.json()
      if (data.success && data.data) {
        setDocs(prev => prev.map(d => {
          if (d.id === id) {
            return {
              ...d,
              chunks: data.data.chunks,
              size: data.data.size,
              status: data.data.status,
              previewText: data.data.previewText,
              uploadDate: new Date(data.data.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            }
          }
          return d
        }))
        setSelectedDoc((current) => {
          if (current?.id === id) {
            return {
              ...current,
              chunks: data.data.chunks,
              size: data.data.size,
              status: data.data.status,
              previewText: data.data.previewText,
              uploadDate: new Date(data.data.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            }
          }
          return current
        })
        fetchGlobalStats()
      }
      setUploadProgress(100)
      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
      }, 500)
    } catch (err) {
      console.error("Failed to re-index document:", err)
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const validExtensions = [".pdf", ".docx", ".txt", ".json", ".md", ".csv", ".html", ".pptx"]
    const validMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/json",
      "text/markdown",
      "text/x-markdown",
      "text/csv",
      "text/html",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ]

    const accepted: File[] = []
    const rejectedNames: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
      const isValidExt = validExtensions.includes(ext)
      const isValidMime = validMimeTypes.includes(file.type) || file.type.startsWith("text/")

      if (isValidExt && (isValidMime || ext === ".md" || ext === ".json" || ext === ".pptx")) {
        accepted.push(file)
      } else {
        rejectedNames.push(file.name)
      }
    }

    if (rejectedNames.length > 0) {
      setInvalidFilesWarning(
        `Rejected files: ${rejectedNames.join(", ")}. Only PDF, DOCX, TXT, MD, CSV, JSON, HTML, and PPTX are allowed.`
      )
    } else {
      setInvalidFilesWarning(null)
    }

    if (accepted.length > 0) {
      setSelectedFilesToUpload(accepted)
      setIsUploadPreviewModalOpen(true)
    }
  }

  const handleImageSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const validExtensions = [".png", ".jpg", ".jpeg"]
    const accepted: File[] = []
    const rejectedNames: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
      if (validExtensions.includes(ext)) {
        accepted.push(file)
      } else {
        rejectedNames.push(file.name)
      }
    }

    if (rejectedNames.length > 0) {
      setInvalidFilesWarning(
        `Rejected files: ${rejectedNames.join(", ")}. Only PNG, JPG, and JPEG images are allowed.`
      )
    } else {
      setInvalidFilesWarning(null)
    }

    if (accepted.length > 0) {
      setSelectedFilesToUpload(accepted)
      setIsUploadPreviewModalOpen(true)
    }
  }

  const handleAudioSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const validExtensions = [".mp3", ".wav"]
    const accepted: File[] = []
    const rejectedNames: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
      if (validExtensions.includes(ext)) {
        accepted.push(file)
      } else {
        rejectedNames.push(file.name)
      }
    }

    if (rejectedNames.length > 0) {
      setInvalidFilesWarning(
        `Rejected files: ${rejectedNames.join(", ")}. Only MP3 and WAV audios are allowed.`
      )
    } else {
      setInvalidFilesWarning(null)
    }

    if (accepted.length > 0) {
      setSelectedFilesToUpload(accepted)
      setIsUploadPreviewModalOpen(true)
    }
  }

  const handleVideoSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const validExtensions = [".mp4"]
    const accepted: File[] = []
    const rejectedNames: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
      if (validExtensions.includes(ext)) {
        accepted.push(file)
      } else {
        rejectedNames.push(file.name)
      }
    }

    if (rejectedNames.length > 0) {
      setInvalidFilesWarning(
        `Rejected files: ${rejectedNames.join(", ")}. Only MP4 videos are allowed.`
      )
    } else {
      setInvalidFilesWarning(null)
    }

    if (accepted.length > 0) {
      setSelectedFilesToUpload(accepted)
      setIsUploadPreviewModalOpen(true)
    }
  }

  const handleConfirmUpload = async () => {
    setIsUploadPreviewModalOpen(false)
    if (selectedFilesToUpload.length === 0) return

    setIsUploading(true)
    setUploadProgress(10)

    try {
      for (let i = 0; i < selectedFilesToUpload.length; i++) {
        const file = selectedFilesToUpload[i]
        setUploadProgress(Math.round(((i + 0.5) / selectedFilesToUpload.length) * 100))

        let res
        if (file.size > 4.2 * 1024 * 1024) {
          // Large file bypass: index directly from server disk to bypass Vercel 4.5MB payload limit
          res = await fetch("/api/knowledge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              localFileName: file.name,
              category: uploadCategory,
            }),
          })
        } else {
          const formData = new FormData()
          formData.append("file", file)
          formData.append("category", uploadCategory)
          res = await fetch("/api/knowledge", {
            method: "POST",
            body: formData,
          })
        }

        const data = await res.json()
        if (!data.success) {
          console.error("Failed to upload file:", file.name, data.message)
        }
      }
      setUploadProgress(100)
      setSelectedFilesToUpload([])
      fetchDocs()
      fetchGlobalStats()
      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
      }, 800)
    } catch (err) {
      console.error("Index compilation request failed:", err)
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  // Scrape and Index website URL link
  const handleAddWebsite = async () => {
    if (!websiteUrl.trim()) return
    if (!websiteUrl.startsWith("http://") && !websiteUrl.startsWith("https://")) {
      alert("Please enter a valid URL starting with http:// or https://")
      return
    }

    try {
      setIsUploading(true)
      setUploadProgress(30)
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: websiteUrl.trim(),
          category: websiteCategory,
        }),
      })
      setUploadProgress(80)
      const data = await res.json()
      if (data.success) {
        setWebsiteUrl("")
        fetchDocs()
        fetchGlobalStats()
      } else {
        alert(data.message || "Failed to index website URL.")
      }
    } catch (err) {
      console.error("Failed to add website:", err)
      alert("Network error while trying to scrape website.")
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  // Pagination filters calculation
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const filteredDocs = docs
  const paginatedDocs = filteredDocs.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredDocs.length / itemsPerPage)

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      {/* Collapsible Sidebar component */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
      />

      {/* Main Page Layout Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        {/* Shared Header Component */}
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />

        {/* Content Stage */}
        <main className="flex-1 overflow-y-auto bg-[#FAF7F2] overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
            {/* Header & CTA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
              <div>
                <h1 className="text-2xl md:text-headline-lg font-bold text-on-surface">Knowledge Base</h1>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  Manage company documentation and website resources used by the AI assistant.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelection}
                  multiple
                  className="hidden"
                  accept=".pdf,.docx,.txt,.json,.md,.csv,.html,.pptx"
                />
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageSelection}
                  multiple
                  className="hidden"
                  accept=".png,.jpg,.jpeg"
                />
                <input
                  type="file"
                  ref={audioInputRef}
                  onChange={handleAudioSelection}
                  multiple
                  className="hidden"
                  accept=".mp3,.wav"
                />
                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={handleVideoSelection}
                  multiple
                  className="hidden"
                  accept=".mp4"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-primary hover:bg-opacity-95 text-white px-4 py-2.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 duration-150 text-xs shrink-0"
                >
                  <Upload size={14} />
                  <span>Upload Documents</span>
                </button>

                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="bg-secondary hover:bg-opacity-95 text-white px-4 py-2.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 duration-150 text-xs shrink-0 bg-indigo-600 hover:bg-indigo-700"
                >
                  <ImageIcon size={14} />
                  <span>Upload Images</span>
                </button>

                <button
                  onClick={() => audioInputRef.current?.click()}
                  className="bg-accent hover:bg-opacity-95 text-white px-4 py-2.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 duration-150 text-xs shrink-0 bg-pink-600 hover:bg-pink-700"
                >
                  <Music size={14} />
                  <span>Upload Audios</span>
                </button>

                {/*
                <button
                  onClick={() => videoInputRef.current?.click()}
                  className="bg-neutral-800 hover:bg-neutral-900 text-white px-4 py-2.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 duration-150 text-xs shrink-0"
                >
                  <Video size={14} />
                  <span>Upload Videos</span>
                </button>
                */}
              </div>
            </div>

            {/* Inline Website Scraper Card Panel */}
            <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-sm flex flex-col md:flex-row items-center gap-3">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5 block">
                  Add Website URL to Knowledge Base
                </label>
                <div className="relative flex items-center bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5">
                  <input
                    type="text"
                    placeholder="https://example.com/documentation"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="bg-transparent border-none text-xs w-full text-on-surface focus:ring-0 focus:outline-none font-medium"
                  />
                </div>
              </div>
              <div className="w-full md:w-auto flex items-end gap-3 mt-2 md:mt-0">
                <div className="flex-1 md:flex-initial">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5 block">
                    Category
                  </label>
                  <select
                    value={websiteCategory}
                    onChange={(e) => setWebsiteCategory(e.target.value)}
                    className="border border-outline-variant rounded-lg text-xs bg-white px-3 py-2 text-on-surface outline-none focus:border-primary min-w-[120px] font-medium"
                  >
                    <option value="General">General</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddWebsite}
                  className="bg-primary hover:bg-opacity-95 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 duration-150 shrink-0"
                >
                  Add Website
                </button>
              </div>
            </div>

            {isUploading && (
              <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-sm flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-primary flex items-center gap-2">
                    <RefreshCw className="animate-spin text-primary" size={16} />
                    Indexing data source...
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-surface-container-low h-2.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}

            {/* Bento Grid Analytics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-sm">
                <p className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Total Docs</p>
                <p className="text-xl md:text-headline-md font-bold mt-1">{totalDocsCount}</p>
              </div>
              <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-sm">
                <p className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Total Chunks</p>
                <p className="text-xl md:text-headline-md font-bold mt-1 text-primary">
                  {totalChunksCount}
                </p>
              </div>
              <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-sm col-span-1">
                <p className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Model</p>
                <p className="text-xs font-code mt-2 px-2 py-1 bg-surface-container-low rounded inline-block text-on-surface-variant font-mono">
                  text-embedding-ada-002
                </p>
              </div>
              <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-sm">
                <p className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Vector DB</p>
                <p className="text-xl md:text-headline-md font-bold mt-1">ChromaDB</p>
              </div>
              <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-sm">
                <p className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Last Index</p>
                <p className="text-sm font-semibold mt-1.5 flex items-center gap-1.5 text-on-surface">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                  <span>{lastIndexTime}</span>
                </p>
              </div>
              <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-sm">
                <p className="font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Storage</p>
                <p className="text-xl md:text-headline-md font-bold mt-1">
                  {totalStorageStr}
                </p>
              </div>
            </div>
 
            {/* Document Management Area */}
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Main Table Content */}
              <div className="flex-1 w-full space-y-4 min-w-0">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-outline-variant shadow-sm">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      className="w-full pl-10 border-none bg-transparent focus:ring-0 text-sm focus:outline-none text-on-surface"
                      placeholder="Filter documents..."
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <select 
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="border border-outline-variant rounded-lg text-sm bg-transparent px-3 py-1.5 text-on-surface outline-none focus:border-primary font-semibold"
                  >
                    <option value="Category: All">Category: All</option>
                    <option value="General">General</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                  <select 
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="border border-outline-variant rounded-lg text-sm bg-transparent px-3 py-1.5 text-on-surface outline-none focus:border-primary font-semibold"
                  >
                    <option value="Status: All">Status: All</option>
                    <option value="Ready">Ready</option>
                    <option value="Processing">Processing</option>
                    <option value="Error">Error</option>
                  </select>
                  <button 
                    onClick={() => {
                      setSortOrder(prev => {
                        if (prev === "date-desc") return "name-asc"
                        if (prev === "name-asc") return "name-desc"
                        return "date-desc"
                      })
                    }}
                    className="p-2 border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors text-on-surface-variant flex items-center gap-1.5 text-xs font-semibold"
                    title={`Sorting: ${sortOrder}`}
                  >
                    <ArrowUpDown size={16} />
                    <span className="capitalize">{sortOrder.replace("-", " ")}</span>
                  </button>
                </div>

                {/* Responsive Table Wrapper */}
                <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-x-auto w-full max-w-full">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-surface-container-low border-b border-outline-variant">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Resource Name</th>
                        <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Category</th>
                        <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Chunks</th>
                        <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Size</th>
                        <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {isPageLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-surface-container-high" />
                                <div className="h-3.5 w-40 rounded bg-surface-container-high" />
                              </div>
                            </td>
                            <td className="px-6 py-4"><div className="h-3 w-20 rounded bg-surface-container-high" /></td>
                            <td className="px-6 py-4"><div className="h-3 w-8 rounded bg-surface-container-high" /></td>
                            <td className="px-6 py-4"><div className="h-5 w-16 rounded-full bg-surface-container-high" /></td>
                            <td className="px-6 py-4"><div className="h-3 w-12 rounded bg-surface-container-high" /></td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <div className="h-6 w-6 rounded bg-surface-container-high" />
                                <div className="h-6 w-6 rounded bg-surface-container-high" />
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        paginatedDocs.map((doc) => (
                        <tr
                          key={doc.id}
                          onClick={() => setSelectedDoc(doc)}
                          className={`hover:bg-surface-container-low/50 transition-colors group cursor-pointer ${
                            selectedDoc?.id === doc.id ? "bg-primary/5" : ""
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3 overflow-hidden">
                              {getFileIcon(doc.type)}
                              <span className="text-sm font-semibold text-on-surface truncate" title={doc.name}>
                                {doc.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant truncate">
                            {doc.category}
                          </td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant">
                            {doc.chunks}
                          </td>
                          <td className="px-6 py-4">
                            <span
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold inline-block ${
                                  doc.status === "Ready"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : doc.status === "Processing"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {doc.status}
                              </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant">
                            {doc.size}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2 text-on-surface-variant">
                              {doc.type === "web" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleReindex(doc.id)
                                  }}
                                  className="p-1 hover:text-primary transition-colors"
                                  title="Re-index Website"
                                  aria-label="Re-index Website"
                                >
                                  <RefreshCw size={16} />
                                </button>
                              )}
                              <button
                                onClick={(e) => triggerDelete(doc.id, e)}
                                className="p-1 hover:text-red-600 transition-colors"
                                aria-label="Delete document"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        ))
                      )}
                      {!isPageLoading && filteredDocs.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                            No documents or websites found matching the filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-55"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-on-surface-variant font-semibold">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-55"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              {/* Right Panel: Document Details & Text Preview */}
              {selectedDoc && (
                <div className="w-full lg:w-[360px] bg-white border border-outline-variant rounded-xl shadow-sm p-5 space-y-6 flex-shrink-0 animate-fadeIn">
                  <div className="flex items-start justify-between border-b border-outline-variant pb-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-on-surface truncate" title={selectedDoc.name}>
                        {selectedDoc.name}
                      </h3>
                      <p className="text-[10px] text-outline uppercase tracking-wider mt-1">{selectedDoc.category}</p>
                    </div>
                    {getFileIcon(selectedDoc.type)}
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                      <div>
                        <p className="text-[10px] font-bold text-outline-variant uppercase tracking-wider mb-0.5">Chunks Count</p>
                        <p className="font-semibold text-on-surface">{selectedDoc.chunks}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-outline-variant uppercase tracking-wider mb-0.5">File Size</p>
                        <p className="font-semibold text-on-surface">{selectedDoc.size}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-outline-variant uppercase tracking-wider mb-0.5">Indexed Status</p>
                        <p className="font-semibold text-on-surface">{selectedDoc.status}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-outline-variant uppercase tracking-wider mb-0.5">Upload Date</p>
                        <p className="font-semibold text-on-surface">{selectedDoc.uploadDate}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-outline-variant">
                      <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-2">Content Preview Summary</p>
                      <p className="text-on-surface-variant leading-relaxed bg-[#FAF7F2] p-3 rounded-lg border border-outline-variant/60 italic">
                        &quot;{selectedDoc.previewText || "Parsing in progress..."}&quot;
                      </p>
                    </div>

                    {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                      <div className="pt-4 border-t border-outline-variant">
                        <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-2">Metadata Tags</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDoc.tags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 bg-surface-container-low text-on-surface-variant border border-outline-variant/60 rounded-full text-[10px] font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-outline-variant shadow-xl animate-scaleUp">
            <h3 className="text-lg font-bold text-on-surface mb-2">Delete Data Source?</h3>
            <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
              Are you sure you want to permanently delete this resource from the Knowledge Base? This will purge its vector references from ChromaDB.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false)
                  setDocToDeleteId(null)
                }}
                className="flex-1 py-2 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-upload List Preview Modal */}
      {isUploadPreviewModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-outline-variant shadow-xl animate-scaleUp">
            <h3 className="text-lg font-bold text-on-surface mb-2">Confirm Files Upload</h3>
            <p className="text-xs text-on-surface-variant mb-4">
              Select category and verify the following selected files before indexing:
            </p>
            
            <div className="mb-4">
              <label className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5 block">
                Assign Category
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full border border-outline-variant rounded-lg text-sm bg-white px-3 py-2 text-on-surface outline-none focus:border-primary font-semibold"
              >
                <option value="General">General</option>
                <option value="Engineering">Engineering</option>
                <option value="Operations">Operations</option>
                <option value="Finance">Finance</option>
                <option value="Marketing">Marketing</option>
              </select>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-2 border border-outline-variant rounded-xl p-3 bg-[#FAF7F2] mb-6">
              {selectedFilesToUpload.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs font-semibold text-on-surface-variant">
                  <span className="truncate pr-3">{file.name}</span>
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsUploadPreviewModalOpen(false)
                  setSelectedFilesToUpload([])
                }}
                className="flex-grow py-2 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                className="flex-grow py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-opacity-95 transition-all"
              >
                Start Indexing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
