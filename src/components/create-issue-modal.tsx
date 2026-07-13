"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { useIssues, type IssueStatus, type IssuePriority, type IssueTeam, type Milestone } from "@/lib/issues-context"
import { getSupabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import type { Database } from "@/lib/database.types"
import { uploadFiles } from "@/lib/uploadthing"
import { compressImage } from "@/lib/compress-image"
import {
  Plus,
  CalendarIcon,
  Circle,
  CircleDot,
  CircleCheck,
  CircleOff,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertCircle,
  Layers,
  FileText,
  Diamond,
  Image,
  X,
} from "lucide-react"
import { format } from "date-fns"

const STATUS_OPTIONS: { value: IssueStatus; label: string; icon: typeof Circle }[] = [
  { value: "backlog", label: "Backlog", icon: CircleOff },
  { value: "todo", label: "Todo", icon: Circle },
  { value: "in_progress", label: "In Progress", icon: CircleDot },
  { value: "done", label: "Done", icon: CircleCheck },
  { value: "canceled", label: "Canceled", icon: CircleOff },
]

const PRIORITY_OPTIONS: { value: IssuePriority; label: string; icon: typeof Minus }[] = [
  { value: "none", label: "No Priority", icon: Minus },
  { value: "low", label: "Low", icon: ArrowDown },
  { value: "medium", label: "Medium", icon: Minus },
  { value: "high", label: "High", icon: ArrowUp },
  { value: "urgent", label: "Urgent", icon: AlertCircle },
]

const STATUS_COLORS: Record<IssueStatus, string> = {
  backlog: "text-muted-foreground/40",
  todo: "text-muted-foreground",
  in_progress: "text-yellow-400",
  done: "text-green-400",
  canceled: "text-muted-foreground/40",
}

const teamColors: Record<string, string> = {
  "3D":     "text-red-400",
  Concept:  "text-blue-400",
  DEV:      "text-purple-400",
  QA:       "text-white/80",
  GD:       "text-yellow-400",
  Sound:    "text-orange-400",
}

const PRIORITY_COLORS: Record<IssuePriority, string> = {
  none: "text-muted-foreground/40",
  low: "text-muted-foreground",
  medium: "text-blue-400",
  high: "text-orange-400",
  urgent: "text-red-400",
}

export function CreateIssueModal() {
  const { addIssue, milestones: projectMilestones } = useIssues()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<IssueStatus>("todo")
  const [priority, setPriority] = useState<IssuePriority>("none")
  const [dueDate, setDueDate] = useState<Date>()
  const [team, setTeam] = useState<IssueTeam | null>(null)
  const [isEpic, setIsEpic] = useState(false)
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [milestoneId, setMilestoneId] = useState<number | null>(null)
  const [users, setUsers] = useState<Database["public"]["Tables"]["users"]["Row"][]>([])
  const [attachments, setAttachments] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    getSupabase().from("users").select("*").then(({ data }) => {
      if (data) setUsers(data)
    })
    setMilestoneId(null)
  }, [open])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const [res] = await uploadFiles("image", { files: [compressed] })
      if (res?.serverData?.url) setAttachments((prev) => [...prev, res.serverData.url])
    } catch (err) {
      console.error("Upload failed", err)
    }
    setUploading(false)
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((u) => u !== url))
    fetch("/api/delete-images", { method: "POST", body: JSON.stringify({ urls: [url] }) })
      .catch((e) => console.error("Failed to delete image", e))
  }

  const activeStatus = STATUS_OPTIONS.find((s) => s.value === status)
  const activePriority = PRIORITY_OPTIONS.find((p) => p.value === priority)
  const StatusIcon = activeStatus?.icon ?? Circle
  const PriorityIcon = activePriority?.icon ?? Minus

  const handleSubmit = () => {
    if (!title.trim()) return
    addIssue({
      title: title.trim(),
      description,
      status,
      priority,
      team,
      is_epic: isEpic,
      milestone_id: milestoneId,
      due_date: dueDate ? dueDate.toISOString() : null,
      assignee_id: assigneeId,
      attachments,
    })
    setTitle("")
    setDescription("")
    setStatus("todo")
    setPriority("none")
    setTeam(null)
    setMilestoneId(null)
    setDueDate(undefined)
    setAssigneeId(null)
    setIsEpic(false)
    setAttachments([])
    setOpen(false)
  }

  const discardAttachments = () => {
    if (attachments.length > 0) {
      fetch("/api/delete-images", { method: "POST", body: JSON.stringify({ urls: attachments }) })
        .catch((e) => console.error("Failed to delete image", e))
    }
    setAttachments([])
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        handleSubmit()
      }
      if (e.key === "Escape") {
        discardAttachments()
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, title, description, status, priority, dueDate, discardAttachments])

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
      if (!v) {
        setTitle("")
        setDescription("")
        setStatus("todo")
        setPriority("none")
        setTeam(null)
        setIsEpic(false)
        setDueDate(undefined)
        discardAttachments()
      }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent">
            <Plus className="size-3.5" />
            New Issue
          </button>
        }
      />
      <DialogContent
        className="!max-w-3xl !max-h-[90vh] !overflow-y-auto !rounded-xl !border-0 !p-0 !pb-1 sm:!max-w-3xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Create issue</DialogTitle>
        <div className="flex flex-col gap-0">
          <div className="flex flex-col gap-4 px-5 pb-6 pt-6">
            <Input
              placeholder="Issue title"
              className="!border-0 !bg-transparent !p-0 !text-lg !font-medium !shadow-none placeholder:text-muted-foreground/40 focus-visible:!ring-0"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Add description..."
              className="!min-h-0 resize-none !border-0 !bg-transparent !p-0 text-sm text-muted-foreground placeholder:text-muted-foreground/40 focus-visible:!ring-0"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={1}
            />
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {attachments.map((url) => (
                  <div key={url} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full max-h-[420px] rounded border border-border/50 object-cover" />
                    <button
                      onClick={() => removeAttachment(url)}
                      className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              className="mt-2 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent transition-colors"
            >
              <Image className="size-3.5" />
              {uploading ? "Uploading..." : "Add image"}
            </button>
          </div>
          <DialogFooter className="!mt-0 !mb-0 !mx-0 flex-col sm:flex-col !rounded-none !border-t !border-border/50 !bg-transparent px-5 py-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Select value={status} onValueChange={(v) => setStatus(v as IssueStatus)}>
                <SelectTrigger className="h-7 gap-1.5 border-0 bg-transparent px-2 text-xs text-muted-foreground hover:bg-accent data-open:bg-accent">
                  <StatusIcon className={cn("size-3.5", STATUS_COLORS[status])} />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start" className="min-w-40">
                  {STATUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <Icon className={cn("size-3.5", STATUS_COLORS[opt.value])} />
                        {opt.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={(v) => setPriority(v as IssuePriority)}>
                <SelectTrigger className="h-7 gap-1.5 border-0 bg-transparent px-2 text-xs text-muted-foreground hover:bg-accent data-open:bg-accent">
                  <PriorityIcon className={cn("size-3.5", PRIORITY_COLORS[priority])} />
                  <SelectValue>{PRIORITY_OPTIONS.find((o) => o.value === priority)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start" className="min-w-40">
                  {PRIORITY_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <Icon className={cn("size-3.5", PRIORITY_COLORS[opt.value])} />
                        {opt.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger
                  render={
                    <button className={cn("flex h-7 cursor-default items-center gap-1.5 border-0 px-2 text-xs hover:bg-accent data-open:bg-accent", isEpic ? "text-purple-400" : "text-muted-foreground")}>
                      <Layers className="size-3.5" />
                      {isEpic ? "Epic" : "Issue"}
                    </button>
                  }
                />
                <PopoverContent className="w-32 p-1" align="start">
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                    onClick={() => setIsEpic(false)}
                  >
                    <FileText className="size-3.5" />
                    Issue
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-purple-400 hover:bg-accent"
                    onClick={() => setIsEpic(true)}
                  >
                    <Layers className="size-3.5" />
                    Epic
                  </button>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      className={cn(
                        "flex h-7 cursor-default items-center gap-1.5 border-0 px-2 text-xs text-muted-foreground hover:bg-accent",
                        !dueDate && "opacity-60"
                      )}
                    >
                      <CalendarIcon className="size-3.5" />
                      {dueDate ? format(dueDate, "MMM d") : "Due date"}
                    </button>
                  }
                />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} />
                </PopoverContent>
              </Popover>
              <Select value={team ?? "none"} onValueChange={(v) => setTeam(v === "none" ? null : v as IssueTeam)}>
                <SelectTrigger className={cn("h-7 gap-1.5 border-0 bg-transparent px-2 text-xs hover:bg-accent data-open:bg-accent", team ? teamColors[team] : "text-muted-foreground")}>
                  <Circle className={cn("size-3 shrink-0", team ? teamColors[team] : "text-muted-foreground/40")} />
                  <SelectValue>{team ?? "No Team"}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start" className="min-w-32">
                  <SelectItem value="none"><Circle className="size-3 text-muted-foreground/40" />No Team</SelectItem>
                  <SelectItem value="3D"><Circle className="size-3 text-red-400" />3D</SelectItem>
                  <SelectItem value="Concept"><Circle className="size-3 text-blue-400" />Concept</SelectItem>
                  <SelectItem value="DEV"><Circle className="size-3 text-purple-400" />DEV</SelectItem>
                  <SelectItem value="QA"><Circle className="size-3 text-white/80" />QA</SelectItem>
                  <SelectItem value="GD"><Circle className="size-3 text-yellow-400" />GD</SelectItem>
                  <SelectItem value="Sound"><Circle className="size-3 text-orange-400" />Sound</SelectItem>
                </SelectContent>
              </Select>
              {projectMilestones.length > 0 && (
                <Select value={milestoneId?.toString() ?? "none"} onValueChange={(v) => setMilestoneId(v === "none" ? null : Number(v))}>
                  <SelectTrigger className={cn("h-7 gap-1.5 border-0 bg-transparent px-2 text-xs hover:bg-accent data-open:bg-accent", milestoneId ? "text-foreground" : "text-muted-foreground")}>
                    <Diamond className={cn("size-3 shrink-0", milestoneId ? "text-red-400/60" : "text-muted-foreground/40")} />
                    <SelectValue>{milestoneId ? projectMilestones.find((m) => m.id === milestoneId)?.name : "No Milestone"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start" className="min-w-40">
                    <SelectItem value="none"><Diamond className="size-3 text-muted-foreground/40" />No Milestone</SelectItem>
                    {projectMilestones.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}><Diamond className="size-3 text-red-400/60" />{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <span className="mx-1 h-4 w-px bg-border/50" />
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      className={cn(
                        "flex h-7 cursor-default items-center gap-1.5 border-0 px-2 text-xs text-muted-foreground hover:bg-accent",
                        !assigneeId && "opacity-60"
                      )}
                    >
                      <span className="flex size-3.5 items-center justify-center rounded-full bg-muted-foreground/20 text-[9px] font-medium text-muted-foreground">
                        {assigneeId
                          ? (users.find((u) => u.id === assigneeId)?.name ?? "?")[0].toUpperCase()
                          : "?"}
                      </span>
                      {assigneeId
                        ? users.find((u) => u.id === assigneeId)?.name ?? "Unknown"
                        : "Unassigned"}
                    </button>
                  }
                />
                <PopoverContent className="w-48 p-1" align="start">
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                    onClick={() => setAssigneeId(null)}
                  >
                    <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/20 text-[9px]">?</span>
                    Unassigned
                  </button>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
                      onClick={() => setAssigneeId(u.id)}
                    >
                      <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/30 text-[9px] font-medium text-foreground">
                        {(u.name ?? u.email[0])[0].toUpperCase()}
                      </span>
                      {u.name ?? u.email}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3">
              <Button size="sm" disabled={!title.trim()} onClick={handleSubmit}>
                Create Issue
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
