"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSpring, animated } from "@react-spring/web"
import { useDrag } from "@use-gesture/react"
import { uploadFiles } from "@/lib/uploadthing"
import { useBoard } from "@/lib/board/use-board"
import type { Card, ImageItem, Me, Point } from "@/lib/board/types"

const CARD_COLORS = ["#fde68a", "#bfdbfe", "#bbf7d0", "#fbcfe8", "#ddd6fe", "#fed7aa"]
const PEN_COLORS = [
  "#111827",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
]

async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (file.type === "image/gif") return file
  if (file.size <= 200 * 1024) return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", quality))
  if (!blob) return file
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
  return new File([blob], name, { type: "image/jpeg" })
}

async function uploadImage(file: File): Promise<{ url: string; key: string }> {
  const toUpload = file.type === "image/gif" ? file : await compressImage(file)
  const res = await uploadFiles("image", { files: [toUpload] })
  const uploaded = res[0]
  if (!uploaded?.url) throw new Error("upload failed")
  return { url: uploaded.url, key: uploaded.key ?? "" }
}

export function Whiteboard({ boardId, me }: { boardId: string; me: Me }) {
  const {
    strokes,
    liveStrokes,
    cards,
    images,
    cursors,
    ready,
    pushStrokePoint,
    endStroke,
    addCard,
    moveCard,
    commitCardMove,
    updateCard,
    deleteCard,
    addImageCard,
    moveImage,
    commitImageMove,
    updateImage,
    deleteImage,
    sendCursor,
    clearBoard,
  } = useBoard(boardId, me)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef<{ id: string; color: string; size: number } | null>(null)
  const lastCursorSent = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [penColor, setPenColor] = useState(me.color)
  const [menu, setMenu] = useState<Point | null>(null)
  const [stickerMode, setStickerMode] = useState(false)
  const [stickerColor, setStickerColor] = useState(CARD_COLORS[0])
  const [focusId, setFocusId] = useState<string | null>(null)
  const penSize = 4

  const makeImageItem = (src: string, key: string, x: number, y: number): ImageItem => ({
    id: crypto.randomUUID(),
    x: x - 120,
    y: y - 90,
    w: 240,
    h: 180,
    src,
    key,
    author: me.id,
  })

  const center = (): Point => ({
    x: (containerRef.current?.clientWidth ?? 0) / 2,
    y: (containerRef.current?.clientHeight ?? 0) / 2,
  })

  const addFiles = useCallback(
    async (files: File[], at: Point) => {
      for (const f of files) {
        if (!f.type.startsWith("image/")) continue
        try {
          const { url, key } = await uploadImage(f)
          addImageCard(makeImageItem(url, key, at.x, at.y))
        } catch (err) {
          console.error("[board] image upload failed:", err)
        }
      }
    },
    [addImageCard],
  )

  const addFromClipboard = useCallback(
    async (at: Point) => {
      setMenu(null)
      try {
        const items = await navigator.clipboard.read()
        let added = false
        for (const item of items) {
          const type = item.types.find((t) => t.startsWith("image/"))
          if (!type) continue
          const blob = await item.getType(type)
          const file = new File([blob], `clipboard-${Date.now()}.png`, { type })
          const { url, key } = await uploadImage(file)
          addImageCard(makeImageItem(url, key, at.x, at.y))
          added = true
        }
        if (!added) console.warn("[board] no image found in clipboard")
      } catch (err) {
        console.error("[board] clipboard read failed:", err)
      }
    },
    [addImageCard],
  )

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ""
    await addFiles(files, menu ?? center())
    setMenu(null)
  }

  const handleDeleteImage = useCallback(
    async (item: ImageItem) => {
      if (item.key) {
        try {
          await fetch("/api/uploadthing/delete", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ key: item.key }),
          })
        } catch (err) {
          console.error("[board] image delete failed:", err)
        }
      }
      deleteImage(item.id)
    },
    [deleteImage],
  )

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const at = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    await addFiles(Array.from(e.dataTransfer.files), at)
  }

  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault()
  }

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const onPaste = useCallback(
    async (files: File[]) => {
      if (!files.length) return
      await addFiles(files, menu ?? center())
    },
    [addFiles, menu],
  )

  useEffect(() => {
    const onWinPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"))
      if (!files.length) return
      e.preventDefault()
      onPaste(files)
    }
    window.addEventListener("paste", onWinPaste)
    return () => window.removeEventListener("paste", onWinPaste)
  }, [onPaste])

  const redraw = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = cv.width / dpr
    const h = cv.height / dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const all = [...strokes, ...Object.values(liveStrokes)]
    for (const s of all) {
      if (s.points.length === 0) continue
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.size
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      const p0 = s.points[0]
      ctx.moveTo(p0.x, p0.y)
      if (s.points.length === 1) {
        ctx.lineTo(p0.x + 0.1, p0.y + 0.1)
      } else {
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y)
      }
      ctx.stroke()
    }
  }, [strokes, liveStrokes])

  useEffect(() => {
    redraw()
  }, [redraw])

  useEffect(() => {
    const cv = canvasRef.current
    const cont = containerRef.current
    if (!cv || !cont) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      cv.width = cont.clientWidth * dpr
      cv.height = cont.clientHeight * dpr
      cv.style.width = `${cont.clientWidth}px`
      cv.style.height = `${cont.clientHeight}px`
      redraw()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(cont)
    resize()
    return () => ro.disconnect()
  }, [redraw])

  const getPoint = (e: React.PointerEvent): Point => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || stickerMode) return
    const id = crypto.randomUUID()
    drawingRef.current = { id, color: penColor, size: penSize }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pushStrokePoint(id, getPoint(e), penColor, penSize)
  }

  const onPointerMoveCanvas = (e: React.PointerEvent) => {
    if (!drawingRef.current) return
    pushStrokePoint(drawingRef.current.id, getPoint(e), drawingRef.current.color, drawingRef.current.size)
  }

  const onPointerUp = () => {
    const d = drawingRef.current
    if (!d) return
    drawingRef.current = null
    endStroke(d.id)
  }

  const onContainerMove = (e: React.PointerEvent) => {
    const now = performance.now()
    if (now - lastCursorSent.current < 40) return
    lastCursorSent.current = now
    sendCursor(getPoint(e))
  }

  const addStickerAt = (x: number, y: number) => {
    const c: Card = {
      id: crypto.randomUUID(),
      x: x - 110,
      y: y - 70,
      w: 220,
      h: 140,
      text: "",
      color: stickerColor,
      author: me.id,
    }
    addCard(c)
    setFocusId(c.id)
  }

  const onCanvasClick = (e: React.MouseEvent) => {
    if (!stickerMode) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    addStickerAt(e.clientX - rect.left, e.clientY - rect.top)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-neutral-800 bg-neutral-900/80 px-4 py-2 text-sm">
        <span className="font-medium text-neutral-200">Desk</span>
        <div className="flex items-center gap-1">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setPenColor(c)}
              className={`h-5 w-5 rounded-full border-2 ${
                penColor === c ? "border-white" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              aria-label={`pen ${c}`}
            />
          ))}
        </div>
        <button
          onClick={() => setStickerMode((v) => !v)}
          className={`rounded px-3 py-1 ${
            stickerMode
              ? "bg-yellow-500 text-black hover:bg-yellow-400"
              : "bg-neutral-700 text-neutral-100 hover:bg-neutral-600"
          }`}
        >
          Sticker
        </button>
        {stickerMode && (
          <div className="flex items-center gap-1">
            {CARD_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setStickerColor(c)}
                className={`h-5 w-5 rounded-full border-2 ${
                  stickerColor === c ? "border-white" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`sticker ${c}`}
              />
            ))}
          </div>
        )}
        <button
          onClick={clearBoard}
          className="rounded bg-red-900/60 px-3 py-1 text-red-100 hover:bg-red-800/60"
        >
          Clear
        </button>
        <span className="ml-auto text-neutral-500">
          {ready ? "live" : "connecting…"} · {Object.keys(cursors).length + 1} online
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-neutral-950"
        onPointerMove={onContainerMove}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onContextMenu={onContextMenu}
      >
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 touch-none ${stickerMode ? "cursor-copy" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMoveCanvas}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={onCanvasClick}
        />

        {images.map((img) => (
          <BoardImage
            key={img.id}
            item={img}
            onMove={moveImage}
            onCommit={commitImageMove}
            onUpdate={updateImage}
            onDelete={handleDeleteImage}
          />
        ))}

        {cards.map((card) => (
          <BoardCard
            key={card.id}
            card={card}
            focusId={focusId}
            onMove={moveCard}
            onCommit={commitCardMove}
            onUpdate={updateCard}
            onDelete={deleteCard}
          />
        ))}

        {Object.values(cursors)
          .filter((c) => c.userId !== me.id && c.cursor)
          .map((c) => (
            <div
              key={c.userId}
              className="pointer-events-none absolute z-50 flex flex-col items-start"
              style={{ left: c.cursor!.x, top: c.cursor!.y, transform: "translate(-2px, -2px)" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 2L15 8L9 9.5L6.5 15L2 2Z" fill={c.color} stroke="white" strokeWidth="1" />
              </svg>
              <span
                className="mt-0.5 inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium text-white shadow"
                style={{ backgroundColor: c.color }}
              >
                {c.name}
              </span>
            </div>
          ))}

        {menu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu(null)
              }}
            />
            <div
              className="absolute z-50 min-w-44 rounded-lg border border-neutral-700 bg-neutral-900 p-1 text-sm text-neutral-100 shadow-xl"
              style={{ left: menu.x, top: menu.y }}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-neutral-800"
              >
                Добавить фото с диска
              </button>
              <button
                onClick={() => addFromClipboard(menu)}
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-neutral-800"
              >
                Добавить фото из буфера
              </button>
            </div>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFilePicked}
      />
    </div>
  )
}

