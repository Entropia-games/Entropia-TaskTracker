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
import { cn, userAvatarColor } from "@/lib/utils"
import { UserDisplayName } from "@/components/ui/display-name"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useDeptMap } from "@/lib/use-dept-map"
import { useIssues, type IssueStatus, type IssuePriority, type IssueTeam, type IssueType, type Milestone, type Attachment } from "@/lib/issues-context"
import { useCreateIssueDraft } from "@/lib/create-issue-draft-context"
import { TYPE_OPTIONS, issueTypeIcon, issueTypeColor } from "@/lib/issue-types"
import { useDocs } from "@/lib/docs-context"
import { renameFile, slugify } from "@/lib/upload-rename"
import { useAuth } from "@/lib/auth-context"
import { getSupabase } from "@/lib/supabase"
import { useAuthGate } from "@/lib/auth-gate-context"
import type { Database } from "@/lib/database.types"
import { uploadFiles } from "@/lib/uploadthing"
import { compressImage } from "@/lib/compress-image"
import {
  Plus,
  Circle,
  CircleDot,
  CircleCheck,
  CircleOff,
  Eye,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertCircle,
  Layers,
  FileText,
  Diamond,
  Image,
  X,
  Check,
  CalendarIcon,
} from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"

const STATUS_OPTIONS: { value: IssueStatus; label: string; icon: typeof Circle }[] = [
  { value: "backlog", label: "Backlog", icon: CircleOff },
  { value: "todo", label: "Todo", icon: Circle },
  { value: "in_progress", label: "In Progress", icon: CircleDot },
  { value: "in_review", label: "In Review", icon: Eye },
  { value: "done", label: "Done", icon: CircleCheck },
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
  in_review: "text-violet-400",
  done: "text-green-400",
}

const teamColors: Record<string, string> = {
  "3D":     "text-red-400",
  Concept:  "text-blue-400",
  DEV:      "text-purple-400",
  QA:       "text-white/80",
  GD:       "text-yellow-400",
  Sound:    "text-orange-400",
  LD:       "text-green-400",
  CM:       "text-pink-400",
}

const PRIORITY_COLORS: Record<IssuePriority, string> = {
  none: "text-muted-foreground/40",
  low: "text-muted-foreground",
  medium: "text-blue-400",
  high: "text-orange-400",
  urgent: "text-red-400",
}

