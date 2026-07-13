"use client"

import { useIssues, type IssueStatus, type IssuePriority, type IssueTeam } from "@/lib/issues-context"
import { Circle, CircleDot, CircleCheck, CircleOff, ArrowUp, ArrowDown, Minus, AlertCircle, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

const statusLabels: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
}

const statusColors: Record<IssueStatus, string> = {
  backlog: "text-muted-foreground/40",
  todo: "text-muted-foreground",
  in_progress: "text-yellow-400",
  done: "text-green-400",
  canceled: "text-muted-foreground/40",
}

const statusIcons: Record<IssueStatus, typeof Circle> = {
  backlog: CircleOff,
  todo: Circle,
  in_progress: CircleDot,
  done: CircleCheck,
  canceled: CircleOff,
}

const priorityLabels: Record<IssuePriority, string> = {
  none: "No Priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

const priorityIcons: Record<IssuePriority, typeof Minus> = {
  none: Minus,
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  urgent: AlertCircle,
}

const priorityColors: Record<IssuePriority, string> = {
  none: "text-muted-foreground/30",
  low: "text-muted-foreground",
  medium: "text-blue-400",
  high: "text-orange-400",
  urgent: "text-red-400",
}

const teamColors: Record<string, string> = {
  DEV: "text-blue-400",
  ART: "text-red-400",
  QA: "text-white/80",
  GD: "text-yellow-400",
  Sound: "text-orange-400",
}

const teams: IssueTeam[] = ["ART", "DEV", "QA", "GD", "Sound"]

export default function StatisticsPage() {
  const { issues } = useIssues()

  const total = issues.length
  const doneCount = issues.filter((i) => i.status === "done").length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  const statusCounts = {} as Record<IssueStatus, number>
  for (const s of ["backlog", "todo", "in_progress", "done", "canceled"] as IssueStatus[]) {
    statusCounts[s] = issues.filter((i) => i.status === s).length
  }

  const priorityCounts = {} as Record<IssuePriority, number>
  for (const p of ["none", "low", "medium", "high", "urgent"] as IssuePriority[]) {
    priorityCounts[p] = issues.filter((i) => i.priority === p).length
  }

  const teamCounts = {} as Record<string, number>
  for (const t of teams) {
    teamCounts[t] = issues.filter((i) => i.team === t).length
  }

  const epicCount = issues.filter((i) => i.is_epic).length

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border/50 px-6 py-3">
        <h1 className="text-base font-medium">Statistics</h1>
      </div>
      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-lg space-y-6">

          {/* Overall */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Completion</span>
              <span>{doneCount}/{total} ({pct}%)</span>
            </div>
            <div className="h-2 rounded-full bg-border/50 overflow-hidden">
              <div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/30 px-4 py-3">
              <span className="text-2xl font-semibold">{total}</span>
              <p className="text-sm text-muted-foreground/60 mt-0.5">Total issues</p>
            </div>
            <div className="rounded-lg border border-border/30 px-4 py-3">
              <span className="text-2xl font-semibold flex items-center gap-2">
                {epicCount}
                <Layers className="size-4 text-purple-400" />
              </span>
              <p className="text-sm text-muted-foreground/60 mt-0.5">Epics</p>
            </div>
          </div>

          {/* By Status */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">By Status</h2>
            {(["backlog", "todo", "in_progress", "done", "canceled"] as IssueStatus[]).map((s) => {
              const count = statusCounts[s]
              const barPct = total > 0 ? Math.round((count / total) * 100) : 0
              const Icon = statusIcons[s]
              return (
                <div key={s} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Icon className={cn("size-3", statusColors[s])} />
                      {statusLabels[s]}
                    </span>
                    <span className="text-muted-foreground/60">{count} ({barPct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border/50 overflow-hidden">
                    <div className={cn("h-full rounded-full", s === "done" ? "bg-green-400" : "bg-muted-foreground/20")} style={{ width: `${barPct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* By Priority */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">By Priority</h2>
            {(["urgent", "high", "medium", "low", "none"] as IssuePriority[]).map((p) => {
              const count = priorityCounts[p]
              const barPct = total > 0 ? Math.round((count / total) * 100) : 0
              const PIcon = priorityIcons[p]
              return (
                <div key={p} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <PIcon className={cn("size-3", priorityColors[p])} />
                      {priorityLabels[p]}
                    </span>
                    <span className="text-muted-foreground/60">{count} ({barPct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border/50 overflow-hidden">
                    <div className="h-full rounded-full bg-muted-foreground/20" style={{ width: `${barPct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* By Team */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">By Team</h2>
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => {
                const count = teamCounts[t]
                return (
                  <div key={t} className="rounded-lg border border-border/30 px-3 py-2.5">
                    <span className={cn("text-sm font-semibold", teamColors[t])}>{t}</span>
                    <p className="text-sm text-muted-foreground/60 mt-0.5">{count} issues</p>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
