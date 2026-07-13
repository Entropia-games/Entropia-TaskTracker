"use client"

import { useState, useEffect, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Circle, ChevronDown, Trash2, X, ArrowUp, ArrowDown, Minus, AlertCircle, CircleDot, CircleCheck, CircleOff, Layers, GitPullRequest } from "lucide-react"
import { CreateIssueModal } from "@/components/create-issue-modal"
import { IssueDetailModal } from "@/components/issue-detail-modal"
import { useIssues, type Issue, type IssueStatus, type IssuePriority, type IssueTeam } from "@/lib/issues-context"
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
  DEV:   "text-blue-400",
  ART:   "text-red-400",
  QA:    "text-white/80",
  GD:    "text-yellow-400",
  Sound: "text-orange-400",
}

type Props = {
  title: string
  issues: Issue[]
}

export function IssueList({ title, issues }: Props) {
  const { deleteIssues } = useIssues()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null)
  const [detailParentIssue, setDetailParentIssue] = useState<Issue | null>(null)
  const [statusFilter, setStatusFilter] = useState<IssueStatus | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | null>(null)
  const [teamFilter, setTeamFilter] = useState<IssueTeam | null>(null)
  const [users, setUsers] = useState<Database["public"]["Tables"]["users"]["Row"][]>([])
  const [linkedPRMap, setLinkedPRMap] = useState<Map<number, { count: number; firstUrl: string; firstState: string }>>(new Map())

  useEffect(() => {
    getSupabase().from("users").select("*").then(({ data }) => {
      if (data) setUsers(data)
    })
  }, [])

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

  const filteredIssues = issues.filter((i) => {
    if (statusFilter && i.status !== statusFilter) return false
    if (priorityFilter && i.priority !== priorityFilter) return false
    if (teamFilter && i.team !== teamFilter) return false
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
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    deleteIssues(ids)
    setSelectedIds(new Set())
  }

  const grouped = (["backlog", "todo", "in_progress", "done"] as IssueStatus[]).map((status) => ({
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
              {(["ART", "DEV", "QA", "GD", "Sound"] as IssueTeam[]).map((t) => (
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
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {statusLabels[group.status]}
                </span>
                <span className="text-[11px] text-muted-foreground/50">{group.issues.length}</span>
              </div>
              {group.issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`group flex cursor-pointer items-center gap-3 border-b border-border/20 px-6 py-2.5 transition-colors hover:bg-accent/30 ${
                    selectedIds.has(issue.id) ? "bg-accent/20" : ""
                  }`}
                  onClick={() => setDetailIssue(issue)}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(issue.id)}
                      onCheckedChange={() => toggleSelect(issue.id)}
                      className={`size-3.5 ${selectedIds.has(issue.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    />
                  </div>
                  {(() => {
                    const PIcon = priorityIcons[issue.priority]
                    return <PIcon className={`size-3.5 shrink-0 ${priorityColors[issue.priority]}`} />
                  })()}
                  {issue.is_epic && <Layers className="size-3.5 shrink-0 text-purple-400" />}
                  {linkedPRMap.has(issue.id) && (() => {
                    const pr = linkedPRMap.get(issue.id)!
                    const isMerged = pr.firstState === "merged"
                    const isClosed = pr.firstState === "closed"
                    return (
                      <a
                        href={pr.firstUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "group/link flex items-center gap-0.5 transition-colors",
                          isMerged ? "text-purple-400/70 hover:text-purple-400" :
                          isClosed ? "text-red-400/70 hover:text-red-400" :
                          "text-green-400/70 hover:text-green-400",
                        )}
                      >
                        <GitPullRequest className="size-3.5" />
                        {pr.count > 1 && <span className="text-[10px] font-medium">{pr.count}</span>}
                      </a>
                    )
                  })()}
                  <span className="min-w-[4rem] text-xs text-muted-foreground/60 font-mono">
                    {issue.id}
                  </span>
                  <span className="flex-1 truncate text-sm">{issue.title}</span>
                  {issue.team && (
                    <span className={cn("shrink-0 rounded border border-border/30 px-1.5 py-0.5 text-xs font-semibold", teamColors[issue.team] ?? "text-muted-foreground/70")}>{issue.team}</span>
                  )}
                  {issue.assignee_id && userMap.has(issue.assignee_id) && (
                    <div className="flex w-36 shrink-0 items-center justify-end gap-1.5">
                      <span className="text-[13px] text-muted-foreground truncate">
                        {userMap.get(issue.assignee_id)?.name ?? userMap.get(issue.assignee_id)?.email}
                      </span>
                      <Avatar className="size-5">
                        <AvatarFallback className="text-[9px]">
                          {(userMap.get(issue.assignee_id)?.name ?? "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
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
        onOpenChange={(v) => { if (!v) { setDetailIssue(null); setDetailParentIssue(null) } }}
        onOpenDetail={(target) => { setDetailParentIssue(target.is_epic ? null : detailIssue); setDetailIssue(target) }}
        parentIssue={detailParentIssue}
      />
    </div>
  )
}
