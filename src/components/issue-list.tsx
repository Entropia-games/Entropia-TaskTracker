"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {   Circle, ChevronDown, Trash2, X, ArrowUp, ArrowDown, ArrowUpDown, Minus, AlertCircle, CircleDot, CircleCheck, CircleOff, Layers, GitPullRequest, Diamond, Plus, Link, List, LayoutGrid, Loader2 } from "lucide-react"
import { CreateIssueModal } from "@/components/create-issue-modal"
import { IssueDetailModal } from "@/components/issue-detail-modal"
import { IssueContextMenu } from "@/components/issue-context-menu"
import { useIssues, type Issue, type IssueStatus, type IssuePriority, type IssueTeam, type Milestone } from "@/lib/issues-context"
import { useAuthGate } from "@/lib/auth-gate-context"
import { getSupabase } from "@/lib/supabase"
import type { Database } from "@/lib/database.types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const statusLabels: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
}

const statusMeta: Record<IssueStatus, { icon: typeof Circle; color: string }> = {
  backlog: { icon: CircleOff, color: "text-muted-foreground/40" },
  todo: { icon: Circle, color: "text-muted-foreground" },
  in_progress: { icon: CircleDot, color: "text-yellow-400" },
  done: { icon: CircleCheck, color: "text-green-400" },
  canceled: { icon: CircleOff, color: "text-muted-foreground/40" },
}

const priorityIcons: Record<IssuePriority, typeof Minus> = {
  none:   Minus,
  low:    ArrowDown,
  medium: Minus,
  high:   ArrowUp,
  urgent: AlertCircle,
}

const priorityColors: Record<IssuePriority, string> = {
  none:   "text-muted-foreground/30",
  low:    "text-muted-foreground",
  medium: "text-blue-400",
  high:   "text-orange-400",
  urgent: "text-red-400",
}

const teamColors: Record<string, string> = {
  "3D":     "text-red-400",
  Concept:  "text-blue-400",
  DEV:      "text-purple-400",
  QA:       "text-white/80",
  GD:       "text-yellow-400",
  Sound:    "text-orange-400",
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "updated", label: "Recently updated" },
  { value: "priority", label: "Priority" },
  { value: "status", label: "Status" },
] as const
type SortBy = (typeof SORT_OPTIONS)[number]["value"]

const priorityRank: Record<IssuePriority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 }
const statusRank: Record<IssueStatus, number> = { backlog: 0, todo: 1, in_progress: 2, done: 3, canceled: 4 }

function sortIssues(list: Issue[], by: SortBy): Issue[] {
  const arr = [...list]
  arr.sort((a, b) => {
    switch (by) {
      case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case "updated": return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      case "priority": return priorityRank[a.priority] - priorityRank[b.priority]
      case "status": return statusRank[a.status] - statusRank[b.status]
    }
  })
  return arr
}

type Props = {
  title: string
  issues: Issue[]
  focusId?: number
  showTypeFilter?: boolean
}

