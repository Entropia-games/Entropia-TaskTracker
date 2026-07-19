"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { useIssues, type Issue, type IssueStatus, type IssuePriority, type IssueTeam } from "@/lib/issues-context"
import { getSupabase } from "@/lib/supabase"
import type { Database } from "@/lib/database.types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn, userAvatarColor } from "@/lib/utils"
import { UserDisplayName } from "@/components/ui/display-name"
import { useDeptMap } from "@/lib/use-dept-map"
import { format, differenceInDays, addDays, startOfDay, min as dateMin, max as dateMax } from "date-fns"
import { Plus, X, Layers, Search, GripVertical, ChevronDown, Circle, CircleOff, CircleDot, CircleCheck, Diamond, ArrowDown, ArrowUp, Minus, AlertCircle, Lock } from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { IssueDetailModal } from "@/components/issue-detail-modal"
import { useAuth } from "@/lib/auth-context"
import { useTimelineCursors, type TimelineCursor } from "@/lib/timeline-cursors"

const CURSOR_PALETTE = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#eab308"]
function cursorColorFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CURSOR_PALETTE[h % CURSOR_PALETTE.length]
}

const CURSOR_SMOOTH_TIME = 0.09

function smoothDamp(current: number, target: number, vel: { v: number }, smoothTime: number, dt: number) {
  const omega = 2 / smoothTime
  const x = omega * dt
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const change = current - target
  const temp = (vel.v + omega * change) * dt
  vel.v = (vel.v - omega * temp) * exp
  return target + (change + temp) * exp
}