export function CreateIssueModal() {
  const { addIssue, milestones: projectMilestones, issues, currentProject, issueEpics, setIssueEpics } = useIssues()
  const { documents } = useDocs()
  const { requireAuth } = useAuthGate()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const { draft, setDraft, resetDraft, cleanRef } = useCreateIssueDraft()
  const { title, description, status, priority, team, isEpic, issueType, assigneeId, milestoneId, dueDate, parentEpicIds, attachments } = draft
  const setTitle = (v: string) => setDraft((d) => ({ ...d, title: v }))
  const setDescription = (v: string) => setDraft((d) => ({ ...d, description: v }))
  const setStatus = (v: IssueStatus) => setDraft((d) => ({ ...d, status: v }))
  const setPriority = (v: IssuePriority) => setDraft((d) => ({ ...d, priority: v }))
  const setTeam = (v: IssueTeam | null) => setDraft((d) => ({ ...d, team: v }))
  const setIsEpic = (v: boolean) => setDraft((d) => ({ ...d, isEpic: v }))
  const setIssueType = (v: IssueType) => setDraft((d) => ({ ...d, issueType: v }))
  const setAssigneeId = (v: string | null) => setDraft((d) => ({ ...d, assigneeId: v }))
  const setMilestoneId = (v: number | null) => setDraft((d) => ({ ...d, milestoneId: v }))
  const setDueDate = (v: string | null) => setDraft((d) => ({ ...d, dueDate: v }))
  const setParentEpicIds = (v: number[] | ((prev: number[]) => number[])) => setDraft((d) => ({ ...d, parentEpicIds: typeof v === "function" ? v(d.parentEpicIds) : v }))
  const setAttachments = (v: Attachment[] | ((prev: Attachment[]) => Attachment[])) => setDraft((d) => ({ ...d, attachments: typeof v === "function" ? v(d.attachments) : v }))
  const [users, setUsers] = useState<Database["public"]["Tables"]["users"]["Row"][]>([])
  const [uploading, setUploading] = useState(false)
  const [docPickerOpen, setDocPickerOpen] = useState(false)
  const [docSearch, setDocSearch] = useState("")
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [epicPickerOpen, setEpicPickerOpen] = useState(false)
  const [epicSearch, setEpicSearch] = useState("")
  const imageInputRef = useRef<HTMLInputElement>(null)
  const popoverOpenRef = useRef(false)
  const deptMap = useDeptMap()

  useEffect(() => {
    if (!open) return
    getSupabase().from("users").select("*").then(({ data }) => {
      if (data) setUsers(data)
    })
    if (cleanRef.current) {
      setMilestoneId(null)
      setAssigneeId(user?.id ?? null)
      cleanRef.current = false
    }
  }, [open, user?.id])

  const isImageAtt = (a: Attachment) =>
    a.type?.startsWith("image/") ?? /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(a.url)

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    try {
      const nextId = issues.reduce((max, i) => Math.max(max, i.display_id ?? 0), 0) + 1
      const results = await Promise.allSettled(
        files.map(async (file, index) => {
          const isImage = file.type.startsWith("image/")
          const toUpload = isImage ? await compressImage(file) : file
          const ext = file.name.split(".").pop() ?? "bin"
          const prefix = isImage ? "task_image" : "task_file"
          const suffix = files.length > 1 ? `-${index + 1}` : ""
          const renamed = renameFile(toUpload, `${prefix}_${(currentProject?.code ?? "unknown").toLowerCase()}-${nextId}${suffix}.${ext}`)
          const [res] = await uploadFiles(isImage ? "image" : "file", { files: [renamed] })
          if (res?.serverData?.url) {
            return {
              url: res.serverData.url,
              name: res.serverData.name ?? file.name,
              type: res.serverData.type ?? file.type,
            } as Attachment
          }
          return null
        })
      )
      const uploaded = results.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []))
      if (uploaded.length > 0) setAttachments((prev) => [...prev, ...uploaded])
    } catch (err) {
      console.error("Upload failed", err)
    }
    setUploading(false)
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  const removeAttachment = (att: Attachment) => {
    setAttachments((prev) => prev.filter((a) => a.url !== att.url))
    if (att.type !== "doc/link") {
      fetch("/api/delete-images", { method: "POST", body: JSON.stringify({ urls: [att.url] }) })
        .catch((e) => console.error("Failed to delete image", e))
    }
  }

  const handleDocLinkExisting = (docId: number, docTitle: string) => {
    setAttachments((prev) => [...prev, { url: `/docs?doc=${docId}`, name: docTitle, type: "doc/link" }])
    setDocPickerOpen(false)
    setDocSearch("")
  }

  const activeStatus = STATUS_OPTIONS.find((s) => s.value === status)
  const activePriority = PRIORITY_OPTIONS.find((p) => p.value === priority)
  const epics = issues.filter((i) => i.is_epic)
  const StatusIcon = activeStatus?.icon ?? Circle
  const PriorityIcon = activePriority?.icon ?? Minus

  const handleSubmit = async () => {
    if (!title.trim()) return
    const epicIdsToLink = [...parentEpicIds]
    const newId = await addIssue({
      title: title.trim(),
      description: description.trim() ? description : null,
      status,
      priority,
      team,
      is_epic: isEpic,
      issue_type: issueType,
      milestone_id: milestoneId,
      due_date: dueDate,
      parent_epic_id: epicIdsToLink.length > 0 ? epicIdsToLink[0] : null,
      assignee_id: assigneeId,
      attachments,
    })
    if (newId && epicIdsToLink.length > 0) {
      setIssueEpics(newId, epicIdsToLink)
    }
    resetDraft()
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        handleSubmit()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, title, description, status, priority, team, isEpic, issueType, assigneeId, milestoneId, parentEpicIds, attachments])

  const handleOpenChange = (v: boolean) => {
    if (!v && popoverOpenRef.current) return
    setOpen(v)
  }

  return (
    <>
      <button
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent"
        onClick={() => requireAuth(() => setOpen(true))}
      >
        <Plus className="size-3.5" />
        New Issue
      </button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="!max-w-3xl !max-h-[90vh] !overflow-y-auto !rounded-xl !border-0 !p-0 !pb-1 sm:!max-w-3xl max-md:!inset-0 max-md:!top-0 max-md:!left-0 max-md:!h-[100dvh] max-md:!max-h-[100dvh] max-md:!w-full max-md:!max-w-full max-md:!translate-x-0 max-md:!translate-y-0 max-md:!rounded-none"
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
            <input ref={imageInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.zip,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={handleAttachmentUpload} />
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {attachments.map((att, i) => (
                  <div key={`${att.url}-${i}`} className="group relative">
                    {isImageAtt(att) ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={att.url} alt="" className="w-full max-h-[420px] rounded border border-border/50 object-cover" />
                        <button
                          onClick={() => removeAttachment(att)}
                          className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="size-3" />
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 rounded border border-border/50 bg-muted/30 px-2 py-1.5">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 truncate text-sm text-blue-400 hover:text-blue-300 hover:underline"
                          title={att.name ?? att.url}
                        >
                          {att.name ?? att.url}
                        </a>
                        <button
                          onClick={() => removeAttachment(att)}
                          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => requireAuth(() => imageInputRef.current?.click())}
              disabled={uploading}
              className="mt-2 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent transition-colors"
            >
              <Image className="size-3.5" />
              {uploading ? "Uploading..." : "Add image"}
            </button>
            <button
              onClick={() => setDocPickerOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent transition-colors"
            >
              <FileText className="size-3.5" />
              Add document
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
              <Popover onOpenChange={(v) => { popoverOpenRef.current = v }}>
                <PopoverTrigger
                  render={
                    <button className={cn("flex h-7 cursor-default items-center gap-1.5 border-0 px-2 text-xs hover:bg-accent data-open:bg-accent", issueTypeColor(issueType))}>
                      {(() => { const TIcon = issueTypeIcon(issueType); return <TIcon className="size-3.5" /> })()}
                      {TYPE_OPTIONS.find((o) => o.value === issueType)?.label ?? "Task"}
                    </button>
                  }
                />
                <PopoverContent className="w-32 p-1" align="start">
                  {TYPE_OPTIONS.map((opt) => {
                    const TIcon = opt.icon
                    return (
                      <button
                        key={opt.value}
                        className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent", issueType === opt.value ? "text-foreground" : opt.color)}
                        onClick={() => {
                          setIssueType(opt.value)
                          setIsEpic(opt.value === "epic")
                        }}
                      >
                        <TIcon className="size-3.5" />
                        {opt.label}
                      </button>
                    )
                  })}
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
                  <SelectItem value="LD"><Circle className="size-3 text-green-400" />LD</SelectItem>
                  <SelectItem value="CM"><Circle className="size-3 text-pink-400" />CM</SelectItem>
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
              <Popover onOpenChange={(v) => { popoverOpenRef.current = v }}>
                <PopoverTrigger
                  render={
                    <button
                      className={cn(
                        "flex h-7 cursor-default items-center gap-1.5 border-0 px-2 text-xs hover:bg-accent",
                        dueDate ? "text-muted-foreground" : "text-muted-foreground opacity-60"
                      )}
                    >
                      <CalendarIcon className={cn("size-3.5", dueDate ? "text-muted-foreground/60" : "text-muted-foreground/40")} />
                      {dueDate ? format(new Date(dueDate), "MMM d, yyyy") : "Due date"}
                    </button>
                  }
                />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ? new Date(dueDate) : undefined}
                    onSelect={(date) => setDueDate(date ? format(date, "yyyy-MM-dd") : null)}
                  />
                  {dueDate && (
                    <div className="border-t border-border/50 p-1">
                      <button
                        className="flex w-full items-center justify-center rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                        onClick={() => setDueDate(null)}
                      >
                        Clear date
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {issueType !== "epic" && (
              <Popover open={epicPickerOpen} onOpenChange={(v) => { setEpicPickerOpen(v); popoverOpenRef.current = v; if (!v) setEpicSearch("") }}>
                <PopoverTrigger
                  render={
                      <button className={cn("flex h-7 cursor-default items-center gap-1.5 border-0 px-2 text-xs hover:bg-accent", parentEpicIds.length > 0 ? "text-purple-400" : "text-muted-foreground")}>
                        <Layers className="size-3.5" />
                        {parentEpicIds.length > 0 ? `${parentEpicIds.length} epic${parentEpicIds.length > 1 ? 's' : ''}` : "No Epic"}
                      </button>
                    }
                  />
                  <PopoverContent className="w-56 p-1 max-h-60 overflow-y-auto" align="start">
                    <input
                      autoFocus
                      placeholder="Search epics..."
                      value={epicSearch}
                      onChange={(e) => setEpicSearch(e.target.value)}
                      className="w-full rounded border border-border/50 bg-transparent px-2 py-1 text-xs text-muted-foreground outline-none mb-1 placeholder:text-muted-foreground/30"
                    />
                    {parentEpicIds.length > 0 && (
                      <button
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                        onClick={() => setParentEpicIds([])}
                      >
                        <Circle className="size-3 text-muted-foreground/40" />
                        Remove from all epics
                      </button>
                    )}
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Select epics</div>
                    {epics
                      .filter((e) => !epicSearch.trim() || e.title.toLowerCase().includes(epicSearch.trim().toLowerCase()))
                      .map((e) => {
                        const checked = parentEpicIds.includes(e.id)
                        return (
                          <label
                            key={e.id}
                            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent cursor-pointer", checked ? "text-purple-400" : "text-muted-foreground")}
                          >
                            <span
                              role="checkbox"
                              aria-checked={checked}
                              onClick={() => setParentEpicIds((prev) => checked ? prev.filter((id) => id !== e.id) : [...prev, e.id])}
                              className={cn(
                                "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors cursor-pointer",
                                checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
                              )}
                            >
                              {checked && <Check className="size-3" />}
                            </span>
                            <Layers className="size-3.5 shrink-0 text-purple-400" />
                            <span className="truncate">{e.title}</span>
                          </label>
                        )
                      })}
                    {epics.length === 0 ? (
                      <span className="block px-2 py-1.5 text-xs text-muted-foreground/50">No epics yet</span>
                    ) : epics.filter((e) => !epicSearch.trim() || e.title.toLowerCase().includes(epicSearch.trim().toLowerCase())).length === 0 ? (
                      <span className="block px-2 py-1.5 text-xs text-muted-foreground/50">No matches</span>
                    ) : null}
                  </PopoverContent>
                </Popover>
              )}
              <Popover open={assigneeOpen} onOpenChange={(v) => { setAssigneeOpen(v); popoverOpenRef.current = v }}>
                <PopoverTrigger
                  render={
                    <button
                      className={cn(
                        "flex h-7 cursor-default items-center gap-1.5 border-0 px-2 text-xs text-muted-foreground hover:bg-accent",
                        !assigneeId && "opacity-60"
                      )}
                    >
                      {assigneeId ? (
                        (() => {
                          const u = users.find((u) => u.id === assigneeId)
                          return (
                            <>
                              <Avatar className="size-4 shrink-0">
                                <AvatarFallback className={cn(userAvatarColor((u?.name ?? "?")), "text-[9px]")}>
                                  {(u?.name ?? "?")[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <UserDisplayName name={u?.name} email={u?.email ?? ""} displayName={u?.display_name} department={deptMap.get(assigneeId)} />
                            </>
                          )
                        })()
                      ) : (
                        <>
                          <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/20 text-[9px]">?</span>
                          Unassigned
                        </>
                      )}
                    </button>
                  }
                />
                <PopoverContent className="w-48 p-1" align="start">
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                    onClick={() => { setAssigneeId(null); setAssigneeOpen(false) }}
                  >
                    <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/20 text-[9px]">?</span>
                    Unassigned
                  </button>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
                      onClick={() => { setAssigneeId(u.id); setAssigneeOpen(false) }}
                    >
                      <Avatar className="size-4 shrink-0">
                        <AvatarFallback className={cn(userAvatarColor((u.name ?? u.email)), "text-[9px]")}>
                          {(u.name ?? u.email)[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <UserDisplayName name={u.name} email={u.email} displayName={u.display_name} department={deptMap.get(u.id)} />
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              <div className="ml-auto flex items-center">
                <Button size="sm" disabled={!title.trim()} onClick={(e) => { e.stopPropagation(); handleSubmit() }}>
                  Create Issue
                </Button>
              </div>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
      <Dialog open={docPickerOpen} onOpenChange={setDocPickerOpen}>
      <DialogContent className="sm:max-w-md" forceRenderOverlay>
        <DialogTitle className="text-sm font-medium">Link document</DialogTitle>
        <Input
          autoFocus
          value={docSearch}
          onChange={(e) => setDocSearch(e.target.value)}
          placeholder="Search documents..."
        />
        {(() => {
          const available = documents
            .filter((doc) => !attachments.some((a) => a.url === `/docs?doc=${doc.id}`))
            .filter((doc) => !docSearch || doc.title.toLowerCase().includes(docSearch.toLowerCase()))
          return available.length > 0 ? (
            <div className="max-h-48 overflow-auto">
              <div className="space-y-0.5">
                {available.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleDocLinkExisting(doc.id, doc.title)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                  >
                    <FileText className="size-3.5 shrink-0" />
                    <span className="truncate">{doc.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <span className="block text-xs text-muted-foreground/50 py-1">No documents found</span>
          )
        })()}
      </DialogContent>
    </Dialog>
    </>
  )
}
