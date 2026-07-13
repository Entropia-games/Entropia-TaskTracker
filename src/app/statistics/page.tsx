"use client"

import { useState } from "react"
import { useIssues, type IssueStatus, type IssuePriority, type IssueTeam } from "@/lib/issues-context"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Circle, ChevronDown, CircleDot, CircleCheck, CircleOff, ArrowUp, ArrowDown, Minus, AlertCircle, Layers, Plus, X, Diamond } from "lucide-react"
import { cn } from "@/lib/utils"

const statusLabels: Record<IssueStatus, string> = {
  backlog: "Backlog", todo: "Todo", in_progress: "In Progress", done: "Done", canceled: "Canceled",
}

const statusColors: Record<IssueStatus, string> = {
  backlog: "text-muted-foreground/40", todo: "text-muted-foreground", in_progress: "text-yellow-400", done: "text-green-400", canceled: "text-muted-foreground/40",
}

const statusIcons: Record<IssueStatus, typeof Circle> = {
  backlog: CircleOff, todo: Circle, in_progress: CircleDot, done: CircleCheck, canceled: CircleOff,
}

const priorityLabels: Record<IssuePriority, string> = {
  none: "No Priority", low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
}

const priorityIcons: Record<IssuePriority, typeof Minus> = {
  none: Minus, low: ArrowDown, medium: Minus, high: ArrowUp, urgent: AlertCircle,
}

const priorityColors: Record<IssuePriority, string> = {
  none: "text-muted-foreground/30", low: "text-muted-foreground", medium: "text-blue-400", high: "text-orange-400", urgent: "text-red-400",
}

const teamColors: Record<string, string> = {
  "3D": "text-red-400", Concept: "text-blue-400", DEV: "text-purple-400", QA: "text-white/80", GD: "text-yellow-400", Sound: "text-orange-400",
}

const teams: IssueTeam[] = ["3D", "Concept", "DEV", "QA", "GD", "Sound"]

export default function StatisticsPage() {
  const { issues, milestones, createMilestone, deleteMilestone } = useIssues()
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [milestonePopoverOpen, setMilestonePopoverOpen] = useState(false)
  const [milestoneToDelete, setMilestoneToDelete] = useState<number | null>(null)

  const filteredIssues = selectedMilestoneId
    ? issues.filter((i) => i.milestone_id === selectedMilestoneId)
    : issues

  const total = filteredIssues.length
  const doneCount = filteredIssues.filter((i) => i.status === "done").length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  const statusCounts = {} as Record<IssueStatus, number>
  for (const s of ["backlog", "todo", "in_progress", "done", "canceled"] as IssueStatus[]) {
    statusCounts[s] = filteredIssues.filter((i) => i.status === s).length
  }

  const priorityCounts = {} as Record<IssuePriority, number>
  for (const p of ["none", "low", "medium", "high", "urgent"] as IssuePriority[]) {
    priorityCounts[p] = filteredIssues.filter((i) => i.priority === p).length
  }

  const teamCounts = {} as Record<string, number>
  for (const t of teams) {
    teamCounts[t] = filteredIssues.filter((i) => i.team === t).length
  }

  const epicCount = filteredIssues.filter((i) => i.is_epic).length

  const handleCreate = async () => {
    if (!newName.trim()) return
    await createMilestone(newName.trim())
    setNewName("")
    setCreating(false)
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
        <h1 className="text-base font-medium">Statistics</h1>
        <div className="flex items-center gap-2">
          {creating ? (
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
                placeholder="Milestone name..."
                className="h-7 rounded-md border border-border/30 bg-transparent px-2 text-xs outline-none ring-0 w-40"
                autoFocus
              />
              <button onClick={handleCreate} className="text-xs text-muted-foreground hover:text-foreground px-1">Save</button>
              <button onClick={() => { setCreating(false); setNewName("") }}><X className="size-3 text-muted-foreground/50" /></button>
            </div>
          ) : (
            <button onClick={() => setCreating(true)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <Plus className="size-3.5" /> Milestone
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-lg space-y-6">

          {/* Milestone selector */}
          <div className="flex items-center gap-2">
            <Popover open={milestonePopoverOpen} onOpenChange={setMilestonePopoverOpen}>
              <PopoverTrigger
                render={
                  <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent text-foreground">
                    <Diamond className="size-3 text-red-400/60" />
                    {milestones.find((m) => m.id === selectedMilestoneId)?.name ?? "All issues"}
                    <ChevronDown className="size-3" />
                  </button>
                }
              />
              <PopoverContent className="w-48 p-1" align="start">
                  <button
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", selectedMilestoneId === null ? "text-foreground" : "text-muted-foreground")}
                    onClick={() => { setSelectedMilestoneId(null); setMilestonePopoverOpen(false) }}
                  >
                    All issues
                  </button>
                  {milestones.map((m) => (
                    <div key={m.id} className="flex items-center">
                      <button
                        className={cn("flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", selectedMilestoneId === m.id ? "text-foreground" : "text-muted-foreground")}
                        onClick={() => { setSelectedMilestoneId(m.id); setMilestonePopoverOpen(false) }}
                      >
                        <Diamond className="size-3 text-red-400/60 shrink-0" />
                        {m.name}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMilestoneToDelete(m.id) }}
                        className="mr-1 rounded p-1 text-muted-foreground/40 hover:text-red-400 hover:bg-accent"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
              </PopoverContent>
            </Popover>
          </div>

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
              <p className="text-sm text-muted-foreground/60 mt-0.5">Issues</p>
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
              const barColors: Record<IssueStatus, string> = {
                backlog: "bg-muted-foreground/20", todo: "bg-blue-400", in_progress: "bg-yellow-400", done: "bg-green-400", canceled: "bg-muted-foreground/20",
              }
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
                    <div className={cn("h-full rounded-full transition-all", barColors[s])} style={{ width: `${barPct}%` }} />
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
              const barColors: Record<IssuePriority, string> = {
                urgent: "bg-red-400", high: "bg-orange-400", medium: "bg-blue-400", low: "bg-muted-foreground/40", none: "bg-muted-foreground/20",
              }
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
                    <div className={cn("h-full rounded-full transition-all", barColors[p])} style={{ width: `${barPct}%` }} />
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
      <Dialog open={milestoneToDelete !== null} onOpenChange={(v) => { if (!v) setMilestoneToDelete(null) }}>
        <DialogContent className="sm:max-w-xs">
          <DialogTitle className="text-sm font-medium">Delete milestone?</DialogTitle>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setMilestoneToDelete(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => { if (milestoneToDelete !== null) { deleteMilestone(milestoneToDelete); if (selectedMilestoneId === milestoneToDelete) setSelectedMilestoneId(null) } setMilestoneToDelete(null) }}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
