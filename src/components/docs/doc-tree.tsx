"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Collision,
  type CollisionDetection,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FolderClosed,
  FolderOpen,
  Plus,
  Trash2,
  Pencil,
  GripVertical,
} from "lucide-react"
import { useDocs, type DocSection, type Document } from "@/lib/docs-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { SectionColorPicker } from "./section-color-picker"

function isDescendant(sections: DocSection[], ancestorId: number, candidateId: number): boolean {
  const queue = [ancestorId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === candidateId) return true
    for (const s of sections) {
      if (s.parent_id === current) queue.push(s.id)
    }
  }
  return false
}

function collisionBetweenSectionsAndDocs(
  args: Parameters<CollisionDetection>[0],
): Collision[] {
  const { active, droppableContainers, pointerCoordinates } = args
  if (!pointerCoordinates) return []

  const { x, y } = pointerCoordinates
  const activeId = String(active)

  let bestId: string | null = null
  let bestArea = Infinity

  for (const container of droppableContainers) {
    const id = String(container.id)
    if (!id.startsWith("section-")) continue
    if (id === activeId) continue
    const rect = container.node.current?.getBoundingClientRect()
    if (!rect) continue
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      const area = rect.width * rect.height
      if (area < bestArea) {
        bestArea = area
        bestId = id
      }
    }
  }

  if (bestId) return [{ id: bestId }]
  return []
}

function SortableSectionHeader({
  section,
  depth,
  expanded,
  onToggle,
  renamingId,
  renameValue,
  setRenameValue,
  onRenameSubmit,
  setRenamingId,
  onDeleteSection,
  isDragging,
}: {
  section: DocSection
  depth: number
  expanded: boolean
  onToggle: () => void
  renamingId: string | null
  renameValue: string
  setRenameValue: (v: string) => void
  onRenameSubmit: () => void
  setRenamingId: (id: string | null) => void
  onDeleteSection: (s: DocSection) => void
  isDragging: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isOver,
  } = useSortable({ id: `section-${section.id}` })
  const { updateSection } = useDocs()

  const folderColor = section.color ?? "#eab308"

  return (
    <SectionColorPicker
      currentColor={section.color}
      onColorChange={(color) => updateSection(section.id, { color })}
    >
      <div
        ref={setNodeRef}
        className={cn(
          "group flex items-center gap-1.5 px-2 py-1.5 text-sm hover:bg-accent cursor-pointer rounded-md",
          "text-muted-foreground",
          isDragging && "opacity-40",
          isOver && "bg-accent/30 ring-1 ring-primary/40",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-muted-foreground/50 hover:text-muted-foreground"
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        className="flex items-center gap-1.5 flex-1 min-w-0"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        {expanded ? (
          <FolderOpen className="size-5 shrink-0" style={{ color: folderColor }} />
        ) : (
          <FolderClosed className="size-5 shrink-0" style={{ color: folderColor }} />
        )}
        {renamingId === `section-${section.id}` ? (
          <input
            autoFocus
            className="flex-1 bg-transparent border-b border-border text-sm outline-none min-w-0"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSubmit()
              if (e.key === "Escape") setRenamingId(null)
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate text-sm">{section.name}</span>
        )}
      </button>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
        <button
          className="rounded p-0.5 hover:bg-accent-foreground/10"
          onClick={(e) => {
            e.stopPropagation()
            setRenamingId(`section-${section.id}`)
            setRenameValue(section.name)
          }}
        >
          <Pencil className="size-3" />
        </button>
        <button
          className="rounded p-0.5 hover:bg-destructive/20 hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDeleteSection(section)
          }}
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
    </SectionColorPicker>
  )
}

