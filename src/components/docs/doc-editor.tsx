"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"

import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react"
import { Crepe } from "@milkdown/crepe"
import { editorViewCtx } from "@milkdown/core"
import "@milkdown/crepe/theme/common/style.css"
import "@milkdown/crepe/theme/frame-dark.css"
import { Trash2 } from "lucide-react"
import { useDocs } from "@/lib/docs-context"
import { uploadFiles } from "@/lib/uploadthing"
import { getImageName, setImageName } from "@/lib/image-name-cache"
import { compressImage } from "@/lib/compress-image"
import { renameFile, slugify } from "@/lib/upload-rename"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { wikiLinkNode, wikiLinkRemark, wikiLinkInputRule } from "./wiki-link-plugin"
import { bracketPairPlugin } from "./bracket-pair-plugin"
import { WikiLinkAutocomplete } from "./wiki-link-autocomplete"

function checkAutocomplete(view: { state: { doc: { textBetween: (from: number, to: number) => string }; selection: { $from: { pos: number; parentOffset: number; parent: { textContent: string }; start: () => number } } }; coordsAtPos: (pos: number) => { top: number; bottom: number; left: number } }) {
  const { state } = view
  const $from = state.selection.$from
  const parentText = $from.parent.textContent
  const cursorOffset = $from.parentOffset
  const textBefore = parentText.slice(0, cursorOffset)
  const lastOpen = textBefore.lastIndexOf("[[")

  if (lastOpen === -1) return null

  const afterBracket = textBefore.slice(lastOpen + 2)
  if (afterBracket.includes("]]")) return null

  const cursorPos = $from.pos
  const triggerFrom = $from.start() + lastOpen
  const coords = view.coordsAtPos(cursorPos)
  return {
    query: afterBracket,
    position: { top: coords.bottom + 4, left: coords.left },
    triggerFrom,
  }
}

