"use client"

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react"
import {
  Circle,
  CircleDot,
  CircleCheck,
  CircleOff,
  Minus,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Diamond,
  ChevronRight,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useIssues, type Issue, type IssueStatus, type IssuePriority, type IssueTeam } from "@/lib/issues-context"
import { issueTypeIcon, issueTypeColor } from "@/lib/issue-types"
import type { Database } from "@/lib/database.types"
import { cn, userAvatarColor } from "@/lib/utils"
import { UserDisplayName } from "@/components/ui/display-name"
import { useDeptMap } from "@/lib/use-dept-map"

type AppUser = Database["public"]["Tables"]["users"]["Row"]

const statusMeta: Record<IssueStatus, { label: string; icon: typeof Circle; color: string }> = {
  backlog: { label: "Backlog", icon: CircleOff, color: "text-muted-foreground/40" },
  todo: { label: "Todo", icon: Circle, color: "text-muted-foreground" },
  in_progress: { label: "In Progress", icon: CircleDot, color: "text-yellow-400" },
  done: { label: "Done", icon: CircleCheck, color: "text-green-400" },
  canceled: { label: "Canceled", icon: CircleOff, color: "text-muted-foreground/40" },
}

const priorityMeta: Record<IssuePriority, { label: string; icon: typeof Minus; color: string }> = {
  none: { label: "None", icon: Minus, color: "text-muted-foreground/30" },
  low: { label: "Low", icon: ArrowDown, color: "text-muted-foreground" },
  medium: { label: "Medium", icon: Minus, color: "text-blue-400" },
  high: { label: "High", icon: ArrowUp, color: "text-orange-400" },
  urgent: { label: "Urgent", icon: AlertCircle, color: "text-red-400" },
}

const teamColors: Record<string, string> = {
  "3D": "text-red-400",
  Concept: "text-blue-400",
  DEV: "text-purple-400",
  QA: "text-white/80",
  GD: "text-yellow-400",
  Sound: "text-orange-400",
  LD: "text-green-400",
}

const STATUSES = ["backlog", "todo", "in_progress", "done", "canceled"] as IssueStatus[]
const PRIORITIES = ["none", "low", "medium", "high", "urgent"] as IssuePriority[]
const TEAMS = ["3D", "Concept", "DEV", "QA", "GD", "Sound", "LD"] as IssueTeam[]

type SubKey = "status" | "priority" | "team" | "assignee" | "milestone"

type Props = {
  issue: Issue
  users: AppUser[]
  x: number
  y: number
  onChange: (changes: Partial<Issue>) => void
  onClose: () => void
}

function MenuItem({ label, icon, itemRef, onHover, onClick }: { label: string; icon: ReactNode; itemRef?: (el: HTMLButtonElement | null) => void; onHover: () => void; onClick: () => void }) {
  return (
    <button
      ref={itemRef}
      onMouseEnter={onHover}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-700"
    >
      <span className="flex-1 text-left text-muted-foreground/70">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5 text-foreground">{icon}</span>
      <ChevronRight className="size-3 shrink-0 opacity-40" />
    </button>
  )
}

