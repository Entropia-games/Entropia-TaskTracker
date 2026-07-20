"use client"

import { useState, useEffect, useMemo, type MouseEvent } from "react"
import { useIssues, type Issue, type IssueStatus, type IssuePriority, type IssueTeam, type Project, type Milestone } from "@/lib/issues-context"
import { getSupabase } from "@/lib/supabase"
import type { Database } from "@/lib/database.types"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Circle, ChevronDown, CircleDot, CircleCheck, CircleOff, ArrowUp, ArrowDown, Minus, AlertCircle, Layers, Plus, X, Diamond } from "lucide-react"
import { cn, userAvatarColor } from "@/lib/utils"
import { UserDisplayName } from "@/components/ui/display-name"
import { useDeptMap } from "@/lib/use-dept-map"
import { startOfWeek, startOfMonth, startOfDay, endOfDay, eachDayOfInterval, format } from "date-fns"

const statusLabels: Record<IssueStatus, string> = {
  backlog: "Backlog", todo: "Todo", in_progress: "In Progress", done: "Done",
}

const statusColors: Record<IssueStatus, string> = {
  backlog: "text-muted-foreground/40", todo: "text-muted-foreground", in_progress: "text-yellow-400", done: "text-green-400",
}

const statusIcons: Record<IssueStatus, typeof Circle> = {
  backlog: CircleOff, todo: Circle, in_progress: CircleDot, done: CircleCheck,
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
  "3D": "text-red-400", Concept: "text-blue-400", DEV: "text-purple-400", QA: "text-white/80", GD: "text-yellow-400", Sound: "text-orange-400", LD: "text-green-400",
}

const teams: IssueTeam[] = ["3D", "Concept", "DEV", "QA", "GD", "Sound", "LD"]

type UserRow = Database["public"]["Tables"]["users"]["Row"]