function EditorContent() {
  const { activeDocument, updateDocument, deleteDocument, documents } = useDocs()
  const [localTitle, setLocalTitle] = useState(activeDocument?.title ?? "")
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const router = useRouter()
  const [autocomplete, setAutocomplete] = useState<{
    active: boolean
    query: string
    position: { top: number; left: number }
    triggerFrom: number
  }>({ active: false, query: "", position: { top: 0, left: 0 }, triggerFrom: 0 })

  const titleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const autocompleteRef = useRef(autocomplete)

  // Every mounted EditorContent belongs to exactly one document (see the key in DocEditor).
  // Capture that id once so an async save can never be attributed to a different document.
  const docIdRef = useRef<number | null>(activeDocument?.id ?? null)
  const docTitleRef = useRef(activeDocument?.title ?? "untitled")

  const latestMarkdownRef = useRef<string | null>(null)
  const lastSavedMarkdownRef = useRef<string | null>(null)
  const updateDocumentRef = useRef(updateDocument)
  const skipFlushRef = useRef(false)

  useEffect(() => {
    autocompleteRef.current = autocomplete
  }, [autocomplete])

  useEffect(() => {
    docTitleRef.current = activeDocument?.title ?? "untitled"
  }, [activeDocument?.title])

  useEffect(() => {
    updateDocumentRef.current = updateDocument
  }, [updateDocument])

  const getView = useCallback(() => {
    const crepe = crepeRef.current
    if (!crepe) return null
    try {
      return crepe.editor.action((ctx) => ctx.get(editorViewCtx))
    } catch {
      return null
    }
  }, [])

  const handleTitleChange = (value: string) => {
    setLocalTitle(value)
    const docId = docIdRef.current
    if (docId != null) {
      if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current)
      titleSaveTimerRef.current = setTimeout(() => {
        titleSaveTimerRef.current = null
        updateDocument(docId, { title: value })
      }, 800)
    }
  }

  const handleTitleBlur = () => {
    const docId = docIdRef.current
    const title = localTitle.trim()
    if (docId != null && title) {
      if (titleSaveTimerRef.current) {
        clearTimeout(titleSaveTimerRef.current)
        titleSaveTimerRef.current = null
      }
      updateDocument(docId, { title })
    }
  }

  const handleDelete = () => {
    skipFlushRef.current = true
    const docId = docIdRef.current
    if (docId != null) deleteDocument(docId)
    setDeleteConfirmOpen(false)
  }

  const handleAutocompleteSelect = useCallback(
    (id: number, title: string) => {
      const view = getView()
      if (!view) return
      const { state } = view
      const cursorPos = state.selection.$from.pos
      const from = autocompleteRef.current.triggerFrom
      const linkNode = state.schema.nodes.wiki_link
      if (linkNode) {
        const node = linkNode.create({ id: String(id), label: title })
        view.dispatch(state.tr.delete(from, cursorPos).insert(from, node))
      }
      setAutocomplete((prev) => ({ ...prev, active: false }))
    },
    [getView],
  )

  const handleAutocompleteClose = useCallback(() => {
    setAutocomplete((prev) => ({ ...prev, active: false }))
  }, [])

  useEffect(() => {
    const container = document.querySelector(".milkdown-editor-wrapper")
    if (!container) return

    const isWikiLink = (target: HTMLElement) => target.closest("a.wiki-link") as HTMLAnchorElement | null

    const handlePointerDown = (e: Event) => {
      const link = isWikiLink((e as PointerEvent).target as HTMLElement)
      if (!link) return
      e.preventDefault()
      e.stopPropagation()
    }

    const handleClick = (e: Event) => {
      const me = e as MouseEvent
      const link = isWikiLink(me.target as HTMLElement)
      if (!link) return
      e.preventDefault()
      e.stopPropagation()
      const docId = link.getAttribute("data-doc-id")
      if (!docId) return
      const href = `/docs?doc=${docId}`
      if (me.metaKey || me.ctrlKey) {
        window.open(href, "_blank")
      } else {
        router.push(href, { scroll: false })
      }
    }

    const handleAuxClick = (e: Event) => {
      const me = e as MouseEvent
      if (me.button !== 1) return
      const link = isWikiLink(me.target as HTMLElement)
      if (!link) return
      e.preventDefault()
      e.stopPropagation()
      const docId = link.getAttribute("data-doc-id")
      if (docId) window.open(`/docs?doc=${docId}`, "_blank")
    }

    container.addEventListener("pointerdown", handlePointerDown, true)
    container.addEventListener("click", handleClick, true)
    container.addEventListener("auxclick", handleAuxClick, true)
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown, true)
      container.removeEventListener("click", handleClick, true)
      container.removeEventListener("auxclick", handleAuxClick, true)
    }
  }, [router])

  useEffect(() => {
    const content = activeDocument?.content ?? ""
    if (!content) return
    const urls = [...content.matchAll(/!\[.*?\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1])
    const unknown = urls.filter((u) => /\/f\/[^/?#]+/.test(u) && !getImageName(u))
    if (unknown.length === 0) return
    fetch("/api/image-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: unknown }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const info = data?.info as Record<string, { name: string }> | undefined
        if (!info) return
        for (const [url, file] of Object.entries(info)) setImageName(url, file.name)
      })
      .catch(() => {})
  }, [activeDocument?.content, activeDocument?.id])

  useEffect(() => {
    const container = document.querySelector(".milkdown-editor-wrapper")
    if (!container) return

    let tooltip: HTMLDivElement | null = null
    let activeSrc = ""
    const sizeCache = new Map<string, string>()
    const pendingNames = new Set<string>()

    const ensureTooltip = () => {
      if (tooltip) return tooltip
      tooltip = document.createElement("div")
      tooltip.className = "image-info-tooltip"
      tooltip.style.cssText = "position:fixed;z-index:9999;padding:4px 8px;border-radius:4px;background:#1a1a1a;color:#ddd;font-size:11px;pointer-events:none;white-space:nowrap;opacity:0;transition:opacity .15s;box-shadow:0 2px 8px rgba(0,0,0,.4)"
      document.body.appendChild(tooltip)
      return tooltip
    }

    const resolveName = (img: HTMLImageElement, src: string) => {
      const alt = img.getAttribute("alt")?.trim()
      const keyMatch = src.match(/\/f\/([^/?#]+)/)
      const cachedName = getImageName(src)
      const fallback = keyMatch ? keyMatch[1].slice(0, 16) + "..." : src.split("/").pop()?.split("?")[0] || "unknown"
      const hasGoodAlt = !!alt && alt !== "image"
      return { name: cachedName || (hasGoodAlt ? alt! : fallback), needsFetch: !cachedName && !hasGoodAlt && !!keyMatch }
    }

    const renderTooltip = (src: string, name: string) => {
      if (!tooltip || activeSrc !== src) return
      const size = sizeCache.get(src)
      tooltip.textContent = size ? `${name} · ${size}` : `${name} · ...`
    }

    const showTooltip = (img: HTMLImageElement, e: MouseEvent) => {
      const t = ensureTooltip()
      const src = img.src || img.getAttribute("src") || ""
      activeSrc = src
      const { name, needsFetch } = resolveName(img, src)

      renderTooltip(src, name)

      if (!sizeCache.has(src)) {
        fetch(src, { method: "HEAD" })
          .then((r) => {
            const len = r.headers.get("content-length")
            if (len) {
              sizeCache.set(src, `${(parseInt(len) / 1024).toFixed(0)}KB`)
              const current = resolveName(img, src)
              renderTooltip(src, current.name)
            }
          })
          .catch(() => {})
      }

      if (needsFetch && !pendingNames.has(src)) {
        pendingNames.add(src)
        fetch("/api/image-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: [src] }),
        })
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            const info = data?.info?.[src]
            if (info?.name) setImageName(src, info.name)
          })
          .catch(() => {})
          .finally(() => {
            pendingNames.delete(src)
            const current = resolveName(img, src)
            renderTooltip(src, current.name)
          })
      }

      t.style.left = `${e.clientX + 12}px`
      t.style.top = `${e.clientY + 12}px`
      t.style.opacity = "1"
    }

    const hideTooltip = () => {
      if (tooltip) tooltip.style.opacity = "0"
    }

    const onMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const img = target.tagName === "IMG" ? target as HTMLImageElement : target.closest("img") as HTMLImageElement | null
      if (img && container.contains(img)) {
        showTooltip(img, e)
      } else {
        hideTooltip()
      }
    }

    const onMouseLeave = (e: MouseEvent) => {
      if (!container.contains(e.relatedTarget as Node)) hideTooltip()
    }

    container.addEventListener("mousemove", onMouseMove as EventListener)
    container.addEventListener("mouseleave", onMouseLeave as EventListener)
    return () => {
      container.removeEventListener("mousemove", onMouseMove as EventListener)
      container.removeEventListener("mouseleave", onMouseLeave as EventListener)
      if (tooltip) { tooltip.remove(); tooltip = null }
    }
  }, [])

  const { loading } = useEditor(
    (root) => {
      const crepe = new Crepe({
        root,
        defaultValue: activeDocument?.content || "",
        features: {
          [Crepe.Feature.TopBar]: false,
          [Crepe.Feature.Latex]: false,
          [Crepe.Feature.ImageBlock]: true,
        },
        featureConfigs: {
          [Crepe.Feature.Placeholder]: {
            text: "Start writing...",
          },
          [Crepe.Feature.ImageBlock]: {
            onUpload: async (file: File) => {
              const compressed = await compressImage(file)
              const ext = file.name.split(".").pop() ?? "png"
              const docTitle = docTitleRef.current
              const renamed = renameFile(compressed, `doc_image_${slugify(docTitle)}.${ext}`)
              const [res] = await uploadFiles("image", { files: [renamed] })
              if (res?.url) setImageName(res.url, res.name || renamed.name)
              return res?.url ?? ""
            },
          },
        },
      })

      crepe.editor.use(wikiLinkNode)
      crepe.editor.use(wikiLinkRemark)
      crepe.editor.use(wikiLinkInputRule)
      crepe.editor.use(bracketPairPlugin)

      crepe.on((listener) => {
        listener
          .markdownUpdated((_ctx, markdown) => {
            const docId = docIdRef.current
            if (docId == null) return
            latestMarkdownRef.current = markdown
            if (contentSaveTimerRef.current) clearTimeout(contentSaveTimerRef.current)
            contentSaveTimerRef.current = setTimeout(() => {
              contentSaveTimerRef.current = null
              lastSavedMarkdownRef.current = markdown
              updateDocument(docId, { content: markdown })
            }, 800)

            try {
              const view = crepe.editor.action((c) => c.get(editorViewCtx))
              const result = checkAutocomplete(view)
              if (result) {
                setAutocomplete({
                  active: true,
                  query: result.query,
                  position: result.position,
                  triggerFrom: result.triggerFrom,
                })
              } else {
                setAutocomplete((prev) => (prev.active ? { ...prev, active: false } : prev))
              }
            } catch {
              // ignore
            }
          })
          .selectionUpdated((_ctx, _selection) => {
            try {
              const view = crepe.editor.action((c) => c.get(editorViewCtx))
              const result = checkAutocomplete(view)
              if (result) {
                setAutocomplete({
                  active: true,
                  query: result.query,
                  position: result.position,
                  triggerFrom: result.triggerFrom,
                })
              } else {
                setAutocomplete((prev) => (prev.active ? { ...prev, active: false } : prev))
              }
            } catch {
              setAutocomplete((prev) => (prev.active ? { ...prev, active: false } : prev))
            }
          })
      })

      crepeRef.current = crepe
      return crepe
    },
    [],
  )

  // Persist anything that is still waiting in a debounce when the document is closed/switched.
  // The editor instance is keyed by document id, so this flush can only ever target its own doc.
  useEffect(() => {
    const docId = docIdRef.current
    return () => {
      if (titleSaveTimerRef.current) {
        clearTimeout(titleSaveTimerRef.current)
        titleSaveTimerRef.current = null
      }
      if (contentSaveTimerRef.current) {
        clearTimeout(contentSaveTimerRef.current)
        contentSaveTimerRef.current = null
      }
      if (docId == null || skipFlushRef.current) return

      let markdown = latestMarkdownRef.current
      try {
        const fresh = crepeRef.current?.getMarkdown()
        if (typeof fresh === "string") markdown = fresh
      } catch {
        // editor already destroyed - fall back to the last markdown we saw
      }
      if (markdown != null && markdown !== lastSavedMarkdownRef.current) {
        lastSavedMarkdownRef.current = markdown
        updateDocumentRef.current(docId, { content: markdown })
      }
    }
  }, [])

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
        className="flex-1 min-h-0 overflow-auto milkdown-editor-wrapper relative"
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
            &quot;{activeDocument?.title}&quot; will be permanently deleted. This action cannot be undone.
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
  const { activeDocument } = useDocs()

  if (!activeDocument) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Select a document or create a new one.
      </div>
    )
  }

  return (
    <MilkdownProvider>
      <EditorContent key={activeDocument.id} />
    </MilkdownProvider>
  )
}
