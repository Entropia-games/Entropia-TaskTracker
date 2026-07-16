"use client"

import { Check } from "lucide-react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

export const SECTION_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Green", value: "#22c55e" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Gray", value: "#6b7280" },
] as const

interface SectionColorPickerProps {
  currentColor: string | null
  onColorChange: (color: string | null) => void
  children: React.ReactNode
}

export function SectionColorPicker({ currentColor, onColorChange, children }: SectionColorPickerProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {SECTION_COLORS.map((c) => (
          <ContextMenuItem
            key={c.value}
            onClick={() => onColorChange(currentColor === c.value ? null : c.value)}
            className="flex items-center gap-2"
          >
            <span
              className="size-3.5 rounded-full shrink-0 border border-border/50"
              style={{ backgroundColor: c.value }}
            />
            <span className="flex-1">{c.name}</span>
            {currentColor === c.value && <Check className="size-3.5 shrink-0" />}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
}