function SortableBoardCard({ issue, children }: { issue: Issue; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

function BoardColumn({ status, children }: { status: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col gap-2", isOver && "bg-muted/10")}>
      {children}
    </div>
  )
}

export function IssueList({ title, issues, focusId, showTypeFilter = true }: Props) {
  const { issues: allIssues, deleteIssues, updateIssue, currentProject, milestones: projectMilestones } = useIssues()
  const { requireAuth } = useAuthGate()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [detailIssueId, setDetailIssueId] = useState<number | null>(null)
  const detailIssue = allIssues.find((i) => i.id === detailIssueId) ?? null
  const [detailParentIssue, setDetailParentIssue] = useState<Issue | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [statusFilter, setStatusFilter] = useState<IssueStatus | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | null>(null)
  const [teamFilter, setTeamFilter] = useState<IssueTeam | null>(null)
  const [milestoneFilter, setMilestoneFilter] = useState<number | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<"all" | "issue" | "epic">("all")
  const [sortBy, setSortBy] = useState<SortBy>("newest")
  const [view, setView] = useState<"list" | "board">("list")
  const [viewLoading, setViewLoading] = useState(false)
  const switchView = (next: "list" | "board") => {
    if (next === view) return
    setView(next)
    setViewLoading(true)
    window.setTimeout(() => {
      setViewLoading(false)
    }, 220)
  }
  const [openTeamPopover, setOpenTeamPopover] = useState<number | null>(null)
  const [openMilestonePopover, setOpenMilestonePopover] = useState<number | null>(null)
  const [openAssigneePopover, setOpenAssigneePopover] = useState<number | null>(null)
  const [openLinkPopover, setOpenLinkPopover] = useState<number | null>(null)
  const [openPriorityPopover, setOpenPriorityPopover] = useState<number | null>(null)
  const [showDone, setShowDone] = useState(true)
  const [users, setUsers] = useState<Database["public"]["Tables"]["users"]["Row"][]>([])
  const [linkedPRMap, setLinkedPRMap] = useState<Map<number, { count: number; firstUrl: string; firstState: string }>>(new Map())
  const rowClickTarget = useRef<number | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ issue: Issue; x: number; y: number } | null>(null)

  const applyCtxChange = (changes: Partial<Issue>) => {
    if (!ctxMenu) return
    requireAuth(() => updateIssue(ctxMenu.issue.id, changes))
    setCtxMenu(null)
  }

  useEffect(() => {
    getSupabase().from("users").select("*").then(({ data }) => {
      if (data) setUsers(data)
    })
  }, [])

  useEffect(() => {
    if (focusId) {
      const found = issues.find((i) => i.id === focusId)
      if (found) setDetailIssueId(found.id)
    }
  }, [focusId, issues])

  useEffect(() => {
    const ids = issues.map((i) => i.id)
    if (ids.length === 0) return
    getSupabase().from("issue_links").select("issue_id, pr_url, pr_state").in("issue_id", ids).then(({ data }) => {
      if (!data) return
      const map = new Map<number, { count: number; firstUrl: string; firstState: string }>()
      for (const link of data) {
        const existing = map.get(link.issue_id)
        if (existing) {
          existing.count++
        } else {
          map.set(link.issue_id, { count: 1, firstUrl: link.pr_url, firstState: link.pr_state })
        }
      }
      setLinkedPRMap(map)
    })
  }, [issues])

  const userMap = new Map(users.map((u) => [u.id, u]))
  const milestoneMap = new Map(projectMilestones.map((m) => [m.id, m]))
  const epics = issues.filter((i) => i.is_epic)

  const filteredIssues = issues.filter((i) => {
    if (statusFilter && i.status !== statusFilter) return false
    if (priorityFilter && i.priority !== priorityFilter) return false
    if (teamFilter && i.team !== teamFilter) return false
    if (milestoneFilter && i.milestone_id !== milestoneFilter) return false
    if (assigneeFilter === "__none__") {
      if (i.assignee_id) return false
    } else if (assigneeFilter && i.assignee_id !== assigneeFilter) {
      return false
    }
    if (typeFilter === "issue" && i.is_epic) return false
    if (typeFilter === "epic" && !i.is_epic) return false
    return true
  })

  const sortedIssues = useMemo(() => sortIssues(filteredIssues, sortBy), [filteredIssues, sortBy])

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = () => {
    if (selectedIds.size === 0) return
    requireAuth(() => setConfirmDelete(true))
  }

  const confirmDeleteAction = () => {
    const ids = Array.from(selectedIds)
    deleteIssues(ids)
    setSelectedIds(new Set())
    setConfirmDelete(false)
  }

  const [activeDragId, setActiveDragId] = useState<number | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )
  const activeDragIssue = activeDragId ? allIssues.find((i) => i.id === activeDragId) ?? null : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as number)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over) return
    const draggedId = active.id as number
    const overId = over.id
    let targetStatus: IssueStatus | null = null
    if (["backlog", "todo", "in_progress", "done"].includes(overId as string)) {
      targetStatus = overId as IssueStatus
    } else {
      const overIssue = allIssues.find((i) => i.id === overId)
      if (overIssue) targetStatus = overIssue.status
    }
    if (targetStatus) {
      const draggedIssue = allIssues.find((i) => i.id === draggedId)
      if (draggedIssue && draggedIssue.status !== targetStatus) {
        requireAuth(() => updateIssue(draggedId, { status: targetStatus }))
      }
    }
  }

  const handleDragCancel = () => {
    setActiveDragId(null)
  }

  const grouped = (["backlog", "todo", "in_progress", "done"] as IssueStatus[])
    .filter((s) => showDone || s !== "done")
    .map((status) => ({
      status,
      issues: sortedIssues.filter((i) => i.status === status),
    }))

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium">{title}</h1>
          <Badge variant="secondary" className="rounded-sm text-[11px] font-normal">
            {filteredIssues.length}
          </Badge>
          <Popover>
            <PopoverTrigger
              render={
                <button className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-accent", sortBy !== "newest" ? "text-foreground" : "text-muted-foreground")}>
                  <ArrowUpDown className="size-3.5" />
                  {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                  <ChevronDown className="size-3" />
                </button>
              }
            />
            <PopoverContent className="w-44 p-1" align="start">
              {SORT_OPTIONS.map((o) => (
                <button key={o.value} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", sortBy === o.value ? "text-foreground" : "text-muted-foreground")} onClick={() => setSortBy(o.value)}>
                  {o.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            Enable Done
            <button
              onClick={() => setShowDone((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border/30 transition-colors",
                showDone ? "bg-green-500/20 border-green-500/40" : "bg-muted/30",
              )}
            >
              <span className={cn(
                "inline-block size-3.5 rounded-full transition-transform",
                showDone ? "translate-x-[18px] bg-green-400" : "translate-x-[2px] bg-muted-foreground/50",
              )} />
            </button>
          </span>
          <span className="mx-1 h-4 w-px bg-border" />
          {showTypeFilter && (
          <Popover>
            <PopoverTrigger
              render={
                <button className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent", typeFilter !== "all" ? "text-foreground" : "text-muted-foreground")}>
                  {typeFilter === "issue" ? "Issues" : typeFilter === "epic" ? "Epics" : "All types"}
                  <ChevronDown className="size-3" />
                </button>
              }
            />
            <PopoverContent className="w-36 p-1" align="end">
              <button className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", typeFilter === "all" ? "text-foreground" : "text-muted-foreground")} onClick={() => setTypeFilter("all")}>All</button>
              <button className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", typeFilter === "issue" ? "text-foreground" : "text-muted-foreground")} onClick={() => setTypeFilter("issue")}>Issues</button>
              <button className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", typeFilter === "epic" ? "text-foreground" : "text-muted-foreground")} onClick={() => setTypeFilter("epic")}>Epics</button>
            </PopoverContent>
          </Popover>
          )}
          <Popover>
            <PopoverTrigger
              render={
                <button className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent", statusFilter ? "text-foreground" : "text-muted-foreground")}>
                  Status{statusFilter ? `: ${statusLabels[statusFilter]}` : ""}
                  <ChevronDown className="size-3" />
                </button>
              }
            />
            <PopoverContent className="w-40 p-1" align="end">
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                onClick={() => setStatusFilter(null)}
              >
                All
              </button>
              {(["backlog", "todo", "in_progress", "done", "canceled"] as IssueStatus[]).map((s) => {
                const statusIconMap: Record<string, typeof Circle> = { backlog: CircleOff, todo: Circle, in_progress: CircleDot, done: CircleCheck, canceled: CircleOff }
                const statusColorMap: Record<string, string> = { backlog: "text-muted-foreground/40", todo: "text-muted-foreground", in_progress: "text-yellow-400", done: "text-green-400", canceled: "text-muted-foreground/40" }
                const SIcon = statusIconMap[s]
                return (
                  <button
                    key={s}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", statusFilter === s ? "text-foreground" : "text-muted-foreground")}
                    onClick={() => setStatusFilter(s)}
                  >
                    <SIcon className={cn("size-3.5", statusColorMap[s])} />
                    {statusLabels[s]}
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger
              render={
                <button className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent", priorityFilter ? "text-foreground" : "text-muted-foreground")}>
                  Priority{priorityFilter ? `: ${priorityFilter}` : ""}
                  <ChevronDown className="size-3" />
                </button>
              }
            />
            <PopoverContent className="w-40 p-1" align="end">
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                onClick={() => setPriorityFilter(null)}
              >
                All
              </button>
              {(["none", "low", "medium", "high", "urgent"] as IssuePriority[]).map((p) => {
                const PIcon = priorityIcons[p]
                return (
                  <button
                    key={p}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", priorityFilter === p ? "text-foreground" : "text-muted-foreground")}
                    onClick={() => setPriorityFilter(p)}
                  >
                    <PIcon className={cn("size-3.5", priorityColors[p])} />
                    {p}
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger
              render={
                <button className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent", teamFilter ? "text-foreground" : "text-muted-foreground")}>
                  Team{teamFilter ? `: ${teamFilter}` : ""}
                  <ChevronDown className="size-3" />
                </button>
              }
            />
            <PopoverContent className="w-32 p-1" align="end">
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                onClick={() => setTeamFilter(null)}
              >
                All
              </button>
              {(["3D", "Concept", "DEV", "QA", "GD", "Sound"] as IssueTeam[]).map((t) => (
                <button
                  key={t}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", teamFilter === t ? "text-foreground" : "text-muted-foreground")}
                  onClick={() => setTeamFilter(t)}
                >
                  <Circle className={cn("size-3 fill-current", teamColors[t])} />
                  {t}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          {projectMilestones.length > 0 && (
            <Popover>
              <PopoverTrigger
                render={
                  <button className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent", milestoneFilter ? "text-foreground" : "text-muted-foreground")}>
                    <Diamond className={cn("size-3", milestoneFilter ? "text-red-400/60" : "text-muted-foreground/40")} />
                    Milestone{milestoneFilter ? `: ${projectMilestones.find((m) => m.id === milestoneFilter)?.name}` : ""}
                    <ChevronDown className="size-3" />
                  </button>
                }
              />
              <PopoverContent className="w-48 p-1" align="end">
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                  onClick={() => setMilestoneFilter(null)}
                >
                  All
                </button>
                {projectMilestones.map((m) => (
                  <button
                    key={m.id}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", milestoneFilter === m.id ? "text-foreground" : "text-muted-foreground")}
                    onClick={() => setMilestoneFilter(m.id)}
                  >
                    <Diamond className="size-3 text-red-400/60 shrink-0" />
                    {m.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
          <Popover>
            <PopoverTrigger
              render={
                <button className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent", assigneeFilter ? "text-foreground" : "text-muted-foreground")}>
                  {assigneeFilter === "__none__"
                    ? "Unassigned"
                    : assigneeFilter
                      ? (users.find((u) => u.id === assigneeFilter)?.name ?? "Assignee")
                      : "Assignee"}
                  <ChevronDown className="size-3" />
                </button>
              }
            />
            <PopoverContent className="w-48 p-1" align="end">
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                onClick={() => setAssigneeFilter(null)}
              >
                All
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                onClick={() => setAssigneeFilter("__none__")}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/20 text-[9px]">?</span>
                Unassigned
              </button>
              {users.map((u) => (
                <button
                  key={u.id}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", assigneeFilter === u.id ? "text-foreground" : "text-muted-foreground")}
                  onClick={() => setAssigneeFilter(u.id)}
                >
                  <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/30 text-[9px] font-medium text-foreground">
                    {(u.name ?? u.email[0])[0].toUpperCase()}
                  </span>
                  {u.name ?? u.email}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <div className="flex items-center rounded-md border border-border/30 p-0.5">
            <button
              onClick={() => switchView("list")}
              className={cn("flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors", view === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="size-3.5" />
              List
            </button>
            <button
              onClick={() => switchView("board")}
              className={cn("flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors", view === "board" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="size-3.5" />
              Board
            </button>
          </div>
          <span className="mx-1 h-4 w-px bg-border" />
          <CreateIssueModal />
        </div>
      </div>

      {view === "board" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
          <div className="flex-1 overflow-auto flex gap-4 p-6">
            {(["backlog", "todo", "in_progress", "done"] as IssueStatus[])
              .filter((s) => showDone || s !== "done")
              .map((status) => {
                const columnIssues = sortedIssues.filter((i) => i.status === status)
                return (
                  <BoardColumn key={status} status={status}>
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{statusLabels[status]}</span>
                      <span className="text-xs text-muted-foreground/50">{columnIssues.length}</span>
                    </div>
                    <SortableContext items={columnIssues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      {columnIssues.length === 0 && (
                        <div className="flex items-center justify-center rounded-md border border-dashed border-border/30 p-4">
                          <span className="text-xs text-muted-foreground/30">Drop here</span>
                        </div>
                      )}
                      {columnIssues.map((issue) => (
                        <SortableBoardCard key={issue.id} issue={issue}>
                          <div
                            className={cn(
                              "group relative flex flex-col gap-2 cursor-pointer rounded-md border border-border/60 bg-muted/40 p-2.5 transition-colors hover:border-border hover:bg-muted/60",
                              selectedIds.has(issue.id) && "border-border bg-muted/70",
                            )}
                            onClick={(e) => { if ((e.target as HTMLElement).closest("[data-pr-link], [data-team-btn], [data-milestone-btn], [data-assignee-btn], [data-link-btn], [data-priority-btn]")) return; requireAuth(() => setDetailIssueId(issue.id)) }}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ issue, x: e.clientX, y: e.clientY }) }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5 text-sm font-mono text-muted-foreground/60">
                                {issue.is_epic && <Layers className="size-3.5 shrink-0 text-purple-400" />}
                                <span className="truncate">{currentProject?.code ?? "?"}-{issue.display_id}</span>
                              </div>
                              <div onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedIds.has(issue.id)}
                                  onCheckedChange={() => toggleSelect(issue.id)}
                                  className={`size-4 ${selectedIds.has(issue.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {(() => { const S = statusMeta[issue.status]; const SIcon = S.icon; return <SIcon className={cn("size-3.5 shrink-0", S.color)} /> })()}
                              <span className="min-w-0 flex-1 truncate text-sm">{issue.title}</span>
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                              <Popover open={openPriorityPopover === issue.id} onOpenChange={(v) => setOpenPriorityPopover(v ? issue.id : null)}>
                                <PopoverTrigger
                                  render={
                                    <button
                                      data-priority-btn
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex size-4 shrink-0 items-center justify-center rounded hover:bg-accent"
                                    >
                                      {(() => {
                                        const PIcon = priorityIcons[issue.priority]
                                        return <PIcon className={`size-4 shrink-0 ${priorityColors[issue.priority]}`} />
                                      })()}
                                    </button>
                                  }
                                />
                                <PopoverContent className="w-36 p-1" align="start">
                                  {(["none", "low", "medium", "high", "urgent"] as IssuePriority[]).map((p) => {
                                    const PIcon = priorityIcons[p]
                                    return (
                                      <button
                                        key={p}
                                        className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent", issue.priority === p ? "text-foreground" : "text-muted-foreground")}
                                        onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { priority: p })); setOpenPriorityPopover(null) }}
                                      >
                                        <PIcon className={cn("size-3.5", priorityColors[p])} />
                                        <span className="capitalize">{p}</span>
                                      </button>
                                    )
                                  })}
                                </PopoverContent>
                              </Popover>
                              <span className="flex w-5 shrink-0 items-center justify-center">{linkedPRMap.has(issue.id) && (() => {
                                const pr = linkedPRMap.get(issue.id)!
                                const isMerged = pr.firstState === "merged"
                                const isClosed = pr.firstState === "closed"
                                return (
                                  <a data-pr-link
                                    href={pr.firstUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={cn(
                                      "flex shrink-0 items-center gap-0.5 transition-colors",
                                      isMerged ? "text-purple-400/70 hover:text-purple-400" :
                                      isClosed ? "text-red-400/70 hover:text-red-400" :
                                      "text-green-400/70 hover:text-green-400",
                                    )}
                                  >
                                    <GitPullRequest className="size-4" />
                                    {pr.count > 1 && <span className="text-sm font-medium">{pr.count}</span>}
                                  </a>
                                )
                              })()}                  </span>
                              {!issue.is_epic && (
                                <Popover open={openLinkPopover === issue.id} onOpenChange={(v) => setOpenLinkPopover(v ? issue.id : null)}>
                                  <PopoverTrigger
                                    render={
                                      <button
                                        data-link-btn
                                        onClick={(e) => e.stopPropagation()}
                                        className={cn("flex size-7 shrink-0 items-center justify-center rounded border border-transparent transition-colors hover:border-border/30 hover:bg-accent", issue.parent_epic_id ? "text-purple-400" : "text-transparent group-hover:text-muted-foreground/50")}
                                      >
                                        <Link className="size-3.5" />
                                      </button>
                                    }
                                  />
                                  <PopoverContent className="w-48 p-1" align="end">
                                    {issue.parent_epic_id && (
                                      <button
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                                        onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { parent_epic_id: null })); setOpenLinkPopover(null) }}
                                      >
                                        <Circle className="size-3 text-muted-foreground/40" />
                                        Unlink from epic
                                      </button>
                                    )}
                                    {epics.map((epic) => (
                                      <button
                                        key={epic.id}
                                        className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent", issue.parent_epic_id === epic.id ? "text-purple-400" : "text-muted-foreground")}
                                        onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { parent_epic_id: epic.id })); setOpenLinkPopover(null) }}
                                      >
                                        <Layers className="size-3.5 shrink-0 text-purple-400" />
                                        <span className="truncate">{epic.title}</span>
                                      </button>
                                    ))}
                                    {epics.length === 0 && (
                                      <span className="block px-2 py-1.5 text-xs text-muted-foreground/50">No epics yet</span>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              )}
                              <Popover open={openTeamPopover === issue.id} onOpenChange={(v) => setOpenTeamPopover(v ? issue.id : null)}>
                                <PopoverTrigger
                                  render={
                                    <button
                                      data-team-btn
                                      onClick={(e) => e.stopPropagation()}
                                      className={cn("flex w-16 shrink-0 items-center justify-center rounded border px-1 py-0.5 text-sm font-medium transition-colors hover:bg-accent", issue.team ? (cn("border-border/30", teamColors[issue.team] ?? "text-muted-foreground/70")) : "border-dashed border-transparent group-hover:border-border/30 text-transparent group-hover:text-muted-foreground/40 hover:border-border/60 hover:text-muted-foreground/70")}
                                    >
                                      {issue.team ?? <><Plus className="size-3 mr-0.5" />Team</>}
                                    </button>
                                  }
                                />
                                <PopoverContent className="w-32 p-1" align="start">
                                  <button
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                                      onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { team: null })); setOpenTeamPopover(null) }}
                                  >
                                    <Circle className="size-3 text-muted-foreground/40" />
                                    No Team
                                  </button>
                                  {(["3D", "Concept", "DEV", "QA", "GD", "Sound"] as IssueTeam[]).map((t) => (
                                    <button
                                      key={t}
                                      className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", issue.team === t ? "text-foreground" : "text-muted-foreground")}
                                      onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { team: t })); setOpenTeamPopover(null) }}
                                    >
                                      <Circle className={cn("size-3", teamColors[t])} />
                                      {t}
                                    </button>
                                  ))}
                                </PopoverContent>
                              </Popover>
                              <Popover open={openMilestonePopover === issue.id} onOpenChange={(v) => setOpenMilestonePopover(v ? issue.id : null)}>
                                <PopoverTrigger
                                  render={
                                    <button
                                      data-milestone-btn
                                      onClick={(e) => e.stopPropagation()}
                                      className={cn("flex w-28 shrink-0 items-center gap-1 rounded border px-1 py-0.5 text-sm font-medium transition-colors hover:bg-accent", issue.milestone_id ? (cn("border-border/30 text-red-400/60 [&_svg]:text-red-400/60")) : "border-dashed border-transparent group-hover:border-border/30 text-transparent group-hover:text-muted-foreground/40 hover:border-border/60 hover:text-muted-foreground/70")}
                                    >
                                      {issue.milestone_id && milestoneMap.has(issue.milestone_id) ? (
                                        <><Diamond className="size-3.5 shrink-0" /><span className="truncate">{milestoneMap.get(issue.milestone_id)!.name}</span></>
                                      ) : (
                                        <><Plus className="size-3 mr-0.5 shrink-0" />Milestone</>
                                      )}
                                    </button>
                                  }
                                />
                                <PopoverContent className="w-40 p-1" align="start">
                                  <button
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                                      onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { milestone_id: null })); setOpenMilestonePopover(null) }}
                                  >
                                    <Diamond className="size-3 text-muted-foreground/40" />
                                    No Milestone
                                  </button>
                                  {projectMilestones.map((m) => (
                                    <button
                                      key={m.id}
                                      className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", issue.milestone_id === m.id ? "text-foreground" : "text-muted-foreground")}
                                      onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { milestone_id: m.id })); setOpenMilestonePopover(null) }}
                                    >
                                      <Diamond className="size-3 text-red-400/60 shrink-0" />
                                      {m.name}
                                    </button>
                                  ))}
                                </PopoverContent>
                              </Popover>
                              <Popover open={openAssigneePopover === issue.id} onOpenChange={(v) => setOpenAssigneePopover(v ? issue.id : null)}>
                                <PopoverTrigger
                                  render={
                                    <button
                                      data-assignee-btn
                                      onClick={(e) => e.stopPropagation()}
                                      className={cn("flex w-36 shrink-0 items-center justify-end gap-1.5 rounded border px-1 py-0.5 text-sm font-medium transition-colors hover:bg-accent", issue.assignee_id && userMap.has(issue.assignee_id) ? "border-border/30" : "border-dashed border-transparent group-hover:border-border/30 text-transparent group-hover:text-muted-foreground/40 hover:border-border/60 hover:text-muted-foreground/70")}
                                    >
                                      {issue.assignee_id && userMap.has(issue.assignee_id) ? (
                                        <>
                                          <span className="text-sm text-muted-foreground truncate">
                                            {userMap.get(issue.assignee_id)?.name ?? userMap.get(issue.assignee_id)?.email}
                                          </span>
                                          <Avatar className="size-6">
                                            <AvatarFallback className="text-[11px]">
                                              {(userMap.get(issue.assignee_id)?.name ?? "?")[0].toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                        </>
                                      ) : (
                                        <><Plus className="size-3 mr-0.5 shrink-0" />Assignee</>
                                      )}
                                    </button>
                                  }
                                />
                                <PopoverContent className="w-36 p-1" align="end">
                                  <button
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                                      onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { assignee_id: null })); setOpenAssigneePopover(null) }}
                                  >
                                    <Circle className="size-3 text-muted-foreground/40" />
                                    No Assignee
                                  </button>
                                  {users.map((u) => (
                                    <button
                                      key={u.id}
                                      className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", issue.assignee_id === u.id ? "text-foreground" : "text-muted-foreground")}
                                      onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { assignee_id: u.id })); setOpenAssigneePopover(null) }}
                                    >
                                      <Avatar className="size-5">
                                        <AvatarFallback className="text-[9px]">{(u.name ?? u.email)[0].toUpperCase()}</AvatarFallback>
                                      </Avatar>
                                      {u.name ?? u.email}
                                    </button>
                                  ))}
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        </SortableBoardCard>
                      ))}
                    </SortableContext>
                  </BoardColumn>
                )
              })}
          </div>
          <DragOverlay>
            {activeDragIssue ? (
              <div className="rounded-md border border-border/60 bg-muted/90 p-2.5 shadow-lg">
                <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground/60">
                  {activeDragIssue.is_epic && <Layers className="size-3.5 shrink-0 text-purple-400" />}
                  <span>{currentProject?.code ?? "?"}-{activeDragIssue.display_id}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {(() => { const S = statusMeta[activeDragIssue.status]; const SIcon = S.icon; return <SIcon className={cn("size-3.5 shrink-0", S.color)} /> })()}
                  <span className="min-w-0 flex-1 truncate text-sm">{activeDragIssue.title}</span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="flex-1 overflow-auto">
          {grouped.map((group) => {
            if (group.issues.length === 0) return null
            return (
              <div key={group.status}>
                <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/30 bg-background px-6 py-2">
                  <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{statusLabels[group.status]}</span>
                  <span className="text-xs text-muted-foreground/50">{group.issues.length}</span>
                </div>
                {group.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={cn("group flex cursor-pointer items-center gap-3 border-b border-border/20 px-6 py-2.5 transition-colors hover:bg-accent/30", selectedIds.has(issue.id) && "bg-accent/20")}
                    onClick={(e) => { if ((e.target as HTMLElement).closest("[data-pr-link], [data-team-btn], [data-milestone-btn], [data-assignee-btn], [data-link-btn], [data-priority-btn]")) return; requireAuth(() => setDetailIssueId(issue.id)) }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ issue, x: e.clientX, y: e.clientY }) }}
                  >
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(issue.id)}
                        onCheckedChange={() => toggleSelect(issue.id)}
                        className={`size-4 ${selectedIds.has(issue.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      />
                    </div>
                    <Popover open={openPriorityPopover === issue.id} onOpenChange={(v) => setOpenPriorityPopover(v ? issue.id : null)}>
                      <PopoverTrigger
                        render={
                          <button
                            data-priority-btn
                            onClick={(e) => e.stopPropagation()}
                            className="flex size-4 shrink-0 items-center justify-center rounded hover:bg-accent"
                          >
                            {(() => {
                              const PIcon = priorityIcons[issue.priority]
                              return <PIcon className={`size-4 shrink-0 ${priorityColors[issue.priority]}`} />
                            })()}
                          </button>
                        }
                      />
                      <PopoverContent className="w-36 p-1" align="start">
                        {(["none", "low", "medium", "high", "urgent"] as IssuePriority[]).map((p) => {
                          const PIcon = priorityIcons[p]
                          return (
                            <button
                              key={p}
                              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent", issue.priority === p ? "text-foreground" : "text-muted-foreground")}
                              onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { priority: p })); setOpenPriorityPopover(null) }}
                            >
                              <PIcon className={cn("size-3.5", priorityColors[p])} />
                              <span className="capitalize">{p}</span>
                            </button>
                          )
                        })}
                      </PopoverContent>
                    </Popover>
                    <span className="flex w-5 shrink-0 items-center justify-center">{issue.is_epic && <Layers className="size-4 text-purple-400" />}</span>
                    <span className={cn("min-w-[4rem] text-sm font-mono", issue.status === "done" || issue.status === "canceled" ? "text-muted-foreground/30 line-through" : "text-muted-foreground/60")}>
                      {currentProject?.code ?? "?"}-{issue.display_id}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{issue.title}</span>
                    <span className="flex w-5 shrink-0 items-center justify-center">{linkedPRMap.has(issue.id) && (() => {
                      const pr = linkedPRMap.get(issue.id)!
                      const isMerged = pr.firstState === "merged"
                      const isClosed = pr.firstState === "closed"
                      return (
                        <a data-pr-link
                          href={pr.firstUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            "flex shrink-0 items-center gap-0.5 transition-colors",
                            isMerged ? "text-purple-400/70 hover:text-purple-400" :
                            isClosed ? "text-red-400/70 hover:text-red-400" :
                            "text-green-400/70 hover:text-green-400",
                          )}
                        >
                          <GitPullRequest className="size-4" />
                          {pr.count > 1 && <span className="text-sm font-medium">{pr.count}</span>}
                        </a>
                      )
                    })()}                  </span>
                    {!issue.is_epic && (
                      <Popover open={openLinkPopover === issue.id} onOpenChange={(v) => setOpenLinkPopover(v ? issue.id : null)}>
                        <PopoverTrigger
                          render={
                            <button
                              data-link-btn
                              onClick={(e) => e.stopPropagation()}
                              className={cn("flex size-7 shrink-0 items-center justify-center rounded border border-transparent transition-colors hover:border-border/30 hover:bg-accent", issue.parent_epic_id ? "text-purple-400" : "text-transparent group-hover:text-muted-foreground/50")}
                            >
                              <Link className="size-3.5" />
                            </button>
                          }
                        />
                        <PopoverContent className="w-48 p-1" align="end">
                          {issue.parent_epic_id && (
                            <button
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                              onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { parent_epic_id: null })); setOpenLinkPopover(null) }}
                            >
                              <Circle className="size-3 text-muted-foreground/40" />
                              Unlink from epic
                            </button>
                          )}
                          {epics.map((epic) => (
                            <button
                              key={epic.id}
                              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent", issue.parent_epic_id === epic.id ? "text-purple-400" : "text-muted-foreground")}
                              onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { parent_epic_id: epic.id })); setOpenLinkPopover(null) }}
                            >
                              <Layers className="size-3.5 shrink-0 text-purple-400" />
                              <span className="truncate">{epic.title}</span>
                            </button>
                          ))}
                          {epics.length === 0 && (
                            <span className="block px-2 py-1.5 text-xs text-muted-foreground/50">No epics yet</span>
                          )}
                        </PopoverContent>
                      </Popover>
                    )}
                    <Popover open={openTeamPopover === issue.id} onOpenChange={(v) => setOpenTeamPopover(v ? issue.id : null)}>
                      <PopoverTrigger
                        render={
                          <button
                            data-team-btn
                            onClick={(e) => e.stopPropagation()}
                            className={cn("flex w-16 shrink-0 items-center justify-center rounded border px-1 py-0.5 text-sm font-medium transition-colors hover:bg-accent", issue.team ? (cn("border-border/30", teamColors[issue.team] ?? "text-muted-foreground/70")) : "border-dashed border-transparent group-hover:border-border/30 text-transparent group-hover:text-muted-foreground/40 hover:border-border/60 hover:text-muted-foreground/70")}
                          >
                            {issue.team ?? <><Plus className="size-3 mr-0.5" />Team</>}
                          </button>
                        }
                      />
                      <PopoverContent className="w-32 p-1" align="start">
                        <button
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                            onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { team: null })); setOpenTeamPopover(null) }}
                        >
                          <Circle className="size-3 text-muted-foreground/40" />
                          No Team
                        </button>
                        {(["3D", "Concept", "DEV", "QA", "GD", "Sound"] as IssueTeam[]).map((t) => (
                          <button
                            key={t}
                            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", issue.team === t ? "text-foreground" : "text-muted-foreground")}
                            onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { team: t })); setOpenTeamPopover(null) }}
                          >
                            <Circle className={cn("size-3", teamColors[t])} />
                            {t}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                    <Popover open={openMilestonePopover === issue.id} onOpenChange={(v) => setOpenMilestonePopover(v ? issue.id : null)}>
                      <PopoverTrigger
                        render={
                          <button
                            data-milestone-btn
                            onClick={(e) => e.stopPropagation()}
                            className={cn("flex w-28 shrink-0 items-center gap-1 rounded border px-1 py-0.5 text-sm font-medium transition-colors hover:bg-accent", issue.milestone_id ? (cn("border-border/30 text-red-400/60 [&_svg]:text-red-400/60")) : "border-dashed border-transparent group-hover:border-border/30 text-transparent group-hover:text-muted-foreground/40 hover:border-border/60 hover:text-muted-foreground/70")}
                          >
                            {issue.milestone_id && milestoneMap.has(issue.milestone_id) ? (
                              <><Diamond className="size-3.5 shrink-0" /><span className="truncate">{milestoneMap.get(issue.milestone_id)!.name}</span></>
                            ) : (
                              <><Plus className="size-3 mr-0.5 shrink-0" />Milestone</>
                            )}
                          </button>
                        }
                      />
                      <PopoverContent className="w-40 p-1" align="start">
                        <button
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                            onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { milestone_id: null })); setOpenMilestonePopover(null) }}
                        >
                          <Diamond className="size-3 text-muted-foreground/40" />
                          No Milestone
                        </button>
                        {projectMilestones.map((m) => (
                          <button
                            key={m.id}
                            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", issue.milestone_id === m.id ? "text-foreground" : "text-muted-foreground")}
                            onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { milestone_id: m.id })); setOpenMilestonePopover(null) }}
                          >
                            <Diamond className="size-3 text-red-400/60 shrink-0" />
                            {m.name}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                    <Popover open={openAssigneePopover === issue.id} onOpenChange={(v) => setOpenAssigneePopover(v ? issue.id : null)}>
                      <PopoverTrigger
                        render={
                          <button
                            data-assignee-btn
                            onClick={(e) => e.stopPropagation()}
                            className={cn("flex w-36 shrink-0 items-center justify-end gap-1.5 rounded border px-1 py-0.5 text-sm font-medium transition-colors hover:bg-accent", issue.assignee_id && userMap.has(issue.assignee_id) ? "border-border/30" : "border-dashed border-transparent group-hover:border-border/30 text-transparent group-hover:text-muted-foreground/40 hover:border-border/60 hover:text-muted-foreground/70")}
                          >
                            {issue.assignee_id && userMap.has(issue.assignee_id) ? (
                              <>
                                <span className="text-sm text-muted-foreground truncate">
                                  {userMap.get(issue.assignee_id)?.name ?? userMap.get(issue.assignee_id)?.email}
                                </span>
                                <Avatar className="size-6">
                                  <AvatarFallback className="text-[11px]">
                                    {(userMap.get(issue.assignee_id)?.name ?? "?")[0].toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </>
                            ) : (
                              <><Plus className="size-3 mr-0.5 shrink-0" />Assignee</>
                            )}
                          </button>
                        }
                      />
                      <PopoverContent className="w-36 p-1" align="end">
                        <button
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                            onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { assignee_id: null })); setOpenAssigneePopover(null) }}
                        >
                          <Circle className="size-3 text-muted-foreground/40" />
                          No Assignee
                        </button>
                        {users.map((u) => (
                          <button
                            key={u.id}
                            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", issue.assignee_id === u.id ? "text-foreground" : "text-muted-foreground")}
                            onClick={(e) => { e.stopPropagation(); requireAuth(() => updateIssue(issue.id, { assignee_id: u.id })); setOpenAssigneePopover(null) }}
                          >
                            <Avatar className="size-5">
                              <AvatarFallback className="text-[9px]">{(u.name ?? u.email)[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            {u.name ?? u.email}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 flex items-center justify-between border-t border-border/50 bg-background px-6 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <button
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="inline size-3 mr-1" />
              Clear
            </button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
          >
            <Trash2 className="size-3.5 mr-1" />
            Delete {selectedIds.size > 1 ? `(${selectedIds.size})` : ""}
          </Button>
        </div>
      )}
      <IssueDetailModal
        issue={detailIssue}
        users={users}
        open={detailIssue !== null}
        onOpenChange={(v) => { if (!v) { setDetailIssueId(null); setDetailParentIssue(null) } }}
        onOpenDetail={(target) => { setDetailParentIssue(target.is_epic ? null : detailIssue); setDetailIssueId(target.id) }}
        parentIssue={detailParentIssue}
      />
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-xs">
          <DialogTitle className="text-sm font-medium">Delete {selectedIds.size} {selectedIds.size === 1 ? "issue" : "issues"}?</DialogTitle>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={confirmDeleteAction}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
      {viewLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {ctxMenu && (
        <IssueContextMenu
          issue={ctxMenu.issue}
          users={users}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onChange={applyCtxChange}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}
