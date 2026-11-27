"use client"

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import type { Attachment, IssuePriority, IssueStatus, IssueTeam, IssueType } from "@/lib/issues-context"

type CreateIssueDraft = {
  title: string
  description: string
  status: IssueStatus
  priority: IssuePriority
  team: IssueTeam | null
  isEpic: boolean
  issueType: IssueType
  assigneeId: string | null
  milestoneId: number | null
  dueDate: string | null
  parentEpicIds: number[]
  attachments: Attachment[]
}

const initialDraft: CreateIssueDraft = {
  title: "",
  description: "",
  status: "todo",
  priority: "none",
  team: null,
  isEpic: false,
  issueType: "task",
  assigneeId: null,
  milestoneId: null,
  dueDate: null,
  parentEpicIds: [],
  attachments: [],
}

type CreateIssueDraftContextValue = {
  draft: CreateIssueDraft
  setDraft: React.Dispatch<React.SetStateAction<CreateIssueDraft>>
  resetDraft: () => void
  cleanRef: React.MutableRefObject<boolean>
}

const CreateIssueDraftContext = createContext<CreateIssueDraftContextValue | null>(null)

export function CreateIssueDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<CreateIssueDraft>(initialDraft)
  const cleanRef = useRef(true)

  const resetDraft = useCallback(() => {
    setDraft(initialDraft)
    cleanRef.current = true
  }, [])

  return (
    <CreateIssueDraftContext.Provider value={{ draft, setDraft, resetDraft, cleanRef }}>
      {children}
    </CreateIssueDraftContext.Provider>
  )
}

export function useCreateIssueDraft() {
  const ctx = useContext(CreateIssueDraftContext)
  if (!ctx) throw new Error("useCreateIssueDraft must be used within CreateIssueDraftProvider")
  return ctx
}
