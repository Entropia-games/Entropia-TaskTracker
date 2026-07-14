"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSpring, animated } from "@react-spring/web"
import { useDrag } from "@use-gesture/react"
import { useBoard } from "@/lib/board/use-board"
import type { Card, Me, Point } from "@/lib/board/types"

const CARD_COLORS = ["#fde68a", "#bfdbfe", "#bbf7d0", "#fbcfe8", "#ddd6fe", "#fed7aa"]
const PEN_COLORS = ["#111827", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"]

export function Whiteboard({ boardId, me }: { boardId: string; me: Me }) {
  const {
    strokes,
    liveStrokes,
    cards,
    cursors,
    ready,
    pushStrokePoint,
    endStroke,
    addCard,
    moveCard,
    commitCardMove,
    updateCard,
    deleteCard,
    sendCursor,
    clearBoard,
  } = useBoard(boardId, me)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef<{ id: string; color: string; size: number } | null>(null)
  const lastCursorSent = useRef(0)

  const [penColor, setPenColor] = useState(me.color)
  const penSize = 4

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
    if (e.button !== 0) return
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

  const addCardNow = () => {
    const cont = containerRef.current
    if (!cont) return
    const c: Card = {
      id: crypto.randomUUID(),
      x: cont.clientWidth / 2 - 110,
      y: cont.clientHeight / 2 - 70,
      w: 220,
      h: 140,
      text: "",
      color: CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)],
      author: me.id,
    }
    addCard(c)
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
          onClick={addCardNow}
          className="rounded bg-neutral-700 px-3 py-1 text-neutral-100 hover:bg-neutral-600"
        >
          + Card
        </button>
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
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMoveCanvas}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />

        {cards.map((card) => (
          <BoardCard
            key={card.id}
            card={card}
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
      </div>
    </div>
  )
}

function BoardCard({
  card,
  onMove,
  onCommit,
  onUpdate,
  onDelete,
}: {
  card: Card
  onMove: (id: string, x: number, y: number) => void
  onCommit: (id: string) => void
  onUpdate: (id: string, patch: Partial<Pick<Card, "text" | "color">>) => void
  onDelete: (id: string) => void
}) {
  const dragging = useRef(false)
  const [{ x, y }, api] = useSpring(() => ({ x: card.x, y: card.y }))

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
        value={card.text}
        onPointerDown={stop}
        onChange={(e) => onUpdate(card.id, { text: e.target.value })}
        placeholder="Type…"
        className="h-full min-h-[90px] w-full resize-none rounded-b-lg bg-transparent p-2 text-sm text-neutral-900 outline-none"
      />
    </animated.div>
  )
}
