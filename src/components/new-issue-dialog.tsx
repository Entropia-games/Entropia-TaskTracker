"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
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
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { useIssues, type IssueStatus, type IssuePriority } from "@/lib/issues-context"
import { useAuthGate } from "@/lib/auth-gate-context"
import { Plus, CalendarIcon } from "lucide-react"
import { format } from "date-fns"

const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "canceled", label: "Canceled" },
] as const

const PRIORITY_OPTIONS = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const

export function NewIssueDialog() {
  const { addIssue } = useIssues()
  const { requireAuth } = useAuthGate()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus_] = useState("todo")
  const [priority, setPriority_] = useState("none")
  const setStatus = (v: string | null) => setStatus_(v ?? "todo")
  const setPriority = (v: string | null) => setPriority_(v ?? "none")
  const [dueDate, setDueDate] = useState<Date>()

  const handleSubmit = () => {
    if (!title.trim()) return
    addIssue({
      title: title.trim(),
      description: description.trim() ? description : null,
      status: status as IssueStatus,
      priority: priority as IssuePriority,
      due_date: dueDate ? dueDate.toISOString() : null,
    })
    setTitle("")
    setDescription("")
    setStatus_("todo")
    setPriority_("none")
    setDueDate(undefined)
    setOpen(false)
  }

  return (
    <>
      <button
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent"
        onClick={() => requireAuth(() => setOpen(true))}
      >
        <Plus className="size-3.5" />
        New Issue
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="!max-w-xl !rounded-xl !p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Create issue</DialogTitle>
        <div className="flex flex-col gap-0">
          <div className="flex flex-col gap-4 px-5 pb-2 pt-6">
            <Input
              placeholder="Issue title"
              className="!border-0 !bg-transparent !p-0 !text-xl !font-medium !shadow-none placeholder:text-muted-foreground/40 focus-visible:!ring-0"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <textarea
              placeholder="Add description..."
              className="min-h-0 resize-y border-0 bg-transparent p-0 text-sm text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter className="!mt-0 !rounded-none border-border/50 bg-background px-5 py-2 sm:flex sm:flex-row sm:justify-between">
            <div className="flex flex-wrap items-center gap-1">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-7 gap-1 border-hidden bg-transparent pr-1 pl-2 text-xs text-muted-foreground hover:bg-accent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-7 gap-1 border-hidden bg-transparent pr-1 pl-2 text-xs text-muted-foreground hover:bg-accent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      className={cn(
                        "flex h-7 cursor-default items-center gap-1 border-hidden px-2 text-xs text-muted-foreground hover:bg-accent",
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
            </div>
            <div className="flex items-center gap-2 pt-2 sm:pt-0">
              <DialogClose render={<Button variant="ghost" size="sm">Cancel</Button>} />
              <Button size="sm" disabled={!title.trim()} onClick={handleSubmit}>
                Create
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
      </Dialog>
    </>
  )
}
