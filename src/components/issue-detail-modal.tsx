"use client"

import React, { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import type { Issue, IssueStatus, IssuePriority, IssueTeam, IssueType, Attachment, IssueComment } from "@/lib/issues-context"
import { useIssues } from "@/lib/issues-context"
import { issueTypeIcon, issueTypeColor } from "@/lib/issue-types"
import { useDocs } from "@/lib/docs-context"
import { useAuthGate } from "@/lib/auth-gate-context"
import { uploadFiles } from "@/lib/uploadthing"
import { compressImage } from "@/lib/compress-image"
import { renameFile, slugify } from "@/lib/upload-rename"
import { showToast } from "@/lib/toast"
import type { Database } from "@/lib/database.types"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { UserDisplayName } from "@/components/ui/display-name"
import { useDeptMap } from "@/lib/use-dept-map"
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
import {
  Circle,
  CircleDot,
  CircleCheck,
  CircleOff,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertCircle,
  CalendarIcon,
  Layers,
  Plus,
  Link,
  FileText,
  ExternalLink,
  Diamond,
  Image,
  Trash2,
  Pencil,
  X,
  ShieldOff,
  ShieldAlert,
} from "lucide-react"
import { format } from "date-fns"
import { cn, userAvatarColor } from "@/lib/utils"
import { getSupabase } from "@/lib/supabase"

const STATUS_OPTIONS: { value: IssueStatus; label: string; icon: typeof Circle; color: string }[] = [
  { value: "backlog",     label: "Backlog",     icon: CircleOff,   color: "text-muted-foreground/40" },
  { value: "todo",        label: "Todo",        icon: Circle,      color: "text-muted-foreground" },
  { value: "in_progress", label: "In Progress", icon: CircleDot,   color: "text-yellow-400" },
  { value: "done",        label: "Done",        icon: CircleCheck, color: "text-green-400" },
]

const PRIORITY_OPTIONS: { value: IssuePriority; label: string; icon: typeof Minus; color: string }[] = [
  { value: "none",   label: "No Priority", icon: Minus,      color: "text-muted-foreground/40" },
  { value: "low",    label: "Low",         icon: ArrowDown,  color: "text-muted-foreground" },
  { value: "medium", label: "Medium",      icon: Minus,      color: "text-blue-400" },
  { value: "high",   label: "High",        icon: ArrowUp,    color: "text-orange-400" },
  { value: "urgent", label: "Urgent",      icon: AlertCircle, color: "text-red-400" },
]

function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

const teamColors: Record<string, string> = {
  "3D":     "text-red-400",
  Concept:  "text-blue-400",
  DEV:      "text-purple-400",
  QA:       "text-white/80",
  GD:       "text-yellow-400",
  Sound:    "text-orange-400",
  LD:       "text-green-400",
}

type Props = {
  issue: Issue | null
  users: Database["public"]["Tables"]["users"]["Row"][]
  open: boolean
  onOpenChange: (v: boolean) => void
  onOpenDetail?: (issue: Issue) => void
  parentIssue?: Issue | null
}

export function IssueDetailModal({ issue, users, open, onOpenChange, onOpenDetail, parentIssue }: Props) {
  const { updateIssue, deleteIssues, issues, milestones, currentProject, addComment, deleteComment, updateComment, bumpDepsVersion } = useIssues()
  const { documents } = useDocs()
  const { requireAuth } = useAuthGate()
  const deptMap = useDeptMap()
  const [status, setStatus] = useState<IssueStatus>("backlog")
  const [priority, setPriority] = useState<IssuePriority>("none")
  const [team, setTeam] = useState<IssueTeam | null>(null)
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [milestoneId, setMilestoneId] = useState<number | null>(null)
  const [isEpic, setIsEpic] = useState(false)
  const [childIssues, setChildIssues] = useState<Issue[]>([])
  const [allEpics, setAllEpics] = useState<Issue[]>([])
  const [linkedPRs, setLinkedPRs] = useState<Database["public"]["Tables"]["issue_links"]["Row"][]>([])
  const [blockedBy, setBlockedBy] = useState<Database["public"]["Tables"]["issue_dependencies"]["Row"][]>([])
  const [blocks, setBlocks] = useState<Database["public"]["Tables"]["issue_dependencies"]["Row"][]>([])
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editingDescription, setEditingDescription] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmEpicToggle, setConfirmEpicToggle] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [docPickerOpen, setDocPickerOpen] = useState(false)
  const [docSearch, setDocSearch] = useState("")
  const [readyId, setReadyId] = useState<number | null>(null)
  const [displayedIssue, setDisplayedIssue] = useState<Issue | null>(null)
  const [timelineEntry, setTimelineEntry] = useState<{ start_date: string; end_date: string } | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [editingCommentText, setEditingCommentText] = useState("")
  const titleRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // `loading` is true while the target `issue`'s related data is buffering.
  // `data` is what is currently rendered: during loading we keep showing the
  // previously displayed issue; once ready we render the live `issue` so edits
  // and uploads stay in sync with context.
  const loading = open && !!issue && readyId !== issue.id
  const data = loading ? (displayedIssue ?? issue) : issue

  useEffect(() => {
    if (data) {
      setEditTitle(data.title)
      setEditDescription(data.description ?? "")
    }
  }, [data])

  useEffect(() => {
    if (editingDescription && descRef.current) {
      descRef.current.style.height = "auto"
      descRef.current.style.height = descRef.current.scrollHeight + "px"
      descRef.current.focus()
    }
  }, [editingDescription])

  useEffect(() => {
    if (!lightboxUrl) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxUrl(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightboxUrl])

  const [parentEpicId, setParentEpicId] = useState<number | null>(null)

  useEffect(() => {
    if (data) {
      setStatus(data.status)
      setPriority(data.priority)
      setTeam(data.team)
      setAssigneeId(data.assignee_id)
      setMilestoneId(data.milestone_id)
      setIsEpic(data.is_epic)
      setParentEpicId(data.parent_epic_id)
    }
  }, [data])

  useEffect(() => {
    if (!open || !issue) {
      setReadyId(null)
      setDisplayedIssue(null)
      setTimelineEntry(null)
      return
    }
    if (readyId === issue.id) {
      setDisplayedIssue(issue)
      return
    }
    // New target: buffer its related data, keep the previous issue on screen.
    setBlockedBy([])
    setBlocks([])
    let active = true
    const tasks: PromiseLike<void>[] = []
    if (issue.is_epic) {
      tasks.push(
        getSupabase().from("issues").select("*").eq("parent_epic_id", issue.id).then(({ data: rows }) => {
          if (active && rows) setChildIssues(rows as Issue[])
        }),
      )
    } else {
      tasks.push(
        getSupabase().from("issues").select("id,title").eq("is_epic", true).then(({ data: rows }) => {
          if (active && rows) setAllEpics(rows as Issue[])
        }),
      )
    }
    tasks.push(
      getSupabase().from("issue_links").select("*").eq("issue_id", issue.id).then(({ data: rows }) => {
        if (active && rows) setLinkedPRs(rows)
      }),
    )
    tasks.push(
      getSupabase().from("issue_dependencies").select("*").eq("issue_id", issue.id).then(({ data: rows }) => { if (active) setBlockedBy(rows ?? []) }),
      getSupabase().from("issue_dependencies").select("*").eq("blocked_by_id", issue.id).then(({ data: rows }) => { if (active) setBlocks(rows ?? []) }),
    )
    if (currentProject) {
      tasks.push(
        getSupabase()
          .from("timeline_entries")
          .select("start_date,end_date")
          .eq("project_id", currentProject.id)
          .eq("issue_id", issue.id)
          .maybeSingle()
          .then(({ data: row }) => {
            if (active) setTimelineEntry(row ? { start_date: row.start_date, end_date: row.end_date } : null)
          }),
      )
    }
    Promise.all(tasks).then(() => {
      if (active) {
        setReadyId(issue.id)
        setDisplayedIssue(issue)
      }
    })
    return () => {
      active = false
    }
  }, [open, issue, readyId])

  const show = open && (!loading || displayedIssue !== null)

  if (!issue) return null
  if (!data) return null

  const userMap = new Map(users.map((u) => [u.id, u]))
  const creatorName = data.created_by

  function linkifyText(text: string) {
    const lines = text.split("\n")
    const urlRegex = /(https?:\/\/[^\s<]+[^\s<,.])/g

    const renderLine = (line: string, key: number) => {
      const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/)
      if (imgMatch) {
        return (
          <div key={key} className="my-1">
            <img src={imgMatch[2]} alt={imgMatch[1]} className="max-h-96 max-w-full rounded-lg object-contain" />
          </div>
        )
      }
      const parts = line.split(urlRegex)
      return parts.map((part, pi) =>
        urlRegex.test(part)
          ? <a key={pi} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">{part}</a>
          : part
      )
    }

    const elements: React.ReactNode[] = []
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      const bulletMatch = line.match(/^[-*]\s+(.*)/)
      if (bulletMatch) {
        const items: React.ReactNode[] = []
        while (i < lines.length && lines[i].match(/^[-*]\s+(.*)/)) {
          const m = lines[i].match(/^[-*]\s+(.*)/)!
          items.push(<li key={items.length}>{renderLine(m[1], items.length)}</li>)
          i++
        }
        elements.push(<ul key={`ul-${i}`} className="list-disc pl-4 my-1">{items}</ul>)
      } else {
        elements.push(<span key={`p-${i}`}>{renderLine(line, i)}{i < lines.length - 1 && <br />}</span>)
        i++
      }
    }
    return elements
  }

  const currentAttachments = (data.attachments as Attachment[] | null) ?? []
  const isImageAtt = (a: Attachment) =>
    a.type?.startsWith("image/") ?? /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(a.url)

  const guardedUpdate = (patch: Parameters<typeof updateIssue>[1]) =>
    requireAuth(() => updateIssue(data.id, patch))

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const isImage = file.type.startsWith("image/")
      const toUpload = isImage ? await compressImage(file) : file
      const limit = isImage ? 4 * 1024 * 1024 : 16 * 1024 * 1024
      if (toUpload.size > limit) {
        setUploading(false)
        showToast(isImage ? "Photo is too large — max 4 MB" : "File is too large — max 16 MB")
        if (imageInputRef.current) imageInputRef.current.value = ""
        return
      }
      const [res] = await uploadFiles(isImage ? "image" : "file", { files: [renameFile(toUpload, `${isImage ? "task_image" : "task_file"}_${(currentProject?.code ?? "unknown").toLowerCase()}-${data.display_id}.${(file.name.split(".").pop() ?? "bin")}`)] })
      if (res?.serverData?.url) {
        const att: Attachment = {
          url: res.serverData.url,
          name: res.serverData.name ?? file.name,
          type: res.serverData.type ?? file.type,
        }
        guardedUpdate({ attachments: [...currentAttachments, att] })
      }
    } catch (err) {
      console.error("Upload failed", err)
    }
    setUploading(false)
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  const removeAttachment = async (att: Attachment) => {
    const next = currentAttachments.filter((a) => a.url !== att.url)
    guardedUpdate({ attachments: next })
    if (att.type !== "doc/link") {
      fetch("/api/delete-images", { method: "POST", body: JSON.stringify({ urls: [att.url] }) })
        .catch((e) => console.error("Failed to delete image", e))
    }
  }

  const handleDocLinkExisting = (docId: number, docTitle: string) => {
    guardedUpdate({
      attachments: [...currentAttachments, { url: `/docs?doc=${docId}`, name: docTitle, type: "doc/link" }],
    })
    setDocPickerOpen(false)
    setDocSearch("")
  }

  const activeStatus = STATUS_OPTIONS.find((s) => s.value === status)
  const activePriority = PRIORITY_OPTIONS.find((p) => p.value === priority)
  const StatusIcon = activeStatus?.icon ?? Circle
  const PriorityIcon = activePriority?.icon ?? Minus

  const doneCount = childIssues.filter((c) => c.status === "done").length
  const progress = childIssues.length > 0 ? Math.round((doneCount / childIssues.length) * 100) : 0

  const handleStatusChange = (v: IssueStatus) => {
    setStatus(v)
    guardedUpdate({ status: v })
  }

  const handlePriorityChange = (v: IssuePriority) => {
    setPriority(v)
    guardedUpdate({ priority: v })
  }

  const handleTeamChange = (v: IssueTeam | null) => {
    setTeam(v)
    guardedUpdate({ team: v })
  }

  const handleAssigneeChange = (id: string | null) => {
    setAssigneeId(id)
    guardedUpdate({ assignee_id: id })
  }

  const handleMilestoneChange = (id: number | null) => {
    setMilestoneId(id)
    guardedUpdate({ milestone_id: id })
  }

  const handleEpicToggle = () => {
    const next = !isEpic
    setIsEpic(next)
    if (!next) {
      getSupabase().from("issues").update({ parent_epic_id: null }).eq("parent_epic_id", data.id).then()
      issues.filter((i) => i.parent_epic_id === data.id).forEach((child) => updateIssue(child.id, { parent_epic_id: null }))
    }
    guardedUpdate({ is_epic: next, issue_type: next ? "epic" : "task" })
  }

  const handleParentEpicChange = (id: number | null) => {
    setParentEpicId(id)
    guardedUpdate({ parent_epic_id: id })
  }

  return (
    <Dialog open={show} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-xl !max-h-[90vh] !overflow-y-auto !rounded-xl !border-0 !p-0 sm:!max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">{currentProject?.code ?? "?"}-{data.display_id}</DialogTitle>
        <div className="flex flex-col gap-0">
          <div className="flex flex-col gap-4 px-5 pb-6 pt-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground/60 font-mono">
              {parentIssue && (
                <button
                  onClick={() => { onOpenDetail?.(parentIssue) }}
                  className="flex items-center gap-1 rounded px-1 py-0.5 text-muted-foreground/50 hover:bg-accent hover:text-foreground transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
              )}
              {data.issue_type && data.issue_type !== "task" && (() => {
                const TypeIcon = issueTypeIcon(data.issue_type)
                return <TypeIcon className={cn("size-3.5", issueTypeColor(data.issue_type))} />
              })()}
              <span>{currentProject?.code ?? "?"}-{data.display_id}</span>
              <span className="text-muted-foreground/20">·</span>
              <span className={cn(activeStatus?.color)}>{activeStatus?.label}</span>
              <button
                onClick={() => onOpenChange(false)}
                className="ml-auto rounded p-1 text-muted-foreground/40 hover:bg-accent hover:text-foreground transition-colors outline-none ring-0"
                title="Close"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <input
              ref={titleRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => { if (editTitle !== data.title) guardedUpdate({ title: editTitle }) }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur() } }}
              className="w-full border-none bg-transparent p-0 text-lg font-medium outline-none ring-0"
            />
              <div>
                {editingDescription ? (
                  <textarea
                    ref={descRef}
                    value={editDescription}
                    onChange={(e) => {
                      setEditDescription(e.target.value)
                      e.target.style.height = "auto"
                      e.target.style.height = e.target.scrollHeight + "px"
                    }}
                    onBlur={() => { setEditingDescription(false); if (editDescription !== (data.description ?? "")) guardedUpdate({ description: editDescription.trim() ? editDescription : null }) }}
                    placeholder="Add description..."
                    rows={3}
                    className="w-full resize-none overflow-hidden border-none bg-transparent p-0 text-sm text-muted-foreground outline-none ring-0 placeholder:text-muted-foreground/30"
                  />
                ) : (
                  <div
                    className="w-full cursor-text whitespace-pre-wrap text-sm text-muted-foreground outline-none ring-0"
                    onClick={() => { setEditDescription(data.description ?? ""); setEditingDescription(true) }}
                  >
                    {data.description?.trim() ? linkifyText(data.description) : <span className="text-muted-foreground/30">Add description...</span>}
                  </div>
                )}
                             </div>
               <input ref={imageInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt,.zip,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={handleAttachmentUpload} />
              {currentAttachments.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {currentAttachments.map((att, i) => (
                    <div key={`${att.url}-${i}`} className="group relative">
                      {isImageAtt(att) ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={att.url}
                            alt=""
                            onClick={() => setLightboxUrl(att.url)}
                            className="w-full max-h-[420px] cursor-pointer rounded border border-border/50 object-cover"
                          />
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

          <div className="!mt-0 !rounded-none !border-t !border-border/50 px-5 py-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Select value={status} onValueChange={(v) => handleStatusChange(v as IssueStatus)}>
                <SelectTrigger className="h-7 gap-1.5 border border-transparent bg-transparent px-2 text-xs text-muted-foreground hover:border-border/30 hover:bg-accent data-open:bg-accent">
                  <StatusIcon className={cn("size-3.5", activeStatus?.color)} />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start" className="min-w-40">
                  {STATUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <Icon className={cn("size-3.5", opt.color)} />
                        {opt.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              <Select value={priority} onValueChange={(v) => handlePriorityChange(v as IssuePriority)}>
                <SelectTrigger className="h-7 gap-1.5 border border-transparent bg-transparent px-2 text-xs text-muted-foreground hover:border-border/30 hover:bg-accent data-open:bg-accent">
                  <PriorityIcon className={cn("size-3.5", activePriority?.color)} />
                  <SelectValue>{PRIORITY_OPTIONS.find((o) => o.value === priority)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start" className="min-w-40">
                  {PRIORITY_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <Icon className={cn("size-3.5", opt.color)} />
                        {opt.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              <Select value={team ?? "none"} onValueChange={(v) => handleTeamChange(v === "none" ? null : v as IssueTeam)}>
                <SelectTrigger className={cn("h-7 gap-1.5 border border-transparent bg-transparent px-2 text-xs hover:border-border/30 hover:bg-accent data-open:bg-accent", team ? teamColors[team] : "text-muted-foreground")}>
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
                </SelectContent>
              </Select>

              {milestones.length > 0 && (
                <Select value={milestoneId?.toString() ?? "none"} onValueChange={(v) => handleMilestoneChange(v === "none" ? null : Number(v))}>
                  <SelectTrigger className={cn("h-7 gap-1.5 border border-transparent bg-transparent px-2 text-xs hover:border-border/30 hover:bg-accent data-open:bg-accent", milestoneId ? "text-foreground" : "text-muted-foreground")}>
                    <Diamond className={cn("size-3 shrink-0", milestoneId ? "text-red-400/60" : "text-muted-foreground/40")} />
                    <SelectValue>{milestoneId ? milestones.find((m) => m.id === milestoneId)?.name : "No Milestone"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start" className="min-w-40">
                    <SelectItem value="none"><Diamond className="size-3 text-muted-foreground/40" />No Milestone</SelectItem>
                    {milestones.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}><Diamond className="size-3 text-red-400/60" />{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {data.due_date && (
                <div className="flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 hover:border-border/30">
                  <CalendarIcon className="size-3.5 text-muted-foreground/60" />
                  <span className="text-xs text-muted-foreground">{format(new Date(data.due_date), "MMM d, yyyy")}</span>
                </div>
              )}

              {timelineEntry && (
                <div className="flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 hover:border-border/30">
                  <CalendarIcon className="size-3.5 text-green-400/70" />
                  <span className="text-xs text-muted-foreground">
                    Timeline: {format(parseDateOnly(timelineEntry.start_date), "MMM d, yyyy")} – {format(parseDateOnly(timelineEntry.end_date), "MMM d, yyyy")}
                  </span>
                </div>
              )}

              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      className={cn(
                        "flex h-7 cursor-default items-center gap-1.5 border border-transparent px-2 text-xs text-muted-foreground hover:border-border/30 hover:bg-accent",
                        !assigneeId && "opacity-60"
                      )}
                    >
                      {assigneeId ? (
                        <>
                          <Avatar className="size-4">
                            <AvatarFallback className={cn(userAvatarColor((userMap.get(assigneeId)?.name ?? "?")), "text-[8px]")}>
                              {(userMap.get(assigneeId)?.name ?? "?")[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                           <UserDisplayName name={userMap.get(assigneeId)?.name} email={userMap.get(assigneeId)?.email ?? ""} displayName={userMap.get(assigneeId)?.display_name} department={deptMap.get(assigneeId)} />
                        </>
                      ) : (
                        "Unassigned"
                      )}
                    </button>
                  }
                />
                <PopoverContent className="w-48 p-1" align="start">
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                    onClick={() => handleAssigneeChange(null)}
                  >
                    <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/20 text-[9px]">?</span>
                    Unassigned
                  </button>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
                      onClick={() => handleAssigneeChange(u.id)}
                    >
                      <Avatar className="size-4">
                        <AvatarFallback className={cn(userAvatarColor((u.name ?? u.email)), "text-[9px]")}>
                          {(u.name ?? u.email)[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                       <UserDisplayName name={u.name} email={u.email} displayName={u.display_name} department={deptMap.get(u.id)} />
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground/60">
              {creatorName && <span>Created by {creatorName}</span>}
              <span>{format(new Date(data.created_at), "MMM d, yyyy · HH:mm")}</span>
              <button
                onClick={isEpic ? () => setConfirmEpicToggle(true) : handleEpicToggle}
                className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-accent", isEpic ? "text-purple-400" : "text-muted-foreground/60")}
              >
                <Layers className="size-3.5" />
                <span className="text-[11px]">{isEpic ? "Epic" : "Mark as epic"}</span>
              </button>
              {!isEpic && (
                <Popover>
                  <PopoverTrigger
                    render={
                      <button className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground/60 transition-colors hover:bg-accent">
                        <Link className="size-3.5" />
                        <span className="text-[11px]">{parentEpicId ? "Linked to epic" : "Link to epic"}</span>
                      </button>
                    }
                  />
                  <PopoverContent className="w-56 p-1" align="start">
                    {parentEpicId && (
                      <button
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                        onClick={() => handleParentEpicChange(null)}
                      >
                        Remove from epic
                      </button>
                    )}
                    {allEpics.map((e) => (
                      <button
                        key={e.id}
                        className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent", parentEpicId === e.id ? "text-purple-400" : "text-muted-foreground")}
                        onClick={() => handleParentEpicChange(e.id)}
                      >
                        <Layers className="size-3.5" />
                        <span className="truncate">{e.title}</span>
                      </button>
                    ))}
                    {allEpics.length === 0 && (
                      <span className="block px-2 py-1.5 text-xs text-muted-foreground/50">No epics yet</span>
                    )}
                  </PopoverContent>
                  </Popover>
                )}
              <Popover>
                <PopoverTrigger
                  render={
                    <button className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground/60 transition-colors hover:bg-accent">
                      <ShieldOff className="size-3.5" />
                      <span className="text-[11px]">Blocked by</span>
                    </button>
                  }
                />
                <PopoverContent className="w-56 p-1 max-h-60 overflow-y-auto" align="start">
                  <input
                    autoFocus
                    placeholder="Search..."
                    className="w-full rounded border border-border/50 bg-transparent px-2 py-1 text-xs text-muted-foreground outline-none mb-1 placeholder:text-muted-foreground/30"
                    onChange={(e) => {
                      const q = e.target.value.toLowerCase()
                      const list = e.target.closest("[data-slot='popover-content']")?.querySelectorAll("[data-dep-item]") as NodeListOf<HTMLElement>
                      list?.forEach((el) => {
                        const title = el.getAttribute("data-title")?.toLowerCase() ?? ""
                        const id = el.getAttribute("data-id")?.toLowerCase() ?? ""
                        el.style.display = title.includes(q) || id.includes(q) ? "" : "none"
                      })
                    }}
                  />
                  {issues.filter((i) => i.id !== data.id && !blockedBy.some((d) => d.blocked_by_id === i.id)).map((i) => (
                    <button
                      key={i.id}
                      data-dep-item
                      data-title={i.title.toLowerCase()}
                      data-id={`${currentProject?.code ?? ""}-${i.display_id}`.toLowerCase()}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                      onClick={() => {
                        getSupabase().from("issue_dependencies").insert({ issue_id: data.id, blocked_by_id: i.id }).then(() => {
                          setBlockedBy((prev) => [...prev, { id: Date.now(), issue_id: data.id, blocked_by_id: i.id, created_at: new Date().toISOString() }])
                          bumpDepsVersion()
                        })
                      }}
                    >
                      <span className="text-muted-foreground/40 font-mono">{currentProject?.code ?? "?"}-{i.display_id}</span>
                      <span className="flex-1 truncate">{i.title}</span>
                    </button>
                  ))}
                  {issues.filter((i) => i.id !== data.id && !blockedBy.some((d) => d.blocked_by_id === i.id)).length === 0 && (
                    <span className="block px-2 py-1.5 text-xs text-muted-foreground/50">No issues available</span>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {linkedPRs.length > 0 && (
              <div className="mt-4 space-y-1.5 border-t border-border/30 pt-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Linked PRs</span>
                {linkedPRs.map((link) => {
                  const stateColor =
                    link.pr_state === "merged" ? "bg-purple-500/20 text-purple-400" :
                    link.pr_state === "open" ? "bg-green-500/20 text-green-400" :
                    "bg-muted/50 text-muted-foreground/60"
                  return (
                    <div key={link.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                      <a href={link.pr_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 min-w-0 flex-1 hover:text-foreground transition-colors">
                        <span className={cn("shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium", stateColor)}>
                          {link.pr_state === "merged" ? "Merged" : link.pr_state === "open" ? "Open" : "Closed"}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{link.pr_title}</span>
                        <ExternalLink className="size-3 shrink-0 text-muted-foreground/40" />
                      </a>
                    </div>
                  )
                })}
              </div>
            )}
            {(blockedBy.length > 0 || blocks.length > 0) && (
              <div className="mt-4 space-y-2 border-t border-border/30 pt-4">
                {blockedBy.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Blocked by</span>
                    <div className="mt-1 space-y-0.5">
                      {blockedBy.map((dep) => {
                        const blocker = issues.find((i) => i.id === dep.blocked_by_id)
                        if (!blocker) return null
                        const sColor = STATUS_OPTIONS.find((s) => s.value === blocker.status)?.color
                        return (
                          <div key={dep.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent/50 cursor-pointer" onClick={() => onOpenDetail?.(blocker)}>
                            <ShieldOff className="size-3.5 shrink-0 text-red-400" />
                            <Circle className={cn("size-2.5 shrink-0 fill-current", sColor ?? "text-muted-foreground/40")} />
                            <span className="text-xs text-muted-foreground/40 font-mono">{currentProject?.code ?? "?"}-{blocker.display_id}</span>
                            <span className="flex-1 truncate text-xs">{blocker.title}</span>
                            <button
                              className="shrink-0 rounded p-0.5 text-muted-foreground/30 hover:text-muted-foreground hover:bg-accent"
                              onClick={(e) => { e.stopPropagation(); getSupabase().from("issue_dependencies").delete().eq("id", dep.id).then(() => { setBlockedBy((prev) => prev.filter((d) => d.id !== dep.id)); setBlocks((prev) => prev.filter((d) => d.id !== dep.id)); bumpDepsVersion() }) }}
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {blocks.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Blocks</span>
                    <div className="mt-1 space-y-0.5">
                      {blocks.map((dep) => {
                        const blocked = issues.find((i) => i.id === dep.issue_id)
                        if (!blocked) return null
                        const sColor = STATUS_OPTIONS.find((s) => s.value === blocked.status)?.color
                        return (
                          <div key={dep.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent/50 cursor-pointer" onClick={() => onOpenDetail?.(blocked)}>
                            <ShieldAlert className="size-3.5 shrink-0 text-amber-400" />
                            <Circle className={cn("size-2.5 shrink-0 fill-current", sColor ?? "text-muted-foreground/40")} />
                            <span className="text-xs text-muted-foreground/40 font-mono">{currentProject?.code ?? "?"}-{blocked.display_id}</span>
                            <span className="flex-1 truncate text-xs">{blocked.title}</span>
                            <button
                              className="shrink-0 rounded p-0.5 text-muted-foreground/30 hover:text-muted-foreground hover:bg-accent"
                              onClick={(e) => { e.stopPropagation(); getSupabase().from("issue_dependencies").delete().eq("id", dep.id).then(() => { setBlockedBy((prev) => prev.filter((d) => d.id !== dep.id)); setBlocks((prev) => prev.filter((d) => d.id !== dep.id)); bumpDepsVersion() }) }}
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {isEpic && (
              <div className="mt-4 space-y-3 border-t border-border/30 pt-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-border/50 overflow-hidden">
                    <div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground/60 shrink-0">{doneCount}/{childIssues.length} ({progress}%)</span>
                  <Popover>
                    <PopoverTrigger
                      render={
                        <button className="shrink-0 rounded p-0.5 text-muted-foreground/40 hover:bg-accent hover:text-foreground transition-colors outline-none ring-0" title="Link issue to epic">
                          <Plus className="size-3.5" />
                        </button>
                      }
                    />
                    <PopoverContent className="w-64 p-1 max-h-60 overflow-y-auto" align="end">
                      {(() => {
                        const childIds = new Set(childIssues.map((c) => c.id))
                        const available = issues.filter((i) => !i.is_epic && !childIds.has(i.id))
                        if (available.length === 0) {
                          return <span className="block px-2 py-1.5 text-xs text-muted-foreground/50">All issues are linked</span>
                        }
                        return available.map((i) => (
                          <button
                            key={i.id}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                            onClick={() => { updateIssue(i.id, { parent_epic_id: data.id }) }}
                          >
                            <span className="text-muted-foreground/40 font-mono">{currentProject?.code ?? "?"}-{i.display_id}</span>
                            <span className="flex-1 truncate">{i.title}</span>
                          </button>
                        ))
                      })()}
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-0.5">
                  {childIssues.map((child) => {
                    const sColor = STATUS_OPTIONS.find((s) => s.value === child.status)?.color
                    return (
                      <div
                        key={child.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent/50"
                        onClick={() => onOpenDetail?.(child)}
                      >
                        <Circle className={cn("size-3 shrink-0 fill-current", sColor ?? "text-muted-foreground/40")} />
                        <span className="text-xs text-muted-foreground/40 font-mono">{child.id}</span>
                        <span className="flex-1 truncate">{child.title}</span>
                        {child.assignee_id && userMap.has(child.assignee_id) && (
                          <span className="shrink-0 text-xs text-muted-foreground/50">{userMap.get(child.assignee_id)?.name}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

            <div className="mt-4 border-t border-border/50 pt-4 px-4">
              <textarea
                placeholder="Add a comment..."
                className="w-full min-h-[60px] resize-none rounded border border-border/50 bg-transparent px-3 py-2 text-sm text-muted-foreground placeholder:text-muted-foreground/30 outline-none focus:ring-0 focus:border-border/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    const target = e.target as HTMLTextAreaElement
                    const content = target.value.trim()
                    if (content) {
                      requireAuth(() => addComment(data.id, { content }))
                      target.value = ''
                    }
                  }
                }}
              />
              {data.comments && (data.comments as any[]).length > 0 && (
                <div className="mt-3 mb-4 space-y-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Comments</span>
                  {(data.comments as any[]).map((comment: any) => (
                    <div key={comment.id} className="flex gap-2 group">
                      <Avatar className="size-6 shrink-0">
                        <AvatarFallback className={cn(userAvatarColor(comment.author_name ?? ""), "text-[10px]")}>
                          {comment.author_name ? comment.author_name[0].toUpperCase() : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground/80">
                            {comment.author_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                          <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground/80 hover:bg-muted/50"
                              onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content) }}
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              className="p-0.5 rounded text-muted-foreground/40 hover:text-destructive/80 hover:bg-destructive/10"
                              onClick={() => deleteComment(comment.id, data.id)}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </div>
                        {editingCommentId === comment.id ? (
                          <div className="mt-1 flex gap-2">
                            <textarea
                              autoFocus
                              className="flex-1 min-h-[40px] resize-none rounded border border-border/50 bg-transparent px-2 py-1 text-sm text-muted-foreground outline-none focus:ring-0 focus:border-border/50"
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault()
                                  if (editingCommentText.trim()) {
                                    updateComment(comment.id, data.id, editingCommentText.trim())
                                    setEditingCommentId(null)
                                  }
                                }
                                if (e.key === 'Escape') setEditingCommentId(null)
                              }}
                            />
                            <div className="flex flex-col gap-1">
                              <button
                                className="px-2 py-0.5 text-[10px] rounded bg-muted/50 text-muted-foreground hover:bg-muted"
                                onClick={() => {
                                  if (editingCommentText.trim()) {
                                    updateComment(comment.id, data.id, editingCommentText.trim())
                                    setEditingCommentId(null)
                                  }
                                }}
                              >Save</button>
                              <button
                                className="px-2 py-0.5 text-[10px] rounded text-muted-foreground/50 hover:text-muted-foreground"
                                onClick={() => setEditingCommentId(null)}
                              >Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{comment.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end px-5 pb-4">
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground/40 hover:bg-destructive/10 hover:text-red-400 transition-colors outline-none ring-0"
                title="Delete issue"
              >
                <Trash2 className="size-3" />
                Delete Issue
              </button>
            </div>
        </div>

        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/40 backdrop-blur-[1px]">
            <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          </div>
        )}
      </DialogContent>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-xs" forceRenderOverlay>
          <DialogTitle className="text-sm font-medium">Delete issue?</DialogTitle>
          <p className="text-xs text-muted-foreground/60">This action cannot be undone.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => { setConfirmDelete(false); deleteIssues([data.id]); onOpenChange(false) }}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmEpicToggle} onOpenChange={setConfirmEpicToggle}>
        <DialogContent className="sm:max-w-xs" forceRenderOverlay>
          <DialogTitle className="text-sm font-medium">Convert to issue?</DialogTitle>
          <p className="text-xs text-muted-foreground/60">Child issues will no longer be linked to this epic.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmEpicToggle(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => { setConfirmEpicToggle(false); handleEpicToggle() }}>Convert</Button>
          </div>
        </DialogContent>
        {lightboxUrl &&
          createPortal(
            <div
              className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/85 p-4"
              onClick={() => setLightboxUrl(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxUrl}
                alt=""
                className="max-h-full max-w-full cursor-zoom-out rounded-lg object-contain"
              />
              <button
                onClick={() => setLightboxUrl(null)}
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <X className="size-4" />
              </button>
            </div>,
            document.body
          )}
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
              .filter((doc) => !currentAttachments.some((a) => a.url === `/docs?doc=${doc.id}`))
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
    </Dialog>
  )
}