function BoardImage({
  item,
  onMove,
  onCommit,
  onUpdate,
  onDelete,
}: {
  item: ImageItem
  onMove: (id: string, x: number, y: number) => void
  onCommit: (id: string) => void
  onUpdate: (id: string, patch: Partial<Pick<ImageItem, "w" | "h">>) => void
  onDelete: (item: ImageItem) => void
}) {
  const dragging = useRef(false)
  const resizing = useRef(false)
  const [{ x, y, width, height }, api] = useSpring(() => ({
    x: item.x,
    y: item.y,
    width: item.w,
    height: item.h,
  }))

  useEffect(() => {
    if (!dragging.current) api.start({ x: item.x, y: item.y })
  }, [item.x, item.y, api])

  useEffect(() => {
    if (!resizing.current) api.start({ width: item.w, height: item.h })
  }, [item.w, item.h, api])

  const bindMove = useDrag(
    ({ offset: [ox, oy], first, last }) => {
      if (first) dragging.current = true
      api.start({ x: ox, y: oy, immediate: true })
      onMove(item.id, ox, oy)
      if (last) {
        dragging.current = false
        onCommit(item.id)
      }
    },
    { from: () => [item.x, item.y] },
  )

  const bindResize = useDrag(
    ({ event, offset: [ow, oh], first, last }) => {
      event.stopPropagation()
      if (first) resizing.current = true
      const w = Math.max(40, ow)
      const h = Math.max(40, oh)
      api.start({ width: w, height: h, immediate: true })
      onUpdate(item.id, { w, h })
      if (last) {
        resizing.current = false
        onCommit(item.id)
      }
    },
    { from: () => [item.w, item.h] },
  )

  const stop = (e: React.PointerEvent) => e.stopPropagation()

  return (
    <animated.div
      {...bindMove()}
      style={{
        position: "absolute",
        x,
        y,
        width,
        height,
        touchAction: "none",
      }}
      className="z-10 group/img overflow-hidden rounded-lg shadow-lg ring-1 ring-black/20"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.src}
        alt=""
        draggable={false}
        className="h-full w-full touch-none select-none object-cover"
      />
      <button
        onPointerDown={stop}
        onClick={() => onDelete(item)}
        className="absolute right-1 top-1 rounded bg-black/50 px-1 text-xs text-white opacity-0 group-hover/img:opacity-100"
      >
        ✕
      </button>
      <div
        {...bindResize()}
        className="absolute bottom-1 right-1 h-3.5 w-3.5 cursor-se-resize rounded-sm bg-white/70 opacity-0 group-hover/img:opacity-100"
      />
    </animated.div>
  )
}

