"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  MessageSquarePlus,
  Database,
  TrendingUp,
  ShieldCheck,
  X,
  Ghost,
  MessageSquare,
  Edit3,
  Trash2,
  Check,
  MoreHorizontal,
  Search,
} from "lucide-react"
import { SITE_NAME } from "@/config/site"
import { LINKEDIN_TOOLS } from "@/constants/linkedinTools"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onNewChat?: () => void
  isCollapsed?: boolean
  activeConversationId?: string | null
  onSelectConversation?: (id: string | null) => void
  isTemporaryChat?: boolean
  onToggleTemporaryChat?: (val: boolean) => void
  refreshTrigger?: number
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  onNewChat,
  isCollapsed = false,
  activeConversationId = null,
  onSelectConversation,
  isTemporaryChat = false,
  onToggleTemporaryChat,
  refreshTrigger = 0,
}) => {
  const pathname = usePathname()
  const router = useRouter()
  const [conversations, setConversations] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Fetch conversations history
  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/conversations")
      const data = await res.json()
      if (data.success && data.data) {
        setConversations(data.data)
      }
    } catch (err) {
      console.error("Failed to load sidebar conversations history:", err)
    }
  }

  useEffect(() => {
    fetchConversations()
  }, [refreshTrigger, activeConversationId])

  const handleNewChatClick = () => {
    if (onNewChat) {
      onNewChat()
    } else {
      router.push("/")
      if (onSelectConversation) {
        onSelectConversation(null)
      }
    }
    onClose()
  }

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) return
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setEditingId(null)
        fetchConversations()
      }
    } catch (err) {
      console.error("Failed to rename conversation:", err)
    }
  }

  const confirmDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (data.success) {
        if (activeConversationId === id && onSelectConversation) {
          onSelectConversation(null)
        }
        setDeleteConfirmId(null)
        fetchConversations()
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err)
    }
  }

  const isHomeActive = pathname === "/"

  // Filter conversations list based on query
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      {/* Mobile Sidebar Overlay Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-45 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* SideNavBar - Responsive Collapsible Drawer */}
      <aside
        className={`h-screen flex-shrink-0 bg-surface-container-lowest border-r border-outline-variant flex flex-col transition-all duration-300 ease-in-out z-45 ${
          isOpen
            ? "translate-x-0 fixed inset-y-0 left-0 w-[280px]"
            : isCollapsed
            ? "lg:w-0 lg:p-0 lg:overflow-hidden lg:border-none -translate-x-full lg:translate-x-0"
            : "-translate-x-full fixed inset-y-0 left-0 w-[280px] lg:translate-x-0 lg:static p-stack-md"
        }`}
      >
        <div className={`flex flex-col h-full overflow-y-auto custom-scrollbar ${isCollapsed ? "lg:opacity-0 lg:pointer-events-none" : "opacity-100"} transition-opacity duration-200`}>
          {/* Logo Area & Close Button */}
          <div className="flex items-center justify-between mb-6 px-2">
            <Link href="/" className="flex flex-col gap-2 hover:opacity-90 transition-opacity">
              <img
                alt={`${SITE_NAME} Logo`}
                className="w-10 h-10 object-contain"
                src="/logo.png"
              />
              <div>
                <h1 className="font-headline-md text-[18px] font-bold text-primary leading-tight">LinkPilot</h1>
                <p className="font-label-sm text-[10px] text-outline uppercase tracking-wider">AI</p>
              </div>
            </Link>
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 hover:bg-surface-container-high rounded-lg text-on-surface-variant transition-colors"
              aria-label="Close Sidebar"
            >
              <X size={20} />
            </button>
          </div>

          {/* LinkedIn Tools */}
          <div className="border-b border-outline-variant/60 pb-4 mb-4 shrink-0">
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-2 px-2.5">
              LinkedIn Tools
            </p>
            <div className="space-y-0.5">
              {LINKEDIN_TOOLS.map(({ id, title, description, icon: Icon, href }) => {
                const isActive = href !== undefined && pathname === href
                const className = `w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors duration-200 ${
                  isActive
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`
                const content = (
                  <>
                    <Icon size={16} className="shrink-0 mt-0.5" />
                    <span className="min-w-0">
                      <span className={`block text-sm leading-tight truncate ${isActive ? "font-semibold" : "font-medium"}`}>
                        {title}
                      </span>
                      <span className={`block text-[11px] leading-tight mt-0.5 truncate ${isActive ? "text-on-primary-container/80" : "text-outline"}`}>
                        {description}
                      </span>
                    </span>
                  </>
                )
                return href ? (
                  <Link key={id} href={href} onClick={onClose} className={className} aria-current={isActive ? "page" : undefined}>
                    {content}
                  </Link>
                ) : (
                  <button key={id} type="button" className={className}>
                    {content}
                  </button>
                )
              })}
            </div>
          </div>

          {/* New Chat CTA */}
          <button
            onClick={handleNewChatClick}
            className={`flex items-center gap-3 rounded-lg p-2.5 mb-4 transition-all duration-150 active:scale-95 font-label-md w-full justify-start text-sm ${
              isHomeActive && !activeConversationId
                ? "bg-primary-container text-on-primary-container font-semibold"
                : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-high bg-white"
            }`}
          >
            <MessageSquarePlus size={18} />
            <span>New Chat</span>
          </button>

          {/* Navigation Tabs */}
          <nav className="space-y-1">
            <Link
              className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors duration-200 font-label-md text-sm ${
                pathname === "/knowledge-base"
                  ? "bg-primary-container text-on-primary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
              href="/knowledge-base"
              onClick={onClose}
            >
              <Database size={18} />
              <span>Knowledge Base</span>
            </Link>
            <Link
              className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors duration-200 font-label-md text-sm ${
                pathname === "/analytics"
                  ? "bg-primary-container text-on-primary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
              href="/analytics"
              onClick={onClose}
            >
              <TrendingUp size={18} />
              <span>Analytics</span>
            </Link>
            <Link
              className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors duration-200 font-label-md text-sm ${
                pathname === "/inspector"
                  ? "bg-primary-container text-on-primary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
              href="/inspector"
              onClick={onClose}
            >
              <ShieldCheck size={18} />
              <span>Inspector</span>
            </Link>
          </nav>

          {/* Chat History List */}
          <div className="flex-1 flex flex-col min-h-[180px] border-t border-outline-variant/60 mt-4 pt-4 relative">
            <div className="flex items-center justify-between mb-2 px-2.5">
              <label className="text-[10px] font-bold text-outline uppercase tracking-wider">
                Recent Chats
              </label>
            </div>

            {/* Sidebar Chat Search Box */}
            <div className="mb-3 px-2.5 relative flex items-center bg-white border border-outline-variant rounded-lg mx-2.5 py-1">
              <Search size={14} className="text-outline shrink-0 mr-1.5" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none p-0 text-xs w-full text-on-surface focus:ring-0 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-outline-variant hover:text-on-surface">
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredConversations.map((conv) => (
                <div
                  key={conv._id}
                  onClick={() => {
                    if (onSelectConversation) {
                      onSelectConversation(conv._id)
                      router.push("/")
                    }
                    onClose()
                  }}
                  className={`group flex items-center justify-between p-2 rounded-lg text-sm transition-colors duration-150 cursor-pointer font-medium relative ${
                    activeConversationId === conv._id
                      ? "bg-primary-container text-on-primary-container"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare size={15} className="shrink-0 text-outline" />
                    {editingId === conv._id ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(conv._id)
                          if (e.key === "Escape") setEditingId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent border-none p-0 text-sm focus:ring-0 focus:outline-none w-full text-on-surface"
                        autoFocus
                      />
                    ) : (
                      <span className="truncate pr-5">{conv.title}</span>
                    )}
                  </div>

                  {/* Dropdown Action Trigger on hover */}
                  <div className="absolute right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveDropdownId(activeDropdownId === conv._id ? null : conv._id)
                      }}
                      className="p-0.5 hover:bg-surface-container rounded transition-colors"
                      aria-label="Chat options"
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {/* Chat Action Dropdown Menu */}
                    {activeDropdownId === conv._id && (
                      <>
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveDropdownId(null)
                          }}
                          className="fixed inset-0 z-30 cursor-default"
                        />
                        <div className="absolute right-0 top-6 bg-white border border-outline-variant rounded-xl shadow-xl p-1 z-40 min-w-[120px] text-xs font-semibold animate-scaleUp">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingId(conv._id)
                              setEditTitle(conv.title)
                              setActiveDropdownId(null)
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-surface-container rounded-lg text-left text-on-surface"
                          >
                            <Edit3 size={12} className="text-outline" />
                            <span>Rename</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmId(conv._id)
                              setActiveDropdownId(null)
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-surface-container rounded-lg text-left text-red-600"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {filteredConversations.length === 0 && (
                <p className="text-xs text-outline px-2.5 py-4 italic">No chats match search query</p>
              )}
            </div>
          </div>

          {/* Temporary Chat Toggle */}
          <div className="border-t border-outline-variant pt-4 mt-auto">
            <div className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-surface-container-low transition-colors">
              <div className="flex items-center gap-3 text-on-surface-variant">
                <Ghost size={18} className={isTemporaryChat ? "text-primary" : ""} />
                <span className="text-sm font-semibold">Temporary Chat</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onToggleTemporaryChat) {
                    onToggleTemporaryChat(!isTemporaryChat)
                  }
                }}
                className={`w-9 h-5 rounded-full transition-colors relative flex items-center ${
                  isTemporaryChat ? "bg-primary" : "bg-outline-variant"
                }`}
                aria-label="Toggle temporary chat"
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white shadow absolute transition-all duration-150 ${
                    isTemporaryChat ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Custom Deletion Confirmation Popup Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-outline-variant shadow-xl animate-scaleUp">
            <h3 className="text-lg font-bold text-on-surface mb-2">Delete Chat Session?</h3>
            <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
              Are you sure you want to permanently delete this chat session? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deleteConfirmId)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