function CompletedPanel({
  title,
  since,
  issues,
  users,
  milestones,
  currentProject,
}: {
  title: string
  since: Date
  issues: Issue[]
  users: UserRow[]
  milestones: Milestone[]
  currentProject: Project | null
}) {
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | null>(null)
  const [teamFilter, setTeamFilter] = useState<IssueTeam | null>(null)
  const [milestoneFilter, setMilestoneFilter] = useState<number | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<"all" | "issue" | "epic">("all")

  const projectMilestones = useMemo(
    () => milestones.filter((m) => m.project_id === currentProject?.id),
    [milestones, currentProject],
  )
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const deptMap = useDeptMap()

  const completed = useMemo(() => {
    const sinceMs = since.getTime()
    return issues
      .filter((i) => i.status === "done" && i.updated_at && new Date(i.updated_at).getTime() >= sinceMs)
      .filter((i) =>
        (!priorityFilter || i.priority === priorityFilter) &&
        (!teamFilter || i.team === teamFilter) &&
        (!milestoneFilter || i.milestone_id === milestoneFilter) &&
        (!assigneeFilter || (assigneeFilter === "__none__" ? !i.assignee_id : i.assignee_id === assigneeFilter)) &&
        (typeFilter === "all" || (typeFilter === "issue" ? !i.is_epic : i.is_epic))
      )
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [issues, since, priorityFilter, teamFilter, milestoneFilter, assigneeFilter, typeFilter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-xs text-muted-foreground/50">{completed.length} tasks</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
              <button className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent", priorityFilter ? "text-foreground" : "text-muted-foreground")}>
                Priority{priorityFilter ? `: ${priorityFilter}` : ""}
                <ChevronDown className="size-3" />
              </button>
            }
          />
          <PopoverContent className="w-40 p-1" align="start">
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent" onClick={() => setPriorityFilter(null)}>All</button>
            {(Object.keys(priorityLabels) as IssuePriority[]).map((p) => {
              const PIcon = priorityIcons[p]
              return (
                <button key={p} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", priorityFilter === p ? "text-foreground" : "text-muted-foreground")} onClick={() => setPriorityFilter(p)}>
                  <PIcon className={cn("size-3.5", priorityColors[p])} />
                  {priorityLabels[p]}
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
            {teams.map((t) => (
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
      <div className="space-y-1">
        {completed.length === 0 ? (
          <div className="rounded-md border border-border/30 px-3 py-6 text-center text-xs text-muted-foreground/40">No completed tasks in this period</div>
        ) : (
          completed.map((i) => (
            <div key={i.id} className="flex items-center gap-2 rounded-md border border-border/30 px-3 py-2">
              <CircleCheck className="size-3.5 shrink-0 text-green-400" />
              <span className="shrink-0 text-xs font-mono text-muted-foreground/50">{currentProject?.code ?? "?"}-{i.display_id}</span>
              <span className="flex-1 truncate text-sm">{i.title}</span>
              <span className="flex w-52 shrink-0 items-center gap-2">
                <span className={cn("w-14 shrink-0 text-right text-[11px]", i.team ? teamColors[i.team] : "text-muted-foreground/30")}>{i.team ?? "—"}</span>
                <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-xs text-muted-foreground/60">
                  {i.assignee_id && userMap.has(i.assignee_id) && (
                    <>
                      <span className="truncate max-w-[100px] text-right"><UserDisplayName name={userMap.get(i.assignee_id)?.name} email={userMap.get(i.assignee_id)?.email ?? ""} displayName={userMap.get(i.assignee_id)?.display_name} department={deptMap.get(i.assignee_id)} /></span>
                      <Avatar className="size-4">
                        <AvatarFallback className={cn(userAvatarColor((userMap.get(i.assignee_id)?.name ?? "?")), "text-[8px]")}>{(userMap.get(i.assignee_id)?.name ?? "?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </>
                  )}
                </span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function BurnupChart({ issues }: { issues: Issue[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const data = useMemo(() => {
    if (issues.length === 0) return null
    const total = issues.length
    const doneDays = issues
      .filter((i) => i.status === "done" && i.updated_at)
      .map((i) => startOfDay(new Date(i.updated_at)).getTime())
      .sort((a, b) => a - b)
    const createdDays = issues.map((i) => startOfDay(new Date(i.created_at ?? Date.now())).getTime())
    const startMs = Math.min(...createdDays, ...(doneDays.length ? [doneDays[0]] : []))
    const todayMs = startOfDay(new Date()).getTime()
    const endMs = Math.max(todayMs, startMs)
    const days = eachDayOfInterval({ start: new Date(startMs), end: new Date(endMs) })
    const points = days.map((d) => ({
      date: d,
      count: doneDays.filter((t) => t <= endOfDay(d).getTime()).length,
    }))
    return { total, points }
  }, [issues])

  if (!data || data.points.length === 0) return null

  const { total, points } = data
  const W = 600
  const H = 220
  const padL = 32
  const padR = 12
  const padT = 12
  const padB = 28
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const n = points.length
  const x = (i: number) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v: number) => padT + plotH - (total === 0 ? 0 : (v / total) * plotH)

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(" ")
  const areaPath = `${linePath} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`

  const yTicks = [0, Math.round(total / 2), total].filter((v, i, a) => a.indexOf(v) === i)
  const xTickIdx = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i)
  const final = points[n - 1].count

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const vbX = ((e.clientX - rect.left) / rect.width) * W
    if (n === 1) { setHoverIdx(0); return }
    const idx = Math.round(((vbX - padL) / plotW) * (n - 1))
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)))
  }

  const hover = hoverIdx !== null ? points[hoverIdx] : null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Completed over time</h2>
        <span className="text-xs text-muted-foreground/60">{final}/{total} done</span>
      </div>
      <div className="relative" onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} className="stroke-border/40" strokeWidth={1} />
              <text x={padL - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground/50 text-[10px]">{v}</text>
            </g>
          ))}
          <path d={areaPath} className="fill-green-400/10" />
          <path d={linePath} className="stroke-green-400" strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {xTickIdx.map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-muted-foreground/50 text-[10px]">
              {format(points[i].date, "MMM d")}
            </text>
          ))}
          {hoverIdx !== null && hover && (
            <line x1={x(hoverIdx)} y1={padT} x2={x(hoverIdx)} y2={padT + plotH} className="stroke-muted-foreground/30" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {hoverIdx !== null && hover && (
          <>
            <span
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-green-400 bg-background"
              style={{ left: `${(x(hoverIdx) / W) * 100}%`, top: `${(y(hover.count) / H) * 100}%` }}
            />
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border/50 bg-popover px-2 py-1 text-center shadow-md"
              style={{ left: `${(x(hoverIdx) / W) * 100}%`, top: `calc(${(y(hover.count) / H) * 100}% - 10px)` }}
            >
              <div className="text-xs font-medium">{hover.count} done</div>
              <div className="text-[10px] text-muted-foreground/60">{format(hover.date, "MMM d, yyyy")}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function StatisticsPage() {
  const { issues, milestones, createMilestone, deleteMilestone, currentProject } = useIssues()
  const [users, setUsers] = useState<UserRow[]>([])
  const [tab, setTab] = useState<"overview" | "week" | "month">("overview")
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [milestonePopoverOpen, setMilestonePopoverOpen] = useState(false)
  const [milestoneToDelete, setMilestoneToDelete] = useState<number | null>(null)

  useEffect(() => {
    getSupabase().from("users").select("*").then(({ data }) => { if (data) setUsers(data) })
  }, [])

  const filteredIssues = selectedMilestoneId
    ? issues.filter((i) => i.milestone_id === selectedMilestoneId)
    : issues

  const total = filteredIssues.length
  const doneCount = filteredIssues.filter((i) => i.status === "done").length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  const statusCounts = {} as Record<IssueStatus, number>
  for (const s of ["backlog", "todo", "in_progress", "done"] as IssueStatus[]) {
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
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium">Statistics</h1>
          <div className="flex items-center rounded-md border border-border/30 p-0.5">
            {([
              { key: "overview", label: "Overview" },
              { key: "week", label: "This Week" },
              { key: "month", label: "This Month" },
            ] as { key: "overview" | "week" | "month"; label: string }[]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn("rounded px-2.5 py-1 text-xs transition-colors", tab === t.key ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
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
      {tab === "overview" ? (
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="mx-auto max-w-6xl space-y-4">

          {/* Top bar: milestone selector + completion */}
          <div className="flex flex-wrap items-center justify-between gap-3">
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
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Completion</span>
              <div className="h-2 w-40 rounded-full bg-border/50 overflow-hidden">
                <div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-sm text-muted-foreground/60">{doneCount}/{total} ({pct}%)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Burnup chart */}
          <div className="rounded-lg border border-border/30 p-4 lg:col-span-2">
            <BurnupChart issues={filteredIssues} />
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 content-start">
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
          <div className="space-y-2 rounded-lg border border-border/30 p-4">
            <h2 className="text-sm font-medium text-muted-foreground">By Status</h2>
            {(["backlog", "todo", "in_progress", "done"] as IssueStatus[]).map((s) => {
              const count = statusCounts[s]
              const barPct = total > 0 ? Math.round((count / total) * 100) : 0
              const Icon = statusIcons[s]
              const barColors: Record<IssueStatus, string> = {
                backlog: "bg-muted-foreground/20", todo: "bg-blue-400", in_progress: "bg-yellow-400", done: "bg-green-400",
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
          <div className="space-y-2 rounded-lg border border-border/30 p-4">
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
          <div className="space-y-2 rounded-lg border border-border/30 p-4">
            <h2 className="text-sm font-medium text-muted-foreground">By Team</h2>
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => {
                const count = teamCounts[t]
                return (
                  <div key={t} className="rounded-lg border border-border/30 px-3 py-2">
                    <span className={cn("text-sm font-semibold", teamColors[t])}>{t}</span>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{count} issues</p>
                  </div>
                )
              })}
            </div>
          </div>

          </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-6 py-5">
          <div className="mx-auto max-w-3xl space-y-6">
            <CompletedPanel
              title={tab === "week" ? "Tasks completed this week" : "Tasks completed this month"}
              since={tab === "week" ? startOfWeek(new Date(), { weekStartsOn: 1 }) : startOfMonth(new Date())}
              issues={issues}
              users={users}
              milestones={milestones}
              currentProject={currentProject}
            />
          </div>
        </div>
      )}
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
