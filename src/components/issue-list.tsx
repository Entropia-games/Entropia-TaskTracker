"use client"

import { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {   Circle, ChevronDown, Trash2, X, ArrowUp, ArrowDown, Minus, AlertCircle, CircleDot, CircleCheck, CircleOff, Layers, GitPullRequest, Diamond, Plus, Link } from "lucide-react"
import { CreateIssueModal } from "@/components/create-issue-modal"
import { IssueDetailModal } from "@/components/issue-detail-modal"
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

type Props = {
  title: string
  issues: Issue[]
  focusId?: number
}

export function IssueList({ title, issues, focusId }: Props) {
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
  const [openTeamPopover, setOpenTeamPopover] = useState<number | null>(null)
  const [openMilestonePopover, setOpenMilestonePopover] = useState<number | null>(null)
  const [openAssigneePopover, setOpenAssigneePopover] = useState<number | null>(null)
  const [openLinkPopover, setOpenLinkPopover] = useState<number | null>(null)
  const [showDone, setShowDone] = useState(true)
  const [users, setUsers] = useState<Database["public"]["Tables"]["users"]["Row"][]>([])
  const [linkedPRMap, setLinkedPRMap] = useState<Map<number, { count: number; firstUrl: string; firstState: string }>>(new Map())
  const rowClickTarget = useRef<number | null>(null)

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
    return true
  })

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

  const grouped = (["backlog", "todo", "in_progress", "done"] as IssueStatus[])
    .filter((s) => showDone || s !== "done")
    .map((status) => ({
      status,
      issues: filteredIssues.filter((i) => i.status === status),
    }))

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium">{title}</h1>
          <Badge variant="secondary" className="rounded-sm text-[11px] font-normal">
            {filteredIssues.length}
          </Badge>
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
          <span className="mx-1 h-4 w-px bg-border" />
          <CreateIssueModal />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {grouped.map((group) => {
          if (group.issues.length === 0) return null
          return (
            <div key={group.status}>
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/30 bg-background px-6 py-2">
                <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  {statusLabels[group.status]}
                </span>
                <span className="text-xs text-muted-foreground/50">{group.issues.length}</span>
              </div>
              {group.issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`group flex cursor-pointer items-center gap-3 border-b border-border/20 px-6 py-2.5 transition-colors hover:bg-accent/30 ${
                    selectedIds.has(issue.id) ? "bg-accent/20" : ""
                  }`}
                  onClick={(e) => { if ((e.target as HTMLElement).closest("[data-pr-link], [data-team-btn], [data-milestone-btn], [data-assignee-btn], [data-link-btn]")) return; requireAuth(() => setDetailIssueId(issue.id)) }}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(issue.id)}
                      onCheckedChange={() => toggleSelect(issue.id)}
                      className={`size-4 ${selectedIds.has(issue.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    />
                  </div>
                  {(() => {
                    const PIcon = priorityIcons[issue.priority]
                    return <PIcon className={`size-4 shrink-0 ${priorityColors[issue.priority]}`} />
                  })()}
                  <span className="flex w-5 shrink-0 items-center justify-center">{issue.is_epic && <Layers className="size-4 text-purple-400" />}</span>
                  <span className={cn("min-w-[4rem] text-sm font-mono", issue.status === "done" || issue.status === "canceled" ? "text-muted-foreground/30 line-through" : "text-muted-foreground/60")}>
                    {currentProject?.code ?? "?"}-{issue.display_id}
                  </span>
                  <span className="flex-1 truncate text-sm">{issue.title}</span>
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
                          className={cn("flex w-16 shrink-0 items-center justify-center rounded border px-1 py-0.5 text-sm font-medium transition-colors", issue.team ? (cn("border-border/30", teamColors[issue.team] ?? "text-muted-foreground/70")) : "border-dashed border-transparent group-hover:border-border/30 text-transparent group-hover:text-muted-foreground/40 hover:border-border/60 hover:text-muted-foreground/70")}
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
                          className={cn("flex w-28 shrink-0 items-center gap-1 rounded border px-1 py-0.5 text-sm font-medium transition-colors", issue.milestone_id ? (cn("border-border/30 text-red-400/60 [&_svg]:text-red-400/60")) : "border-dashed border-transparent group-hover:border-border/30 text-transparent group-hover:text-muted-foreground/40 hover:border-border/60 hover:text-muted-foreground/70")}
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
                          className={cn("flex w-36 shrink-0 items-center justify-end gap-1.5 rounded border px-1 py-0.5 text-sm font-medium transition-colors", issue.assignee_id && userMap.has(issue.assignee_id) ? "border-border/30" : "border-dashed border-transparent group-hover:border-border/30 text-transparent group-hover:text-muted-foreground/40 hover:border-border/60 hover:text-muted-foreground/70")}
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
    </div>
  )
}