function RemoteCursor({ cursor }: { cursor: TimelineCursor }) {
  const ref = useRef<HTMLDivElement>(null)
  const posRef = useRef({ x: cursor.x, y: cursor.y })
  const velRef = useRef({ x: { v: 0 }, y: { v: 0 } })
  const targetRef = useRef({ x: cursor.x, y: cursor.y })
  targetRef.current = { x: cursor.x, y: cursor.y }
  const initialTransform = useRef(`translate(${cursor.x}px, ${cursor.y}px)`)

  useEffect(() => {
    let raf = 0
    let lastT = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - lastT) / 1000, 0.05)
      lastT = now
      const p = posRef.current
      const t = targetRef.current
      p.x = smoothDamp(p.x, t.x, velRef.current.x, CURSOR_SMOOTH_TIME, dt)
      p.y = smoothDamp(p.y, t.y, velRef.current.y, CURSOR_SMOOTH_TIME, dt)
      if (ref.current) ref.current.style.transform = `translate(${p.x}px, ${p.y}px)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 z-30 flex items-start gap-1"
      style={{ transform: initialTransform.current, willChange: "transform" }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 drop-shadow">
        <path d="M4 2l6 16 2.5-6.5L19 9 4 2z" fill={cursor.color} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span className="rounded px-1 py-0.5 text-[10px] font-medium text-white whitespace-nowrap" style={{ backgroundColor: cursor.color }}>
        {cursor.name}
      </span>
    </div>
  )
}

const teamColors: Record<string, string> = {
  "3D": "bg-red-500/35 border-red-500/55 text-red-300",
  Concept: "bg-blue-500/35 border-blue-500/55 text-blue-300",
  DEV: "bg-purple-500/35 border-purple-500/55 text-purple-300",
  QA: "bg-white/25 border-white/40 text-white/90",
  GD: "bg-yellow-500/35 border-yellow-500/55 text-yellow-300",
  Sound: "bg-orange-500/35 border-orange-500/55 text-orange-300",
  LD: "bg-green-500/35 border-green-500/55 text-green-300",
}

const teamTextColors: Record<string, string> = {
  "3D": "text-red-400",
  Concept: "text-blue-400",
  DEV: "text-purple-400",
  QA: "text-white/80",
  GD: "text-yellow-400",
  Sound: "text-orange-400",
  LD: "text-green-400",
}

const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
}
const STATUS_ICON: Record<IssueStatus, typeof Circle> = {
  backlog: CircleOff,
  todo: Circle,
  in_progress: CircleDot,
  done: CircleCheck,
  canceled: CircleOff,
}
const STATUS_COLOR: Record<IssueStatus, string> = {
  backlog: "text-muted-foreground/40",
  todo: "text-muted-foreground",
  in_progress: "text-yellow-400",
  done: "text-green-400",
  canceled: "text-muted-foreground/40",
}
const PRIORITY_ICON: Record<IssuePriority, typeof Minus> = {
  none: Minus,
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  urgent: AlertCircle,
}
const PRIORITY_COLOR: Record<IssuePriority, string> = {
  none: "text-muted-foreground/40",
  low: "text-muted-foreground",
  medium: "text-blue-400",
  high: "text-orange-400",
  urgent: "text-red-400",
}
const TEAMS: IssueTeam[] = ["3D", "Concept", "DEV", "QA", "GD", "Sound", "LD"]

const COLUMN_WIDTH = 40
const ROW_HEIGHT = 48
const SWIMLANE_WIDTH = 340
const HEADER_HEIGHT = 44

type TimelineEntry = {
  issueId: number
  startDate: string
  endDate: string
  color?: string
}

const ROW_COLORS: { id: string; bar: string; row: string; rowHover: string; dot: string }[] = [
  { id: "rose", bar: "bg-rose-300/60 border border-rose-400/80 text-rose-900", row: "bg-rose-300/30 border-l-4 border-l-rose-400", rowHover: "hover:bg-rose-200/50", dot: "bg-rose-300 border-rose-400" },
  { id: "orange", bar: "bg-orange-300/60 border border-orange-400/80 text-orange-900", row: "bg-orange-300/30 border-l-4 border-l-orange-400", rowHover: "hover:bg-orange-200/50", dot: "bg-orange-300 border-orange-400" },
  { id: "amber", bar: "bg-amber-300/60 border border-amber-400/80 text-amber-900", row: "bg-amber-300/30 border-l-4 border-l-amber-400", rowHover: "hover:bg-amber-200/50", dot: "bg-amber-300 border-amber-400" },
  { id: "yellow", bar: "bg-yellow-300/60 border border-yellow-400/80 text-yellow-900", row: "bg-yellow-300/30 border-l-4 border-l-yellow-400", rowHover: "hover:bg-yellow-200/50", dot: "bg-yellow-300 border-yellow-400" },
  { id: "lime", bar: "bg-lime-300/60 border border-lime-400/80 text-lime-900", row: "bg-lime-300/30 border-l-4 border-l-lime-400", rowHover: "hover:bg-lime-200/50", dot: "bg-lime-300 border-lime-400" },
  { id: "green", bar: "bg-green-300/60 border border-green-400/80 text-green-900", row: "bg-green-300/30 border-l-4 border-l-green-400", rowHover: "hover:bg-green-200/50", dot: "bg-green-300 border-green-400" },
  { id: "emerald", bar: "bg-emerald-300/60 border border-emerald-400/80 text-emerald-900", row: "bg-emerald-300/30 border-l-4 border-l-emerald-400", rowHover: "hover:bg-emerald-200/50", dot: "bg-emerald-300 border-emerald-400" },
  { id: "teal", bar: "bg-teal-300/60 border border-teal-400/80 text-teal-900", row: "bg-teal-300/30 border-l-4 border-l-teal-400", rowHover: "hover:bg-teal-200/50", dot: "bg-teal-300 border-teal-400" },
  { id: "cyan", bar: "bg-cyan-300/60 border border-cyan-400/80 text-cyan-900", row: "bg-cyan-300/30 border-l-4 border-l-cyan-400", rowHover: "hover:bg-cyan-200/50", dot: "bg-cyan-300 border-cyan-400" },
  { id: "sky", bar: "bg-sky-300/60 border border-sky-400/80 text-sky-900", row: "bg-sky-300/30 border-l-4 border-l-sky-400", rowHover: "hover:bg-sky-200/50", dot: "bg-sky-300 border-sky-400" },
  { id: "blue", bar: "bg-blue-300/60 border border-blue-400/80 text-blue-900", row: "bg-blue-300/30 border-l-4 border-l-blue-400", rowHover: "hover:bg-blue-200/50", dot: "bg-blue-300 border-blue-400" },
  { id: "indigo", bar: "bg-indigo-300/60 border border-indigo-400/80 text-indigo-900", row: "bg-indigo-300/30 border-l-4 border-l-indigo-400", rowHover: "hover:bg-indigo-200/50", dot: "bg-indigo-300 border-indigo-400" },
  { id: "violet", bar: "bg-violet-300/60 border border-violet-400/80 text-violet-900", row: "bg-violet-300/30 border-l-4 border-l-violet-400", rowHover: "hover:bg-violet-200/50", dot: "bg-violet-300 border-violet-400" },
  { id: "purple", bar: "bg-purple-300/60 border border-purple-400/80 text-purple-900", row: "bg-purple-300/30 border-l-4 border-l-purple-400", rowHover: "hover:bg-purple-200/50", dot: "bg-purple-300 border-purple-400" },
  { id: "fuchsia", bar: "bg-fuchsia-300/60 border border-fuchsia-400/80 text-fuchsia-900", row: "bg-fuchsia-300/30 border-l-4 border-l-fuchsia-400", rowHover: "hover:bg-fuchsia-200/50", dot: "bg-fuchsia-300 border-fuchsia-400" },
  { id: "pink", bar: "bg-pink-300/60 border border-pink-400/80 text-pink-900", row: "bg-pink-300/30 border-l-4 border-l-pink-400", rowHover: "hover:bg-pink-200/50", dot: "bg-pink-300 border-pink-400" },
]

const ROW_DEFAULT = "bg-muted/60 border-border/55 text-foreground"

type RowColorObj = { id: string; bar: string; row: string; rowHover: string; dot: string } | null

function SortableTimelineRow({
  issue,
  idx,
  viewTeam,
  rowColorObj,
  userMap,
  deptMap,
  onOpen,
  onRemove,
  lock,
}: {
  issue: Issue & { timelineStart: Date; timelineEnd: Date }
  idx: number
  viewTeam: boolean
  rowColorObj: RowColorObj
  userMap: Map<string, Database["public"]["Tables"]["users"]["Row"]>
  deptMap: Map<string, string>
  onOpen: () => void
  onRemove: (id: number) => void
  lock: { userId: string; name: string; color: string } | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id, disabled: !!lock })
  const style = {
    height: ROW_HEIGHT,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    zIndex: isDragging ? 30 : undefined,
  }
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...(lock ? { boxShadow: `inset 3px 0 0 ${lock.color}` } : {}) }}
      {...(lock ? {} : attributes)}
      {...(lock ? {} : listeners)}
      className={cn("flex items-center", lock && "cursor-not-allowed")}
      onClick={lock ? undefined : onOpen}
    >
      <div className={cn("group flex w-full items-center gap-2 rounded-md border border-white/20 px-4 py-1.5 transition-colors", idx % 2 === 0 && !rowColorObj && "bg-muted/10 hover:bg-muted/20", rowColorObj?.row, rowColorObj?.rowHover, lock && "opacity-60")}>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {issue.is_epic && <Layers className="size-3 shrink-0 text-purple-400" />}
          <span className="text-xs truncate">{issue.title}</span>
          {lock && (
            <span className="flex shrink-0 items-center gap-0.5 rounded px-1 text-[9px] font-medium text-white" style={{ backgroundColor: lock.color }} title={`${lock.name} is editing`}>
              <Lock className="size-2.5" />
              {lock.name}
            </span>
          )}
        </div>
        {viewTeam ? (
          issue.team ? (
            <span className={cn("flex h-6 items-center shrink-0 text-[11px] font-medium", teamTextColors[issue.team] ?? "text-muted-foreground/70")}>{issue.team}</span>
          ) : (
            <span className="flex h-6 items-center shrink-0 text-[11px] font-medium text-muted-foreground/30">—</span>
          )
        ) : (
          issue.assignee_id && userMap.has(issue.assignee_id) && (
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="max-w-[110px] truncate text-xs text-muted-foreground"><UserDisplayName name={userMap.get(issue.assignee_id)?.name} email={userMap.get(issue.assignee_id)?.email ?? ""} displayName={userMap.get(issue.assignee_id)?.display_name} department={deptMap.get(issue.assignee_id)} /></span>
              <Avatar className="size-6 shrink-0">
                <AvatarFallback className={cn(userAvatarColor((userMap.get(issue.assignee_id)?.name ?? "?")), "text-[10px]")}>{(userMap.get(issue.assignee_id)?.name ?? "?")[0].toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
          )
        )}
        <button onClick={(e) => { e.stopPropagation(); onRemove(issue.id) }} className="shrink-0 rounded p-0.5 text-muted-foreground/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <X className="size-3" />
        </button>
      </div>
    </div>
  )
}

export default function TimelinePage() {
  const { issues, currentProject, milestones } = useIssues()
  const { user, username, displayName } = useAuth()
  const me = useMemo(
    () => (user ? { id: user.id, name: displayName || username || user.email || "Anon", color: cursorColorFor(user.id) } : null),
    [user, username, displayName],
  )
  const { cursors, sendCursor, locks, lockIssue, unlockIssue } = useTimelineCursors(currentProject?.id ?? null, me)
  const cursorSentRef = useRef(0)
  const panelContentRef = useRef<HTMLDivElement>(null)
  const locksRef = useRef(locks)
  locksRef.current = locks
  const meRef = useRef(me)
  meRef.current = me
  const lockedByOther = useCallback(
    (issueId: number) => {
      const l = locks[issueId]
      return l && l.userId !== me?.id ? l : null
    },
    [locks, me?.id],
  )
  const [users, setUsers] = useState<Database["public"]["Tables"]["users"]["Row"][]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [syncScroll, setSyncScroll] = useState(0)
  const [syncScrollY, setSyncScrollY] = useState(0)
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const [addOpen, setAddOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewTeam, setViewTeam] = useState(false)
  const [dayOffset, setDayOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState<IssueStatus | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | null>(null)
  const [teamFilter, setTeamFilter] = useState<IssueTeam | null>(null)
  const [milestoneFilter, setMilestoneFilter] = useState<number | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<"all" | "issue" | "epic">("all")
  const projectMilestones = useMemo(
    () => milestones.filter((m) => m.project_id === currentProject?.id),
    [milestones, currentProject],
  )
  const [detailIssueId, setDetailIssueId] = useState<number | null>(null)
  const [detailParentIssue, setDetailParentIssue] = useState<Issue | null>(null)
  const detailIssue = detailIssueId ? issues.find((i) => i.id === detailIssueId) ?? null : null
  const [resizing, setResizing] = useState<{ issueId: number; side: "left" | "right" } | null>(null)
  const [moving, setMoving] = useState<{ issueId: number; startClientX: number; origStart: Date; origEnd: Date } | null>(null)

  useEffect(() => {
    getSupabase().from("users").select("*").then(({ data }) => {
      if (data) setUsers(data)
    })
  }, [])

  const loadEntries = useCallback(async () => {
    if (!currentProject) return
    const { data } = await getSupabase()
      .from("timeline_entries")
      .select("*")
      .eq("project_id", currentProject.id)
      .order("position")
    if (data) {
      setEntries(
        data.map((r) => ({
          issueId: r.issue_id,
          startDate: r.start_date,
          endDate: r.end_date,
          color: r.color ?? undefined,
        })),
      )
    }
  }, [currentProject])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const busyRef = useRef(false)
  const pendingReloadRef = useRef(false)
  const persistOneRef = useRef<(id: number) => Promise<void>>(async () => {})

  const finishGesture = useCallback(async (issueId: number) => {
    await persistOneRef.current(issueId)
    unlockIssue(issueId)
    busyRef.current = false
    if (pendingReloadRef.current) {
      pendingReloadRef.current = false
      loadEntries()
    }
  }, [loadEntries, unlockIssue])

  useEffect(() => {
    if (!currentProject) return
    const sb = getSupabase()
    const channel = sb
      .channel(`timeline-${currentProject.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "timeline_entries", filter: `project_id=eq.${currentProject.id}` },
        () => {
          if (busyRef.current) {
            pendingReloadRef.current = true
          } else {
            loadEntries()
          }
        },
      )
      .subscribe()
    return () => {
      sb.removeChannel(channel)
    }
  }, [currentProject, loadEntries])

  const persistEntries = useCallback(
    async (next: TimelineEntry[]) => {
      setEntries(next)
      if (!currentProject) return
      const sb = getSupabase()
      const prev = entriesRef.current
      const nextIds = new Set(next.map((e) => e.issueId))
      const removed = prev.filter((e) => !nextIds.has(e.issueId))
      const rows = next.map((e, i) => ({
        project_id: currentProject.id,
        issue_id: e.issueId,
        start_date: e.startDate,
        end_date: e.endDate,
        color: e.color ?? null,
        position: i,
      }))
      if (removed.length > 0) {
        await sb
          .from("timeline_entries")
          .delete()
          .eq("project_id", currentProject.id)
          .in("issue_id", removed.map((r) => r.issueId))
      }
      const { error } = await sb
        .from("timeline_entries")
        .upsert(rows, { onConflict: "project_id,issue_id" })
      if (error) console.error("Failed to persist timeline entries", JSON.stringify(error))
    },
    [currentProject],
  )

  const updateEntryLocal = useCallback((issueId: number, changes: Partial<TimelineEntry>) => {
    setEntries((prev) => prev.map((e) => e.issueId === issueId ? { ...e, ...changes } : e))
  }, [])

  const persistOne = useCallback(async (issueId: number) => {
    if (!currentProject) return
    const idx = entriesRef.current.findIndex((e) => e.issueId === issueId)
    if (idx === -1) return
    const e = entriesRef.current[idx]
    const { error } = await getSupabase()
      .from("timeline_entries")
      .upsert(
        {
          project_id: currentProject.id,
          issue_id: e.issueId,
          start_date: e.startDate,
          end_date: e.endDate,
          color: e.color ?? null,
          position: idx,
        },
        { onConflict: "project_id,issue_id" },
      )
    if (error) console.error("Failed to persist timeline entry", JSON.stringify(error))
  }, [currentProject])
  persistOneRef.current = persistOne

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const deptMap = useDeptMap()
  const issueMap = useMemo(() => new Map(issues.map((i) => [i.id, i])), [issues])
  const entryColorMap = useMemo(() => new Map(entries.map((e) => [e.issueId, e.color])), [entries])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const reorderTimeline = useCallback((orderedIds: number[]) => {
    const idSet = new Set(orderedIds)
    const ordered = orderedIds
      .map((id) => entries.find((e) => e.issueId === id))
      .filter((e): e is TimelineEntry => e !== undefined)
    const rest = entries.filter((e) => !idSet.has(e.issueId))
    persistEntries([...ordered, ...rest])
  }, [entries, persistEntries])

  const handleTimelineDragStart = (event: DragStartEvent) => {
    busyRef.current = true
    lockIssue(event.active.id as number)
  }

  const handleTimelineDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    unlockIssue(active.id as number)
    busyRef.current = false
    if (pendingReloadRef.current) {
      pendingReloadRef.current = false
      loadEntries()
    }
    if (!over || active.id === over.id) return
    const oldIndex = timelineIssues.findIndex((i) => i.id === active.id)
    const newIndex = timelineIssues.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(timelineIssues.map((i) => i.id), oldIndex, newIndex)
    reorderTimeline(newOrder)
  }

  const timelineIssues = useMemo(() => {
    return entries
      .map((e) => {
        const issue = issueMap.get(e.issueId)
        if (!issue) return null
        return {
          ...issue,
          timelineStart: startOfDay(new Date(e.startDate)),
          timelineEnd: startOfDay(new Date(e.endDate)),
        }
      })
      .filter((i): i is NonNullable<typeof i> => i !== null && i.timelineEnd >= i.timelineStart)
      .filter((i) =>
        (!statusFilter || i.status === statusFilter) &&
        (!priorityFilter || i.priority === priorityFilter) &&
        (!teamFilter || i.team === teamFilter) &&
        (!milestoneFilter || i.milestone_id === milestoneFilter) &&
        (!assigneeFilter || (assigneeFilter === "__none__" ? !i.assignee_id : i.assignee_id === assigneeFilter)) &&
        (typeFilter === "all" || (typeFilter === "issue" ? !i.is_epic : i.is_epic))
      )
  }, [entries, issueMap, statusFilter, priorityFilter, teamFilter, milestoneFilter, assigneeFilter, typeFilter])

  const dateRange = useMemo(() => {
    const today = startOfDay(addDays(new Date(), dayOffset))
    if (timelineIssues.length === 0) {
      return { start: today, end: addDays(today, 30), totalDays: 30 }
    }
    const end = dateMax(timelineIssues.map((i) => i.timelineEnd))
    const totalDays = Math.max(differenceInDays(end, today) + 1, 30)
    return { start: today, end, totalDays }
  }, [timelineIssues, dayOffset])

  const dateRangeRef = useRef(dateRange)
  dateRangeRef.current = dateRange

  const days = useMemo(() => {
    return Array.from({ length: dateRange.totalDays }, (_, i) => addDays(dateRange.start, i))
  }, [dateRange])

  const handleSyncScroll = () => {
    if (scrollRef.current) {
      setSyncScroll(scrollRef.current.scrollLeft)
      setSyncScrollY(scrollRef.current.scrollTop)
    }
  }

  const addEntry = (issueId: number) => {
    const issue = issueMap.get(issueId)
    if (!issue) return
    const start = startOfDay(new Date(issue.created_at))
    const end = issue.due_date ? startOfDay(new Date(issue.due_date)) : addDays(start, 14)
    const next: TimelineEntry = {
      issueId,
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    }
    persistEntries([...entries, next])
  }

  const removeEntry = (issueId: number) => {
    persistEntries(entries.filter((e) => e.issueId !== issueId))
  }

  const availableIssues = useMemo(() => {
    const addedIds = new Set(entries.map((e) => e.issueId))
    const q = searchQuery.toLowerCase()
    return issues.filter((i) => !addedIds.has(i.id) && (i.title.toLowerCase().includes(q) || `${currentProject?.code ?? "?"}-${i.display_id}`.toLowerCase().includes(q)))
  }, [issues, entries, searchQuery, currentProject])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, issueId: number, side: "left" | "right") => {
    e.preventDefault()
    e.stopPropagation()
    const l = locksRef.current[issueId]
    if (l && l.userId !== meRef.current?.id) return
    busyRef.current = true
    lockIssue(issueId)
    setResizing({ issueId, side })
  }, [lockIssue])

  const handleMoveMouseDown = useCallback((e: React.MouseEvent, issueId: number) => {
    e.preventDefault()
    e.stopPropagation()
    const l = locksRef.current[issueId]
    if (l && l.userId !== meRef.current?.id) return
    const entry = entries.find((en) => en.issueId === issueId)
    if (!entry) return
    busyRef.current = true
    lockIssue(issueId)
    setMoving({
      issueId,
      startClientX: e.clientX,
      origStart: startOfDay(new Date(entry.startDate)),
      origEnd: startOfDay(new Date(entry.endDate)),
    })
  }, [entries])

  useEffect(() => {
    if (!resizing) return
    const gridEl = gridRef.current
    const scrollEl = scrollRef.current
    if (!gridEl || !scrollEl) return

    document.body.style.cursor = "col-resize"
    let autoScrollFrame: number | null = null

    const handleMouseMove = (e: MouseEvent) => {
      const gridRect = gridEl.getBoundingClientRect()
      const scrollLeft = scrollEl.scrollLeft
      const mouseX = e.clientX - gridRect.left + scrollLeft
      const colIndex = Math.max(0, Math.round(mouseX / COLUMN_WIDTH))
      const newDate = format(addDays(dateRangeRef.current.start, colIndex), "yyyy-MM-dd")

      const entry = entriesRef.current.find((en) => en.issueId === resizing.issueId)
      if (!entry) return

      if (resizing.side === "left") {
        if (newDate < entry.endDate) {
          updateEntryLocal(resizing.issueId, { startDate: newDate })
        }
      } else {
        if (newDate > entry.startDate) {
          updateEntryLocal(resizing.issueId, { endDate: newDate })
        }
      }

      const viewportX = e.clientX - gridRect.left
      const edgeThreshold = 40
      if (viewportX > gridRect.width - edgeThreshold) {
        if (!autoScrollFrame) {
          autoScrollFrame = window.setInterval(() => {
            scrollEl.scrollLeft += 8
          }, 16)
        }
      } else if (viewportX < edgeThreshold) {
        if (!autoScrollFrame) {
          autoScrollFrame = window.setInterval(() => {
            scrollEl.scrollLeft = Math.max(0, scrollEl.scrollLeft - 8)
          }, 16)
        }
      } else {
        if (autoScrollFrame !== null) { clearInterval(autoScrollFrame); autoScrollFrame = null }
      }
    }

    const handleMouseUp = () => {
      if (autoScrollFrame !== null) { clearInterval(autoScrollFrame) }
      document.body.style.cursor = ""
      finishGesture(resizing.issueId)
      setResizing(null)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    return () => {
      document.body.style.cursor = ""
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [resizing, updateEntryLocal, finishGesture])

  const updateEntryLocalRef = useRef(updateEntryLocal)
  updateEntryLocalRef.current = updateEntryLocal

  useEffect(() => {
    if (!moving) return
    document.body.style.cursor = "grabbing"
    const handleMouseMove = (e: MouseEvent) => {
      const colDelta = Math.round((e.clientX - moving.startClientX) / COLUMN_WIDTH)
      const newStart = format(addDays(moving.origStart, colDelta), "yyyy-MM-dd")
      const newEnd = format(addDays(moving.origEnd, colDelta), "yyyy-MM-dd")
      updateEntryLocalRef.current(moving.issueId, { startDate: newStart, endDate: newEnd })
    }
    const handleMouseUp = () => {
      document.body.style.cursor = ""
      finishGesture(moving.issueId)
      setMoving(null)
    }
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    return () => {
      document.body.style.cursor = ""
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [moving, finishGesture])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-medium">Timeline</h1>
          <span className="text-xs text-muted-foreground/50">{timelineIssues.length} items</span>
          <span className="mx-1 h-4 w-px bg-border" />
          <Popover>
            <PopoverTrigger
              render={
                <button className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent", typeFilter !== "all" ? "text-foreground" : "text-muted-foreground")}>
                  {typeFilter === "issue" ? "Issues" : typeFilter === "epic" ? "Epics" : "All types"}
                  <ChevronDown className="size-3" />
                </button>
              }
            />
            <PopoverContent className="w-36 p-1" align="start">
              <button className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", typeFilter === "all" ? "text-foreground" : "text-muted-foreground")} onClick={() => setTypeFilter("all")}>All</button>
              <button className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", typeFilter === "issue" ? "text-foreground" : "text-muted-foreground")} onClick={() => setTypeFilter("issue")}>Issues</button>
              <button className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", typeFilter === "epic" ? "text-foreground" : "text-muted-foreground")} onClick={() => setTypeFilter("epic")}>Epics</button>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger
              render={
                <button className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent", statusFilter ? "text-foreground" : "text-muted-foreground")}>
                  Status{statusFilter ? `: ${STATUS_LABELS[statusFilter]}` : ""}
                  <ChevronDown className="size-3" />
                </button>
              }
            />
            <PopoverContent className="w-40 p-1" align="start">
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent" onClick={() => setStatusFilter(null)}>All</button>
              {(Object.keys(STATUS_LABELS) as IssueStatus[]).map((s) => {
                const SIcon = STATUS_ICON[s]
                return (
                  <button key={s} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", statusFilter === s ? "text-foreground" : "text-muted-foreground")} onClick={() => setStatusFilter(s)}>
                    <SIcon className={cn("size-3.5", STATUS_COLOR[s])} />
                    {STATUS_LABELS[s]}
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger
              render={
                <button className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent", priorityFilter ? "text-foreground" : "text-muted-foreground")}>
                  Priority{priorityFilter ? `: ${priorityFilter}` : ""}
                  <ChevronDown className="size-3" />
                </button>
              }
            />
            <PopoverContent className="w-40 p-1" align="start">
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent" onClick={() => setPriorityFilter(null)}>All</button>
              {(Object.keys(PRIORITY_ICON) as IssuePriority[]).map((p) => {
                const PIcon = PRIORITY_ICON[p]
                return (
                  <button key={p} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", priorityFilter === p ? "text-foreground" : "text-muted-foreground")} onClick={() => setPriorityFilter(p)}>
                    <PIcon className={cn("size-3.5", PRIORITY_COLOR[p])} />
                    {p}
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger
              render={
                <button className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent", teamFilter ? "text-foreground" : "text-muted-foreground")}>
                  Team{teamFilter ? `: ${teamFilter}` : ""}
                  <ChevronDown className="size-3" />
                </button>
              }
            />
            <PopoverContent className="w-32 p-1" align="start">
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent" onClick={() => setTeamFilter(null)}>All</button>
              {TEAMS.map((t) => (
                <button key={t} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", teamFilter === t ? "text-foreground" : "text-muted-foreground")} onClick={() => setTeamFilter(t)}>
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
                  <button className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent", milestoneFilter ? "text-foreground" : "text-muted-foreground")}>
                    <Diamond className={cn("size-3", milestoneFilter ? "text-red-400/60" : "text-muted-foreground/40")} />
                    Milestone{milestoneFilter ? `: ${projectMilestones.find((m) => m.id === milestoneFilter)?.name}` : ""}
                    <ChevronDown className="size-3" />
                  </button>
                }
              />
              <PopoverContent className="w-48 p-1" align="start">
                <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent" onClick={() => setMilestoneFilter(null)}>All</button>
                {projectMilestones.map((m) => (
                  <button key={m.id} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", milestoneFilter === m.id ? "text-foreground" : "text-muted-foreground")} onClick={() => setMilestoneFilter(m.id)}>
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
                <button className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent", assigneeFilter ? "text-foreground" : "text-muted-foreground")}>
                  {assigneeFilter === "__none__"
                    ? "Unassigned"
                    : assigneeFilter
                      ? <>
  <UserDisplayName name={users.find((u) => u.id === assigneeFilter)?.name} email={users.find((u) => u.id === assigneeFilter)?.email ?? ""} displayName={users.find((u) => u.id === assigneeFilter)?.display_name} department={deptMap.get(assigneeFilter ?? "")} />
</>
                      : "Assignee"}
                  <ChevronDown className="size-3" />
                </button>
              }
            />
            <PopoverContent className="w-48 p-1" align="start">
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent" onClick={() => setAssigneeFilter(null)}>All</button>
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent" onClick={() => setAssigneeFilter("__none__")}>
                <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/20 text-[9px]">?</span>
                Unassigned
              </button>
              {users.map((u) => (
                <button key={u.id} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", assigneeFilter === u.id ? "text-foreground" : "text-muted-foreground")} onClick={() => setAssigneeFilter(u.id)}>
                  <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/30 text-[9px] font-medium text-foreground">
                    {(u.name ?? u.email[0])[0].toUpperCase()}
                  </span>
                  <UserDisplayName name={u.name} email={u.email} displayName={u.display_name} department={deptMap.get(u.id)} />
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            View Team
            <button
              onClick={() => setViewTeam((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border/30 transition-colors",
                viewTeam ? "bg-blue-500/20 border-blue-500/40" : "bg-muted/30",
              )}
            >
              <span className={cn(
                "inline-block size-3.5 rounded-full transition-transform",
                viewTeam ? "translate-x-[18px] bg-blue-400" : "translate-x-[2px] bg-muted-foreground/50",
              )} />
            </button>
          </span>
          <span className={cn("flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs", dayOffset !== 0 ? "border-yellow-500/40 text-yellow-300" : "border-border/30 text-muted-foreground")}>
            <button onClick={() => setDayOffset((o) => o - 1)} className="px-1 hover:text-foreground" title="Back a day">{"‹"}</button>
            <span className="font-mono tabular-nums">{format(addDays(startOfDay(new Date()), dayOffset), "MMM d")}{dayOffset !== 0 && <span className="ml-1 opacity-60">+{dayOffset}d</span>}</span>
            <button onClick={() => setDayOffset((o) => o + 1)} className="px-1 hover:text-foreground" title="Forward a day">{"›"}</button>
            {dayOffset !== 0 && (
              <button onClick={() => setDayOffset(0)} className="ml-1 rounded px-1 hover:bg-accent hover:text-foreground" title="Reset to real today">today</button>
            )}
          </span>
          <Button size="sm" variant="outline" onClick={() => { setSearchQuery(""); setAddOpen(true) }}>
            <Plus className="size-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>
      <div className="relative flex flex-1 overflow-hidden">
        <div className="shrink-0 border-r border-border/30 px-3" style={{ width: SWIMLANE_WIDTH + 24 }}>
          <div style={{ height: HEADER_HEIGHT }} className="border-b border-border/30 px-4 flex items-center">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Tasks</span>
          </div>
          <div
            className="overflow-hidden"
            style={{ height: `calc(100% - ${HEADER_HEIGHT}px)` }}
            onMouseMove={(e) => {
              const el = panelContentRef.current
              if (!el) return
              const now = Date.now()
              if (now - cursorSentRef.current < 25) return
              cursorSentRef.current = now
              const rect = el.getBoundingClientRect()
              sendCursor("panel", e.clientX - rect.left, e.clientY - rect.top)
            }}
          >
            <div ref={panelContentRef} style={{ transform: `translateY(-${syncScroll}px)`, position: "relative" }} className="transition-none">
              {timelineIssues.length === 0 ? (
                <div className="flex items-center justify-center p-6">
                  <span className="text-xs text-muted-foreground/40">No items yet</span>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleTimelineDragStart} onDragEnd={handleTimelineDragEnd}>
                  <SortableContext items={timelineIssues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    {timelineIssues.map((issue, idx) => {
                      const foundColorId = entryColorMap.get(issue.id)
                      const rowColorObj = foundColorId ? ROW_COLORS.find((c) => c.id === foundColorId) ?? null : null
                      return (
                        <SortableTimelineRow
                          key={issue.id}
                          issue={issue}
                          idx={idx}
                          viewTeam={viewTeam}
                          rowColorObj={rowColorObj}
                          userMap={userMap}
                          deptMap={deptMap}
                          onOpen={() => { setDetailParentIssue(null); setDetailIssueId(issue.id) }}
                          onRemove={removeEntry}
                          lock={lockedByOther(issue.id)}
                        />
                      )
                    })}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="overflow-hidden border-b border-border/30" style={{ height: HEADER_HEIGHT }}>
            <div className="overflow-hidden h-full">
              <div style={{ width: dateRange.totalDays * COLUMN_WIDTH, display: "flex" }} className="h-full">
                {days.map((day, i) => (
                  <div key={i} style={{ width: COLUMN_WIDTH }} className={cn("shrink-0 flex items-center justify-center border-r border-border/10 text-[10px] text-muted-foreground/50 relative", day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/5" : "",                     day.getDay() === 1 ? "border-l-[3px] border-border/40" : "")}>
                    <span className="truncate">{format(day, "d")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div
            ref={scrollRef}
            onScroll={handleSyncScroll}
            onMouseMove={(e) => {
              const grid = gridRef.current
              if (!grid) return
              const now = Date.now()
              if (now - cursorSentRef.current < 25) return
              cursorSentRef.current = now
              const rect = grid.getBoundingClientRect()
              sendCursor("grid", e.clientX - rect.left, e.clientY - rect.top)
            }}
            className="flex-1 overflow-auto"
          >
            <div ref={gridRef} style={{ width: dateRange.totalDays * COLUMN_WIDTH, position: "relative", minHeight: timelineIssues.length * ROW_HEIGHT }}>
              {days.map((day, i) => day.getDay() === 1 ? (
                <div key={`line-${i}`} style={{ left: i * COLUMN_WIDTH, height: "100%", position: "absolute", top: 0, width: 3 }} className="bg-border/40 z-0" />
              ) : null)}
              {timelineIssues.map((issue, idx) => {
                const startCol = Math.max(0, differenceInDays(issue.timelineStart, dateRange.start))
                const endCol = differenceInDays(issue.timelineEnd, dateRange.start)
                const span = Math.max(endCol - startCol + 1, 1)
                const teamColor = issue.team && teamColors[issue.team] ? teamColors[issue.team] : ROW_DEFAULT
                const overrideId = entryColorMap.get(issue.id)
                const barColor = overrideId
                  ? (ROW_COLORS.find((c) => c.id === overrideId)?.bar ?? teamColor)
                  : teamColor
                const barLock = lockedByOther(issue.id)
                return (
                  <div
                    key={issue.id}
                    style={{
                      position: "absolute",
                      top: idx * ROW_HEIGHT + 3,
                      left: startCol * COLUMN_WIDTH,
                      width: Math.max(span * COLUMN_WIDTH - 4, 24),
                      height: ROW_HEIGHT - 6,
                      ...(barLock ? { boxShadow: `0 0 0 1.5px ${barLock.color}` } : {}),
                    }}
                    onMouseDown={barLock ? undefined : (e) => handleMoveMouseDown(e, issue.id)}
                    className={cn("rounded-md border flex items-center gap-0 text-xs font-medium select-none group", barColor, barLock ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing", (resizing?.issueId === issue.id || moving?.issueId === issue.id) ? "z-10 shadow-lg" : "")}
                    title={barLock ? `${barLock.name} is editing` : `${currentProject?.code ?? "?"}-${issue.display_id}: ${issue.title}`}
                  >
                    <div
                      onMouseDown={barLock ? undefined : (e) => handleResizeMouseDown(e, issue.id, "left")}
                      className={cn(
                        "shrink-0 flex items-center justify-center w-3 h-full cursor-col-resize opacity-0 transition-opacity rounded-l-md",
                        barLock ? "hidden" : "hover:opacity-100",
                        resizing?.issueId === issue.id && resizing?.side === "left" ? "opacity-100" : "group-hover:opacity-100",
                      )}
                    >
                      <GripVertical className="size-2.5 text-muted-foreground/60" />
                    </div>
                    {issue.is_epic && <Layers className="size-3 shrink-0 text-purple-400 mx-1" />}
                    <span className="truncate flex-1">{issue.title}</span>
                    {barLock && <Lock className="size-2.5 shrink-0 mx-1" style={{ color: barLock.color }} />}
                    {viewTeam ? (
                      issue.team ? (
                      <span className={cn("shrink-0 text-[10px] font-medium", teamTextColors[issue.team] ?? "text-muted-foreground/70")}>{issue.team}</span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-medium text-muted-foreground/30">—</span>
                      )
                    ) : (
                      issue.assignee_id && userMap.has(issue.assignee_id) && (
                          <Avatar className="size-4 shrink-0">
                           <AvatarFallback className={cn(userAvatarColor((userMap.get(issue.assignee_id)?.name ?? "?")), "text-[6px]")}>{(userMap.get(issue.assignee_id)?.name ?? "?")[0].toUpperCase()}</AvatarFallback>
                         </Avatar>
                      )
                    )}
                    <div
                      onMouseDown={barLock ? undefined : (e) => handleResizeMouseDown(e, issue.id, "right")}
                      className={cn(
                        "shrink-0 flex items-center justify-center w-3 h-full cursor-col-resize opacity-0 transition-opacity rounded-r-md",
                        barLock ? "hidden" : "hover:opacity-100",
                        resizing?.issueId === issue.id && resizing?.side === "right" ? "opacity-100" : "group-hover:opacity-100",
                      )}
                    >
                      <GripVertical className="size-2.5 text-muted-foreground/60" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Object.values(cursors).map((c) => {
            const panelWidth = SWIMLANE_WIDTH + 24
            const x = c.region === "panel" ? 12 + c.x : panelWidth + c.x - syncScroll
            const y = c.region === "panel" ? HEADER_HEIGHT + c.y - syncScroll : HEADER_HEIGHT + c.y - syncScrollY
            return <RemoteCursor key={c.userId} cursor={{ ...c, x, y }} />
          })}
        </div>
      </div>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="text-sm font-medium">Add to Timeline</DialogTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground/50" />
            <Input
              placeholder="Search issues and epics..."
              className="pl-8 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-0.5 -mx-1">
            {availableIssues.length === 0 && (
              <p className="text-xs text-muted-foreground/50 px-1 py-4 text-center">{searchQuery ? "No matches" : "All issues added"}</p>
            )}
            {availableIssues.map((issue) => (
              <button
                key={issue.id}
                onClick={() => { addEntry(issue.id); setAddOpen(false) }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent text-left"
              >
                {issue.is_epic ? <Layers className="size-3.5 shrink-0 text-purple-400" /> : <span className="size-3.5 shrink-0" />}
                <span className="text-[11px] font-mono text-muted-foreground/50 shrink-0">{currentProject?.code ?? "?"}-{issue.display_id}</span>
                <span className="truncate flex-1">{issue.title}</span>
                {issue.assignee_id && userMap.has(issue.assignee_id) && (
                  <Avatar className="size-4 shrink-0">
                    <AvatarFallback className={cn(userAvatarColor((userMap.get(issue.assignee_id)?.name ?? "?")), "text-[6px]")}>{(userMap.get(issue.assignee_id)?.name ?? "?")[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <IssueDetailModal
        issue={detailIssue}
        users={users}
        open={detailIssue !== null}
        onOpenChange={(v) => { if (!v) { setDetailIssueId(null); setDetailParentIssue(null) } }}
        onOpenDetail={(target) => { setDetailParentIssue(target.is_epic ? null : detailIssue); setDetailIssueId(target.id) }}
        parentIssue={detailParentIssue}
      />
    </div>
  )
}
