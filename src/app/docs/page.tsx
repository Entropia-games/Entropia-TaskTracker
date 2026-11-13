"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  const [sidebarWidth, setSidebarWidth] = useState(266)
  const [resizing, setResizing] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeDocId = activeDocument?.id ?? null

  // Refs let the URL effects below read fresh values without re-running (and fighting
  // each other) every time the active document or the document list changes.
  const activeDocIdRef = useRef(activeDocId)
  const documentsRef = useRef(documents)
  const docsReady = documents.length > 0
  const mirroredDocIdRef = useRef<number | null>(null)
  const didMountRef = useRef(false)

  useEffect(() => {
    activeDocIdRef.current = activeDocId
  }, [activeDocId])

  useEffect(() => {
    documentsRef.current = documents
  }, [documents])

  // Mirror the document that is actually open into ?doc= so the address bar (and any
  // copied/shared link) always points at the content shown in the editor.
  useEffect(() => {
    const raw = searchParams.get("doc")
    const urlDocId = raw == null ? null : Number(raw)
    if (!didMountRef.current) {
      didMountRef.current = true
      // On the first render a ?doc= link is the requested document. Let the effect below
      // open it before we start mirroring the current selection back into the URL.
      if (urlDocId != null && urlDocId !== activeDocId) return
    }
    if (activeDocId == null || mirroredDocIdRef.current === activeDocId) return
    mirroredDocIdRef.current = activeDocId
    router.replace(`/docs?doc=${activeDocId}`, { scroll: false })
  }, [activeDocId, searchParams, router])

  // Follow ?doc= whenever it changes (wiki links, in-app links, back/forward), even if
  // a different document is already open.
  useEffect(() => {
    const raw = searchParams.get("doc")
    if (!raw || !docsReady) return
    const docId = Number(raw)
    if (!Number.isFinite(docId)) return
    if (docId === activeDocIdRef.current) return
    const doc = documentsRef.current.find((d) => d.id === docId)
    if (doc) void setActiveDocument(doc)
  }, [searchParams, docsReady, setActiveDocument])

  useEffect(() => {
    if (!resizing) return
    const onMouseMove = (e: MouseEvent) => {
      setSidebarWidth((prev) => {
        const newWidth = window.innerWidth - e.clientX
        return Math.max(180, Math.min(500, newWidth))
      })
    }
    const onMouseUp = () => setResizing(false)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [resizing])

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
        <div className="relative shrink-0 border-l border-border overflow-auto" style={{ width: sidebarWidth }}>
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/50 transition-colors"
            onMouseDown={() => setResizing(true)}
          />
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
