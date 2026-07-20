"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Search, Circle } from "lucide-react"
import { getSupabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useIssues, type Issue, type IssuePriority, type IssueTeam, type IssueStatus } from "@/lib/issues-context"
import { issueTypeIcon, issueTypeColor } from "@/lib/issue-types"
import { useAuthGate } from "@/lib/auth-gate-context"
import type { Database } from "@/lib/database.types"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
}

const priorityIcons: Record<string, typeof Circle> = {
  none: Circle, low: Circle, medium: Circle, high: Circle, urgent: Circle,
}

const priorityColors: Record<string, string> = {
  none: "text-muted-foreground/30", low: "text-muted-foreground", medium: "text-blue-400", high: "text-orange-400", urgent: "text-red-400",
}

const teamColors: Record<string, string> = {
  "3D": "text-red-400", Concept: "text-blue-400", DEV: "text-purple-400", QA: "text-white/80", GD: "text-yellow-400", Sound: "text-orange-400", LD: "text-green-400",
}

const statusLabels: Record<string, string> = {
  backlog: "Backlog", todo: "Todo", in_progress: "In Progress", done: "Done", canceled: "Canceled",
}

export function SearchModal({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Issue[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { currentProject } = useIssues()
  const { requireAuth } = useAuthGate()

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); return }
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (!query.trim() || !currentProject) { setResults([]); return }
    const q = `%${query.trim()}%`
    const timer = setTimeout(() => {
      getSupabase()
        .from("issues")
        .select("*")
        .eq("project_id", currentProject.id)
        .ilike("title", q)
        .order("id", { ascending: false })
        .limit(10)
        .then(({ data }) => {
          if (data) setResults(data as Issue[])
        })
    }, 200)
    return () => clearTimeout(timer)
  }, [query, currentProject])

  const handleSelect = (issue: Issue) => {
    requireAuth(() => {
      router.push(`/?issue=${issue.id}`)
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!rounded-xl !p-0 !gap-0 top-[15%] translate-y-0 max-w-lg">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground/50" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues..."
            className="flex-1 border-none bg-transparent text-sm outline-none ring-0 placeholder:text-muted-foreground/30"
          />
        </div>
        {results.length > 0 && (
          <div className="max-h-80 overflow-auto p-1.5 space-y-0.5">
            {results.map((issue) => (
              <div
                key={issue.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(issue)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSelect(issue) }}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-accent/60"
              >
                {(() => {
                  const PIcon = priorityIcons[issue.priority]
                  return <PIcon className={cn("size-3.5 shrink-0", priorityColors[issue.priority])} />
                })()}
                {issue.issue_type && issue.issue_type !== "task" && (() => {
                  const TypeIcon = issueTypeIcon(issue.issue_type)
                  return <TypeIcon className={cn("size-3.5 shrink-0", issueTypeColor(issue.issue_type))} />
                })()}
                <span className="text-xs text-muted-foreground/50 font-mono shrink-0">{currentProject?.code ?? "?"}-{issue.display_id}</span>
                <span className="flex-1 truncate">{issue.title}</span>
                {issue.team && (
                  <span className={cn("shrink-0 text-[10px] font-medium", teamColors[issue.team])}>{issue.team}</span>
                )}
                <span className="shrink-0 text-[10px] text-muted-foreground/40">{issue.status === "in_progress" ? "In Progress" : statusLabels[issue.status]}</span>
              </div>
            ))}
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground/50">No results</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
