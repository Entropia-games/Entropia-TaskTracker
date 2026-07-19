"use client"

import { useState } from "react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const deptColors: Record<string, string> = {
  "3D": "text-red-400",
  Concept: "text-blue-400",
  DEV: "text-purple-400",
  QA: "text-white/80",
  GD: "text-yellow-400",
  Sound: "text-orange-400",
  LD: "text-green-400",
}

export function DisplayName({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return null
  const text = value.length > 12 ? value.slice(0, 12) : value
  return <span className={cn("text-sky-400/70", className)}> ({text})</span>
}

export function UserDisplayName({
  name,
  email,
  displayName,
  department,
  className,
}: {
  name: string | null | undefined
  email: string
  displayName?: string | null
  department?: string | null
  className?: string
}) {
  const label = name ?? email
  const extra = displayName ? (displayName.length > 12 ? displayName.slice(0, 12) : displayName) : null
  const dept = department?.trim() || null
  const [open, setOpen] = useState(false)

  if (!extra && !dept) {
    return <span className={cn("truncate", className)}>{label}</span>
  }

  return (
    <Popover open={open} onOpenChange={() => {}}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <span
            className={cn("truncate select-none outline-none", className)}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            {label}
          </span>
        }
      />
      <PopoverContent side="bottom" align="start" sideOffset={4} className="!w-auto !p-1.5 pointer-events-none text-xs !flex-row items-center gap-1.5">
        {extra && <span>{extra}</span>}
        {dept && <span className={cn("font-medium", deptColors[dept] ?? "text-muted-foreground")}>{dept}</span>}
      </PopoverContent>
    </Popover>
  )
}
