"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react"
import { Crepe } from "@milkdown/crepe"
import "@milkdown/crepe/theme/common/style.css"
import "@milkdown/crepe/theme/frame-dark.css"
import { Trash2 } from "lucide-react"
import { useDocs } from "@/lib/docs-context"
import { uploadFiles } from "@/lib/uploadthing"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { wikiLinkNode, wikiLinkRemark, wikiLinkInputRule } from "./wiki-link-plugin"
import { WikiLinkAutocomplete } from "./wiki-link-autocomplete"
import { cn } from "@/lib/utils"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProseView = any

function EditorInner() {
  const { activeDocument, updateDocument, deleteDocument, documents } = useDocs()
  const [localTitle, setLocalTitle] = useState("")
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [editorFocused, setEditorFocused] = useState(false)
  const [autocomplete, setAutocomplete] = useState<{
    active: boolean
    query: string
    position: { top: number; left: number }
    triggerFrom: number
  }>({ active: false, query: "", position: { top: 0, left: 0 }, triggerFrom: 0 })

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const crepeRef = useRef<Crepe | null>(null)

  const getView = useCallback((): ProseView => {
    const crepe = crepeRef.current
    if (!crepe) return null
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return (crepe.editor as unknown as { view: ProseView }).view
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (activeDocument) {
      setLocalTitle(activeDocument.title)
    } else {
      setLocalTitle("")
    }
    setEditorFocused(false)
  }, [activeDocument?.id])

  const debouncedSave = useCallback(
    (id: number, changes: Record<string, unknown>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        updateDocument(id, changes)
      }, 800)
    },
    [updateDocument],
  )

  const handleTitleChange = (value: string) => {
    setLocalTitle(value)
    if (activeDocument) debouncedSave(activeDocument.id, { title: value })
  }

  const handleTitleBlur = () => {
    if (activeDocument && localTitle.trim()) {
      updateDocument(activeDocument.id, { title: localTitle.trim() })
    }
  }

  const handleDelete = () => {
    if (activeDocument) deleteDocument(activeDocument.id)
    setDeleteConfirmOpen(false)
  }

  const handleAutocompleteSelect = useCallback(
    (title: string) => {
      const view = getView()
      if (!view) return
      const { state } = view
      const cursorPos = state.selection.$from.pos
      const from = autocomplete.triggerFrom
      const linkNode = state.schema.nodes.wiki_link
      if (linkNode) {
        const node = linkNode.create({ id: title, label: title })
        view.dispatch(state.tr.delete(from, cursorPos).insert(from, node))
      }
      setAutocomplete((prev) => ({ ...prev, active: false }))
    },
    [getView, autocomplete.triggerFrom],
  )

  const handleAutocompleteClose = useCallback(() => {
    setAutocomplete((prev) => ({ ...prev, active: false }))
  }, [])

  const { loading } = useEditor(
    (root) => {
      const crepe = new Crepe({
        root,
        defaultValue: activeDocument?.content || "",
        features: {
          [Crepe.Feature.TopBar]: true,
          [Crepe.Feature.Latex]: false,
        },
        featureConfigs: {
          [Crepe.Feature.Placeholder]: {
            text: "Start writing...",
          },
          [Crepe.Feature.ImageBlock]: {
            onUpload: async (file: File) => {
              const [res] = await uploadFiles("image", { files: [file] })
              return res?.url ?? ""
            },
          },
          [Crepe.Feature.TopBar]: {
            buildTopBar: (builder) => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              const insertGroup = builder.getGroup("insert")
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              insertGroup.group.items = insertGroup.group.items.filter(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                (item: { key: string }) => item.key !== "image",
              )
            },
          },
        },
      })

      crepe.editor.use(wikiLinkNode)
      crepe.editor.use(wikiLinkRemark)
      crepe.editor.use(wikiLinkInputRule)

      crepe.on((listener) => {
        listener.markdownUpdated((_, markdown) => {
          if (activeDocument) {
            debouncedSave(activeDocument.id, { content: markdown })
          }

          try {
            const view = (crepe.editor as unknown as { view: ProseView }).view
            const { state } = view
            const cursorPos = state.selection.$from.pos
            const textBefore = state.doc.textBetween(0, cursorPos)
            const lastOpen = textBefore.lastIndexOf("[[")

            if (lastOpen === -1) {
              setAutocomplete((prev) => (prev.active ? { ...prev, active: false } : prev))
              return
            }

            const afterBracket = textBefore.slice(lastOpen + 2)
            if (afterBracket.includes("]]")) {
              setAutocomplete((prev) => (prev.active ? { ...prev, active: false } : prev))
              return
            }

            const coords = view.coordsAtPos(cursorPos)
            setAutocomplete({
              active: true,
              query: afterBracket,
              position: { top: coords.bottom + 4, left: coords.left },
              triggerFrom: lastOpen,
            })
          } catch {
            setAutocomplete((prev) => (prev.active ? { ...prev, active: false } : prev))
          }
        })
      })

      crepeRef.current = crepe
      return crepe
    },
    [activeDocument?.id],
  )

  if (!activeDocument) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Select a document or create a new one.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col min-h-0 relative">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <input
          className="flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground"
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Untitled"
        />
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div
        className={cn("flex-1 min-h-0 overflow-auto milkdown-editor-wrapper relative", !editorFocused && "editor-blurred")}
        onFocusCapture={() => setEditorFocused(true)}
        onBlurCapture={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setEditorFocused(false)
        }}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-muted-foreground text-sm bg-background/50">
            Loading editor...
          </div>
        )}
        <Milkdown />
      </div>

      {autocomplete.active && (
        <WikiLinkAutocomplete
          query={autocomplete.query}
          position={autocomplete.position}
          documents={documents.map((d) => ({ id: d.id, title: d.title }))}
          onSelect={handleAutocompleteSelect}
          onClose={handleAutocompleteClose}
        />
      )}

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogTitle>Delete document?</DialogTitle>
          <DialogDescription>
            &quot;{activeDocument.title}&quot; will be permanently deleted. This action cannot be undone.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function DocEditor() {
  return (
    <MilkdownProvider>
      <EditorInner />
    </MilkdownProvider>
  )
}
