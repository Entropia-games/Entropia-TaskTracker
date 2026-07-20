import type { LucideIcon } from "lucide-react"
import { FileText, Bug, Layers } from "lucide-react"
import type { IssueType } from "@/lib/issues-context"

export const TYPE_OPTIONS: { value: IssueType; label: string; icon: LucideIcon; color: string }[] = [
  { value: "task", label: "Task", icon: FileText, color: "text-muted-foreground" },
  { value: "bug",  label: "Bug",  icon: Bug,      color: "text-red-400" },
  { value: "epic", label: "Epic", icon: Layers,   color: "text-purple-400" },
]

export function issueTypeIcon(type: IssueType | null | undefined): LucideIcon {
  return TYPE_OPTIONS.find((o) => o.value === type)?.icon ?? FileText
}

export function issueTypeColor(type: IssueType | null | undefined): string {
  return TYPE_OPTIONS.find((o) => o.value === type)?.color ?? "text-muted-foreground"
}