export function IssueContextMenu({ issue, users, x, y, onChange, onClose }: Props) {
  const { milestones } = useIssues()
  const deptMap = useDeptMap()
  const [sub, setSub] = useState<SubKey | null>(null)
  const [subTop, setSubTop] = useState(0)
  const itemRefs = useRef<Partial<Record<SubKey, HTMLButtonElement | null>>>({})

  useEffect(() => {
    const close = () => onClose()
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("click", close)
    window.addEventListener("contextmenu", close)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("click", close)
      window.removeEventListener("contextmenu", close)
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  useEffect(() => {
    if (sub) {
      const el = itemRefs.current[sub]
      if (el) setSubTop(el.offsetTop)
    }
  }, [sub])

  const user = issue.assignee_id ? users.find((u) => u.id === issue.assignee_id) ?? null : null
  const milestone = issue.milestone_id ? milestones.find((m) => m.id === issue.milestone_id) ?? null : null
  const sMeta = statusMeta[issue.status]
  const SIcon = sMeta.icon
  const pMeta = priorityMeta[issue.priority]
  const PIcon = pMeta.icon

  const MENU_W = 220
  const SUB_W = 190
  const openLeft = x + MENU_W + SUB_W > window.innerWidth

  const apply = (changes: Partial<Issue>) => {
    onChange(changes)
    onClose()
  }

  return (
    <div
      style={{ position: "fixed", top: y, left: x, zIndex: 60, width: MENU_W }}
      className="rounded-lg border border-border/60 bg-zinc-800 p-1.5 shadow-xl"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}
    >
      <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-0.5">
        {issue.issue_type && issue.issue_type !== "task" && (() => {
          const TypeIcon = issueTypeIcon(issue.issue_type)
          return <TypeIcon className={cn("size-3 shrink-0", issueTypeColor(issue.issue_type))} />
        })()}
        <span className="truncate text-[11px] text-muted-foreground/70">{issue.title}</span>
      </div>
      <div className="h-px bg-border/40" />
      <div className="relative mt-1">
        <MenuItem
          label="Status"
          itemRef={(el) => { itemRefs.current.status = el }}
          icon={<SIcon className={cn("size-3.5 shrink-0", sMeta.color)} />}
          onHover={() => setSub("status")}
          onClick={() => setSub("status")}
        />
        <MenuItem
          label="Priority"
          itemRef={(el) => { itemRefs.current.priority = el }}
          icon={<PIcon className={cn("size-3.5 shrink-0", pMeta.color)} />}
          onHover={() => setSub("priority")}
          onClick={() => setSub("priority")}
        />
        <MenuItem
          label="Team"
          itemRef={(el) => { itemRefs.current.team = el }}
          icon={issue.team ? <Circle className={cn("size-3 shrink-0", teamColors[issue.team])} /> : <Circle className="size-3 text-muted-foreground/40" />}
          onHover={() => setSub("team")}
          onClick={() => setSub("team")}
        />
        <MenuItem
          label="Assignee"
          itemRef={(el) => { itemRefs.current.assignee = el }}
          icon={user ? <Avatar className="size-4"><AvatarFallback className={cn(userAvatarColor((user.name ?? user.email)), "text-[9px]")}>{(user.name ?? user.email)[0].toUpperCase()}</AvatarFallback></Avatar> : <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/20 text-[9px]">?</span>}
          onHover={() => setSub("assignee")}
          onClick={() => setSub("assignee")}
        />
        <MenuItem
          label="Milestone"
          itemRef={(el) => { itemRefs.current.milestone = el }}
          icon={milestone ? <Diamond className="size-3 shrink-0 text-red-400/60" /> : <Diamond className="size-3 shrink-0 text-muted-foreground/40" />}
          onHover={() => setSub("milestone")}
          onClick={() => setSub("milestone")}
        />

        {sub && (
          <div
            style={{ width: SUB_W, top: subTop, [openLeft ? "right" : "left"]: "100%" } as CSSProperties}
            className="absolute max-h-72 overflow-y-auto rounded-lg border border-border/60 bg-zinc-800 p-1.5 shadow-xl"
            onMouseEnter={() => setSub(sub)}
          >
            {sub === "status" && STATUSES.map((s) => {
              const m = statusMeta[s]
              const Icon = m.icon
              return (
                <button
                  key={s}
                  onClick={() => apply({ status: s })}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-700", issue.status === s ? "text-foreground" : "text-muted-foreground")}
                >
                  <Icon className={cn("size-3.5 shrink-0", m.color)} />
                  {m.label}
                </button>
              )
            })}
            {sub === "priority" && PRIORITIES.map((p) => {
              const m = priorityMeta[p]
              const Icon = m.icon
              return (
                <button
                  key={p}
                  onClick={() => apply({ priority: p })}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm capitalize hover:bg-zinc-700", issue.priority === p ? "text-foreground" : "text-muted-foreground")}
                >
                  <Icon className={cn("size-3.5 shrink-0", m.color)} />
                  {m.label}
                </button>
              )
            })}
            {sub === "team" && (
              <>
                <button
                  onClick={() => apply({ team: null })}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-700", !issue.team ? "text-foreground" : "text-muted-foreground")}
                >
                  <Circle className="size-3 text-muted-foreground/40" />
                  No Team
                </button>
                {TEAMS.map((t) => (
                  <button
                    key={t}
                    onClick={() => apply({ team: t })}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-700", issue.team === t ? "text-foreground" : "text-muted-foreground")}
                  >
                    <Circle className={cn("size-3", teamColors[t])} />
                    {t}
                  </button>
                ))}
              </>
            )}
            {sub === "assignee" && (
              <>
                <button
                  onClick={() => apply({ assignee_id: null })}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-700", !issue.assignee_id ? "text-foreground" : "text-muted-foreground")}
                >
                  <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/20 text-[9px]">?</span>
                  No Assignee
                </button>
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => apply({ assignee_id: u.id })}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-700", issue.assignee_id === u.id ? "text-foreground" : "text-muted-foreground")}
                  >
                    <Avatar className="size-4">
                      <AvatarFallback className={cn(userAvatarColor((u.name ?? u.email)), "text-[9px]")}>{(u.name ?? u.email)[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <UserDisplayName name={u.name} email={u.email} displayName={u.display_name} department={deptMap.get(u.id)} />
                  </button>
                ))}
              </>
            )}
            {sub === "milestone" && (
              <>
                <button
                  onClick={() => apply({ milestone_id: null })}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-700", !issue.milestone_id ? "text-foreground" : "text-muted-foreground")}
                >
                  <Diamond className="size-3 text-muted-foreground/40" />
                  No Milestone
                </button>
                {milestones.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => apply({ milestone_id: m.id })}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-700", issue.milestone_id === m.id ? "text-foreground" : "text-muted-foreground")}
                  >
                    <Diamond className="size-3 text-red-400/60 shrink-0" />
                    <span className="truncate">{m.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
