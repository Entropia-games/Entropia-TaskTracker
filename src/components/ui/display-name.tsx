"use client"

import { useState } from "react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function DisplayName({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return null
  const text = value.length > 12 ? value.slice(0, 12) : value
  return <span className={cn("text-sky-400/70", className)}> ({text})</span>
}

export function UserDisplayName({
  name,
  email,
  displayName,
  className,
}: {
  name: string | null | undefined
  email: string
  displayName?: string | null
  className?: string
}) {
  const label = name ?? email
  const extra = displayName ? (displayName.length > 12 ? displayName.slice(0, 12) : displayName) : null
  const [open, setOpen] = useState(false)

  if (!extra) {
    return <span className={cn("truncate", className)}>{label}</span>
  }

  return (
    <Popover open={open} onOpenChange={() => {}}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <span
            className={cn("truncate", className)}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            {label}
          </span>
        }
      />
      <PopoverContent side="bottom" align="start" sideOffset={4} className="!w-auto !p-1.5 pointer-events-none text-xs">
        {extra}
      </PopoverContent>
    </Popover>
  )
}
