"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useIssues } from "@/lib/issues-context"
import { useDocs } from "@/lib/docs-context"
import { DocTree } from "@/components/docs/doc-tree"
import { DocEditor } from "@/components/docs/doc-editor"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

function DocsPageInner() {
  const { user, loading: authLoading } = useAuth()
  const { myRole } = useIssues()
  const { sections, documents, activeDocument, setActiveDocument, createDocument, loading: docsLoading } = useDocs()
  const [newDocOpen, setNewDocOpen] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState("")
  const searchParams = useSearchParams()

  useEffect(() => {
    const docId = searchParams.get("doc")
    if (docId && documents.length > 0 && !activeDocument) {
      const doc = documents.find((d) => d.id === Number(docId))
      if (doc) setActiveDocument(doc)
    }
  }, [searchParams, documents, activeDocument, setActiveDocument])

  if (authLoading || docsLoading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>
  }
  if (!user) {
    return <div className="p-6 text-muted-foreground">Sign in to use docs.</div>
  }
  if (myRole !== "admin" && myRole !== "member") {
    return <div className="p-6 text-muted-foreground">Access denied.</div>
  }

  const handleCreateDoc = async () => {
    const title = newDocTitle.trim() || "Untitled"
    await createDocument(null, title)
    setNewDocTitle("")
    setNewDocOpen(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Button size="sm" onClick={() => setNewDocOpen(true)}>
          <Plus className="mr-1 size-4" />
          New Document
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex-1 min-w-0 overflow-auto pl-4 py-2">
          <DocEditor />
        </div>
        <div className="w-[266px] shrink-0 border-l border-border overflow-auto">
          <DocTree />
        </div>
      </div>

      <Dialog open={newDocOpen} onOpenChange={setNewDocOpen}>
        <DialogContent>
          <DialogTitle>New Document</DialogTitle>
          <DialogDescription>Enter a title for the new document.</DialogDescription>
          <Input
            autoFocus
            value={newDocTitle}
            onChange={(e) => setNewDocTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateDoc()
            }}
            placeholder="Document title"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDocOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDoc}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function DocsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
      <DocsPageInner />
    </Suspense>
  )
}