function BoardCard({
  card,
  focusId,
  onMove,
  onCommit,
  onUpdate,
  onDelete,
}: {
  card: Card
  focusId?: string | null
  onMove: (id: string, x: number, y: number) => void
  onCommit: (id: string) => void
  onUpdate: (id: string, patch: Partial<Pick<Card, "text" | "color">>) => void
  onDelete: (id: string) => void
}) {
  const dragging = useRef(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [{ x, y }, api] = useSpring(() => ({ x: card.x, y: card.y }))

  useEffect(() => {
    if (focusId && focusId === card.id) taRef.current?.focus()
  }, [focusId, card.id])

  useEffect(() => {
    if (!dragging.current) api.start({ x: card.x, y: card.y })
  }, [card.x, card.y, api])

  const bind = useDrag(
    ({ offset: [ox, oy], first, last }) => {
      if (first) dragging.current = true
      api.start({ x: ox, y: oy, immediate: true })
      onMove(card.id, ox, oy)
      if (last) {
        dragging.current = false
        onCommit(card.id)
      }
    },
    { from: () => [card.x, card.y] },
  )

  const stop = (e: React.PointerEvent) => e.stopPropagation()

  return (
    <animated.div
      {...bind()}
      style={{
        position: "absolute",
        x,
        y,
        width: card.w,
        background: card.color,
        touchAction: "none",
      }}
      className="z-10 flex flex-col rounded-lg shadow-lg ring-1 ring-black/20"
    >
      <div className="flex items-center gap-1 rounded-t-lg bg-black/10 px-2 py-1">
        <input
          type="color"
          value={card.color}
          onPointerDown={stop}
          onChange={(e) => onUpdate(card.id, { color: e.target.value })}
          className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <button
          onPointerDown={stop}
          onClick={() => onDelete(card.id)}
          className="ml-auto rounded px-1.5 text-xs text-neutral-700 hover:bg-black/10"
        >
          ✕
        </button>
      </div>
      <textarea
        ref={taRef}
        value={card.text}
        onPointerDown={stop}
        onChange={(e) => onUpdate(card.id, { text: e.target.value })}
        placeholder="Type…"
        className="h-full min-h-[90px] w-full resize-none rounded-b-lg bg-transparent p-2 text-sm text-neutral-900 outline-none"
      />
    </animated.div>
  )
}
