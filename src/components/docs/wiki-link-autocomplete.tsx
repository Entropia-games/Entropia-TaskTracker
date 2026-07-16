"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"

interface WikiLinkAutocompleteProps {
  query: string
  position: { top: number; left: number }
  documents: { id: number; title: string }[]
  onSelect: (id: number, title: string) => void
  onClose: () => void
}

export function WikiLinkAutocomplete({
  query,
  position,
  documents,
  onSelect,
  onClose,
}: WikiLinkAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = documents.filter((doc) =>
    doc.title.toLowerCase().includes(query.toLowerCase()),
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const item = el.children[selectedIndex] as HTMLElement
    if (item) item.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex].id, filtered[selectedIndex].title)
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    },
    [filtered, selectedIndex, onSelect, onClose],
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true)
    return () => document.removeEventListener("keydown", handleKeyDown, true)
  }, [handleKeyDown])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest(".wiki-link-autocomplete")) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClick, true)
    return () => document.removeEventListener("mousedown", handleClick, true)
  }, [onClose])

  if (filtered.length === 0) {
    return (
      <div
        className="wiki-link-autocomplete fixed z-50 rounded-md border border-border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md"
        style={{ top: position.top, left: position.left }}
      >
        No matching documents
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      className="wiki-link-autocomplete fixed z-50 max-h-60 w-72 overflow-auto rounded-md border border-border bg-popover shadow-md"
      style={{ top: position.top, left: position.left }}
    >
      {filtered.map((doc, i) => (
        <div
          key={doc.id}
          className={cn(
            "cursor-pointer px-3 py-1.5 text-sm transition-colors",
            i === selectedIndex
              ? "bg-accent text-accent-foreground"
              : "text-foreground hover:bg-accent/50",
          )}
          onMouseEnter={() => setSelectedIndex(i)}
          onClick={() => onSelect(doc.id, doc.title)}
        >
          {doc.title}
        </div>
      ))}
    </div>
  )
}