function SortableDoc({
  doc,
  depth,
  activeDocId,
  onSelectDoc,
  renamingId,
  renameValue,
  setRenameValue,
  onRenameSubmit,
  setRenamingId,
  onDeleteDocument,
}: {
  doc: Document
  depth: number
  activeDocId: number | null
  onSelectDoc: (doc: Document) => void
  renamingId: string | null
  renameValue: string
  setRenameValue: (v: string) => void
  onRenameSubmit: () => void
  setRenamingId: (id: string | null) => void
  onDeleteDocument: (doc: Document) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({ id: `doc-${doc.id}` })

  const isActive = activeDocId === doc.id
  return (
    <div ref={setNodeRef} className={cn("group", isDragging && "opacity-40")}>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm cursor-pointer",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab text-muted-foreground/50 hover:text-muted-foreground"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          className="flex items-center gap-1.5 flex-1 min-w-0"
          onClick={() => onSelectDoc(doc)}
        >
          <FileText className="size-5 shrink-0" />
          {renamingId === `doc-${doc.id}` ? (
            <input
              autoFocus
              className="flex-1 bg-transparent border-b border-border text-sm outline-none min-w-0"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={onRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameSubmit()
                if (e.key === "Escape") setRenamingId(null)
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate text-sm">{doc.title}</span>
          )}
        </button>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            className="rounded p-0.5 hover:bg-accent-foreground/10"
            onClick={(e) => {
              e.stopPropagation()
              setRenamingId(`doc-${doc.id}`)
              setRenameValue(doc.title)
            }}
          >
            <Pencil className="size-3" />
          </button>
          <button
            className="rounded p-0.5 hover:bg-destructive/20 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteDocument(doc)
            }}
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function DocTree() {
  const {
    sections,
    documents,
    activeDocument,
    setActiveDocument,
    createSection,
    updateSection,
    updateDocument,
    deleteSection,
    deleteDocument,
    moveDocument,
    moveSection,
    reorderDocuments,
    reorderSections,
  } = useDocs()

  const [expandedSections, setExpandedSections] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const saved = localStorage.getItem("docs-expanded-sections")
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [newSectionOpen, setNewSectionOpen] = useState(false)
  const [newSectionName, setNewSectionName] = useState("")
  const [newSectionParent, setNewSectionParent] = useState<number | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<{ type: "section" | "document"; data: DocSection | Document } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  useEffect(() => {
    localStorage.setItem("docs-expanded-sections", JSON.stringify([...expandedSections]))
  }, [expandedSections])

  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => a.position - b.position),
    [sections],
  )

  const rootSections = useMemo(
    () => sortedSections.filter((s) => s.parent_id === null),
    [sortedSections],
  )

  const docsBySection = useMemo(() => {
    const map = new Map<number, Document[]>()
    for (const d of documents) {
      if (d.section_id === null) continue
      const list = map.get(d.section_id) ?? []
      list.push(d)
      map.set(d.section_id, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.title.localeCompare(b.title))
    }
    return map
  }, [documents])

  const rootDocs = useMemo(
    () => documents.filter((d) => d.section_id === null).sort((a, b) => a.title.localeCompare(b.title)),
    [documents],
  )

  const allSortableIds = useMemo(() => {
    const sectionIds = sections.map((s) => `section-${s.id}`)
    const docIds = documents.map((d) => `doc-${d.id}`)
    return [...sectionIds, ...docIds]
  }, [sections, documents])

  const toggleSection = (id: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openNewSection = (parentId: number | null) => {
    setNewSectionParent(parentId)
    setNewSectionName("")
    setNewSectionOpen(true)
  }

  const handleCreateSection = async () => {
    const name = newSectionName.trim() || "New Section"
    const created = await createSection(name, newSectionParent)
    if (created && newSectionParent !== null) {
      setExpandedSections((prev) => new Set([...prev, newSectionParent!]))
    }
    setNewSectionOpen(false)
  }

  const handleRenameSubmit = () => {
    if (renamingId === null) return
    const value = renameValue.trim()
    if (!value) { setRenamingId(null); return }
    if (renamingId.startsWith("section-")) {
      updateSection(Number(renamingId.slice(8)), { name: value })
    } else if (renamingId.startsWith("doc-")) {
      updateDocument(Number(renamingId.slice(4)), { title: value })
    }
    setRenamingId(null)
  }

  const findDocSectionId = (docId: number): number | null => {
    const doc = documents.find((d) => d.id === docId)
    return doc?.section_id ?? null
  }

  const sortSectionAlphabetically = (sectionId: number | null, movedDocId?: number) => {
    const docs = documents
      .filter((d) => d.section_id === sectionId && d.id !== movedDocId)
      .sort((a, b) => a.title.localeCompare(b.title))
    const ids = docs.map((d) => d.id)
    if (movedDocId !== undefined) ids.push(movedDocId)
    ids.sort((a, b) => {
      const da = documents.find((d) => d.id === a)!
      const db = documents.find((d) => d.id === b)!
      return da.title.localeCompare(db.title)
    })
    return ids
  }

  const sortSectionsAlphabetically = (parentId: number | null, movedSectionId?: number) => {
    const siblings = sections
      .filter((s) => s.parent_id === parentId && s.id !== movedSectionId)
      .sort((a, b) => a.name.localeCompare(b.name))
    const ids = siblings.map((s) => s.id)
    if (movedSectionId !== undefined) ids.push(movedSectionId)
    ids.sort((a, b) => {
      const sa = sections.find((s) => s.id === a)!
      const sb = sections.find((s) => s.id === b)!
      return sa.name.localeCompare(sb.name)
    })
    return ids
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    const activeIdStr = String(active.id)

    if (activeIdStr.startsWith("doc-")) {
      const docId = Number(activeIdStr.slice(4))
      const docSectionId = findDocSectionId(docId)

      if (!over) {
        if (docSectionId === null) return
        const sortedIds = sortSectionAlphabetically(null, docId)
        moveDocument(docId, null, sortedIds.indexOf(docId))
        reorderDocuments(sortedIds)
        return
      }

      const overId = String(over.id)

      if (overId.startsWith("section-")) {
        const targetSectionId = Number(overId.slice(8))
        if (docSectionId === targetSectionId) return
        const sortedIds = sortSectionAlphabetically(targetSectionId, docId)
        moveDocument(docId, targetSectionId, sortedIds.indexOf(docId))
        reorderDocuments(sortedIds)
        setExpandedSections((prev) => new Set([...prev, targetSectionId]))
        return
      }

      if (overId.startsWith("doc-")) {
        const overDocId = Number(overId.slice(4))
        if (docId === overDocId) return
        const overDoc = documents.find((d) => d.id === overDocId)
        if (!overDoc) return
        const targetSectionId = overDoc.section_id

        if (docSectionId !== targetSectionId) {
          const sortedIds = sortSectionAlphabetically(targetSectionId, docId)
          moveDocument(docId, targetSectionId, sortedIds.indexOf(docId))
          reorderDocuments(sortedIds)
          return
        }

        const sortedIds = sortSectionAlphabetically(targetSectionId, docId)
        reorderDocuments(sortedIds)
        return
      }
    }

    if (activeIdStr.startsWith("section-")) {
      const sectionId = Number(activeIdStr.slice(8))
      const section = sections.find((s) => s.id === sectionId)
      if (!section) return

      if (!over) {
        if (section.parent_id === null) return
        const sortedIds = sortSectionsAlphabetically(null, sectionId)
        moveSection(sectionId, null, sortedIds.indexOf(sectionId))
        reorderSections(sortedIds)
        return
      }

      const overId = String(over.id)

      if (overId.startsWith("section-")) {
        const targetSectionId = Number(overId.slice(8))
        if (targetSectionId === sectionId) return
        if (section.parent_id === targetSectionId) return
        if (isDescendant(sections, sectionId, targetSectionId)) return
        const sortedIds = sortSectionsAlphabetically(targetSectionId, sectionId)
        moveSection(sectionId, targetSectionId, sortedIds.indexOf(sectionId))
        reorderSections(sortedIds)
        setExpandedSections((prev) => new Set([...prev, targetSectionId]))
        return
      }
    }
  }, [documents, sections, sortedSections, findDocSectionId, moveDocument, moveSection, reorderDocuments, reorderSections])

  const renderSection = (section: DocSection, depth: number) => {
    const expanded = expandedSections.has(section.id)
    const docs = docsBySection.get(section.id) ?? []
    const childSections = sortedSections.filter((s) => s.parent_id === section.id)

    return (
      <div key={section.id}>
        <SortableSectionHeader
          section={section}
          depth={depth}
          expanded={expanded}
          onToggle={() => toggleSection(section.id)}
          renamingId={renamingId}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          onRenameSubmit={handleRenameSubmit}
          setRenamingId={setRenamingId}
          onDeleteSection={(s) => setDeleteTarget({ type: "section", data: s })}
          isDragging={activeId === `section-${section.id}`}
        />
        {expanded && (
          <div>
            {docs.map((doc) => (
              <SortableDoc
                key={doc.id}
                doc={doc}
                depth={depth + 1}
                activeDocId={activeDocument?.id ?? null}
                onSelectDoc={(d) => setActiveDocument(d)}
                renamingId={renamingId}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                onRenameSubmit={handleRenameSubmit}
                setRenamingId={setRenamingId}
                onDeleteDocument={(d) => setDeleteTarget({ type: "document", data: d })}
              />
            ))}
            {childSections.map((cs) => renderSection(cs, depth + 1))}
          </div>
        )}
      </div>
  )
}
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Documents
        </span>
        <button
          className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground"
          onClick={() => openNewSection(null)}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-1">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionBetweenSectionsAndDocs}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={(e) => { setActiveId(null); handleDragEnd(e) }}
        >
          <SortableContext
            items={allSortableIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="min-h-full rounded-md">
              {rootSections.length === 0 && rootDocs.length === 0 && (
                <p className="px-2 py-4 text-xs text-muted-foreground text-center">
                  No documents yet.
                </p>
              )}
              {rootSections.map((s) => renderSection(s, 0))}
              {rootDocs.map((doc) => (
                <SortableDoc
                  key={doc.id}
                  doc={doc}
                  depth={0}
                  activeDocId={activeDocument?.id ?? null}
                  onSelectDoc={(d) => setActiveDocument(d)}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  setRenameValue={setRenameValue}
                  onRenameSubmit={handleRenameSubmit}
                  setRenamingId={setRenamingId}
                  onDeleteDocument={(d) => setDeleteTarget({ type: "document", data: d })}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeId?.startsWith("doc-") ? (() => {
              const docId = Number(activeId.slice(4))
              const doc = documents.find((d) => d.id === docId)
              if (!doc) return null
              return (
                <div className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-sm text-accent-foreground shadow-lg opacity-90 pointer-events-none">
                  <FileText className="size-4 shrink-0" />
                  <span className="truncate">{doc.title}</span>
                </div>
              )
            })() : activeId?.startsWith("section-") ? (() => {
              const sectionId = Number(activeId.slice(8))
              const section = sections.find((s) => s.id === sectionId)
              if (!section) return null
              return (
                <div className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-sm text-accent-foreground shadow-lg opacity-90 pointer-events-none">
                  <FolderOpen className="size-4 shrink-0 text-yellow-500/70" />
                  <span className="truncate">{section.name}</span>
                </div>
              )
            })() : null}
          </DragOverlay>
        </DndContext>
      </div>

      <Dialog open={newSectionOpen} onOpenChange={setNewSectionOpen}>
        <DialogContent>
          <DialogTitle>New Section</DialogTitle>
          <DialogDescription>Enter a name for the section.</DialogDescription>
          <Input
            autoFocus
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateSection()
            }}
            placeholder="Section name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSectionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSection}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogTitle>
            Delete {deleteTarget?.type === "section" ? "section" : "document"}?
          </DialogTitle>
          <DialogDescription>
            {deleteTarget?.type === "section"
              ? `Section "${(deleteTarget.data as DocSection).name}" and all its contents will be permanently deleted.`
              : deleteTarget
                ? `Document "${(deleteTarget.data as Document).title}" will be permanently deleted.`
                : ""}
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteTarget) return
                if (deleteTarget.type === "section") deleteSection(deleteTarget.data.id)
                else deleteDocument(deleteTarget.data.id)
                setDeleteTarget(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
