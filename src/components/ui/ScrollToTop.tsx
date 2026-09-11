"use client"

import React, { useState, useEffect } from "react"
import { ArrowUp } from "lucide-react"

export const ScrollToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false)

  // Show button when page is scrolled past 300px
  const toggleVisibility = () => {
    if (window.scrollY > 300) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  useEffect(() => {
    window.addEventListener("scroll", toggleVisibility, { passive: true })
    return () => {
      window.removeEventListener("scroll", toggleVisibility)
    }
  }, [])

  if (!isVisible) return null

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-[90] p-3 bg-primary text-white rounded-full shadow-xl hover:bg-opacity-95 active:scale-95 transition-all duration-200 border border-primary/20 flex items-center justify-center animate-fadeIn focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
      aria-label="Scroll to top"
    >
      <ArrowUp size={20} />
    </button>
  )
}
