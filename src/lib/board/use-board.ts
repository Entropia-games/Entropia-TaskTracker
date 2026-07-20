"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getSupabase } from "@/lib/supabase"
import type { BoardData, Card, ImageItem, Me, Point, Stroke } from "./types"

type RemoteCursor = {
  userId: string
  name: string
  color: string
  cursor: Point | null
  last: number
}

type DrawPointPayload = {
  id: string
  point: Point
  color: string
  size: number
  author: string
}

const EMPTY: BoardData = { strokes: [], cards: [], images: [] }

export function useBoard(boardId: string, me: Me | null) {
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [images, setImages] = useState<ImageItem[]>([])
  const [liveStrokes, setLiveStrokes] = useState<Record<string, Stroke>>({})
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({})
  const [ready, setReady] = useState(false)

  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSendRef = useRef(0)

  const strokesRef = useRef(strokes)
  const cardsRef = useRef(cards)
  const imagesRef = useRef(images)
  const liveRef = useRef(liveStrokes)
  strokesRef.current = strokes
  cardsRef.current = cards
  imagesRef.current = images
  liveRef.current = liveStrokes

  const send = useCallback((event: string, payload: unknown) => {
    channelRef.current?.send({ type: "broadcast", event, payload } as never)
  }, [])

  const schedulePersist = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      if (!me) return
      getSupabase()
        .from("boards")
        .upsert({
          id: boardId,
          data: { strokes: strokesRef.current, cards: cardsRef.current, images: imagesRef.current },
          updated_at: new Date().toISOString(),
          updated_by: me.id,
        })
        .then(({ error }) => {
          if (error) console.error("[board] persist failed:", error.message)
        })
    }, 700)
  }, [boardId, me])

  useEffect(() => {
    if (!me) return
    const sb = getSupabase()
    let mounted = true

    setReady(false)
    setStrokes([])
    setCards([])
    setImages([])
    setLiveStrokes({})
    setCursors({})

    sb.from("boards")
      .select("data")
      .eq("id", boardId)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return
        const d = (data?.data as BoardData) ?? EMPTY
        setStrokes(d.strokes ?? [])
        setCards(d.cards ?? [])
        setImages(d.images ?? [])
        setReady(true)
      })

    const channel = sb.channel(`board:${boardId}`, {
      config: { presence: { key: me.id }, broadcast: { self: false } },
    })
    channelRef.current = channel

    channel.on("broadcast", { event: "draw:point" }, ({ payload }) => {
      const p = payload as DrawPointPayload
      setLiveStrokes((prev) => {
        const existing = prev[p.id]
        if (existing) {
          return { ...prev, [p.id]: { ...existing, points: [...existing.points, p.point] } }
        }
        return {
          ...prev,
          [p.id]: { id: p.id, points: [p.point], color: p.color, size: p.size, author: p.author },
        }
      })
    })

    channel.on("broadcast", { event: "draw:end" }, ({ payload }) => {
      const s = payload as Stroke
      setLiveStrokes((prev) => {
        const n = { ...prev }
        delete n[s.id]
        return n
      })
      setStrokes((prev) => [...prev, s])
      schedulePersist()
    })

    channel.on("broadcast", { event: "card:add" }, ({ payload }) => {
      const c = payload as Card
      setCards((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]))
      schedulePersist()
    })

    channel.on("broadcast", { event: "card:move" }, ({ payload }) => {
      const { id, x, y } = payload as { id: string; x: number; y: number }
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, x, y } : c)))
      schedulePersist()
    })

    channel.on("broadcast", { event: "card:update" }, ({ payload }) => {
      const { id, text, color } = payload as { id: string; text?: string; color?: string }
      setCards((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c
          const next = { ...c }
          if (text !== undefined) next.text = text
          if (color !== undefined) next.color = color
          return next
        }),
      )
      schedulePersist()
    })

    channel.on("broadcast", { event: "card:delete" }, ({ payload }) => {
      const { id } = payload as { id: string }
      setCards((prev) => prev.filter((c) => c.id !== id))
      schedulePersist()
    })

    channel.on("broadcast", { event: "image:add" }, ({ payload }) => {
      const c = payload as ImageItem
      setImages((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]))
      schedulePersist()
    })

    channel.on("broadcast", { event: "image:move" }, ({ payload }) => {
      const { id, x, y } = payload as { id: string; x: number; y: number }
      setImages((prev) => prev.map((c) => (c.id === id ? { ...c, x, y } : c)))
      schedulePersist()
    })

    channel.on("broadcast", { event: "image:update" }, ({ payload }) => {
      const { id, w, h } = payload as { id: string; w?: number; h?: number }
      setImages((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c
          const next = { ...c }
          if (w !== undefined) next.w = w
          if (h !== undefined) next.h = h
          return next
        }),
      )
      schedulePersist()
    })

    channel.on("broadcast", { event: "image:delete" }, ({ payload }) => {
      const { id } = payload as { id: string }
      setImages((prev) => prev.filter((c) => c.id !== id))
      schedulePersist()
    })

    channel.on("broadcast", { event: "clear" }, () => {
      setStrokes([])
      setLiveStrokes({})
      schedulePersist()
    })

    channel.on("broadcast", { event: "cursor" }, ({ payload }) => {
      const p = payload as { userId: string; name: string; color: string; x: number; y: number }
      setCursors((prev) => ({
        ...prev,
        [p.userId]: { userId: p.userId, name: p.name, color: p.color, cursor: { x: p.x, y: p.y }, last: Date.now() },
      }))
    })

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ userId: string }>()
      const online = new Set<string>()
      Object.values(state).forEach((list) => list.forEach((m) => online.add(m.userId)))
      setCursors((prev) => {
        const n: Record<string, RemoteCursor> = {}
        for (const [k, v] of Object.entries(prev)) if (online.has(k)) n[k] = v
        return n
      })
    })

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId: me.id, name: me.name, color: me.color })
      }
    })

    const prune = setInterval(() => {
      const now = Date.now()
      setCursors((prev) => {
        let changed = false
        const n: Record<string, RemoteCursor> = {}
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.last < 8000) n[k] = v
          else changed = true
        }
        return changed ? n : prev
      })
    }, 3000)

    return () => {
      mounted = false
      clearInterval(prune)
      if (persistTimer.current) clearTimeout(persistTimer.current)
      sb.removeChannel(channel)
      channelRef.current = null
    }
  }, [boardId, me, schedulePersist])

  const pushStrokePoint = useCallback(
    (id: string, point: Point, color: string, size: number) => {
      setLiveStrokes((prev) => {
        const existing = prev[id]
        if (existing) {
          return { ...prev, [id]: { ...existing, points: [...existing.points, point] } }
        }
        return {
          ...prev,
          [id]: { id, points: [point], color, size, author: me?.id ?? "anon" },
        }
      })
      const now = performance.now()
      if (now - lastSendRef.current >= 32) {
        lastSendRef.current = now
        send("draw:point", { id, point, color, size, author: me?.id ?? "anon" })
      }
    },
    [me?.id, send],
  )

  const endStroke = useCallback(
    (id: string) => {
      const s = liveRef.current[id]
      if (!s) return
      setLiveStrokes((prev) => {
        const n = { ...prev }
        delete n[id]
        return n
      })
      setStrokes((prev) => [...prev, s])
      send("draw:end", s)
      schedulePersist()
    },
    [send, schedulePersist],
  )

  const addCard = useCallback(
    (c: Card) => {
      setCards((prev) => [...prev, c])
      send("card:add", c)
      schedulePersist()
    },
    [send, schedulePersist],
  )

  const moveCard = useCallback(
    (id: string, x: number, y: number) => {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, x, y } : c)))
      send("card:move", { id, x, y })
    },
    [send],
  )

  const commitCardMove = useCallback(() => {
    schedulePersist()
  }, [schedulePersist])

  const updateCard = useCallback(
    (id: string, patch: Partial<Pick<Card, "text" | "color">>) => {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      send("card:update", { id, ...patch })
      schedulePersist()
    },
    [send, schedulePersist],
  )

  const deleteCard = useCallback(
    (id: string) => {
      setCards((prev) => prev.filter((c) => c.id !== id))
      send("card:delete", { id })
      schedulePersist()
    },
    [send, schedulePersist],
  )

  const addImageCard = useCallback(
    (c: ImageItem) => {
      setImages((prev) => [...prev, c])
      send("image:add", c)
      schedulePersist()
    },
    [send, schedulePersist],
  )

  const moveImage = useCallback(
    (id: string, x: number, y: number) => {
      setImages((prev) => prev.map((c) => (c.id === id ? { ...c, x, y } : c)))
      send("image:move", { id, x, y })
    },
    [send],
  )

  const commitImageMove = useCallback(() => {
    schedulePersist()
  }, [schedulePersist])

  const updateImage = useCallback(
    (id: string, patch: Partial<Pick<ImageItem, "w" | "h">>) => {
      setImages((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      send("image:update", { id, ...patch })
      schedulePersist()
    },
    [send, schedulePersist],
  )

  const deleteImage = useCallback(
    (id: string) => {
      setImages((prev) => prev.filter((c) => c.id !== id))
      send("image:delete", { id })
      schedulePersist()
    },
    [send, schedulePersist],
  )

  const sendCursor = useCallback(
    (point: Point) => {
      send("cursor", { userId: me?.id, name: me?.name, color: me?.color, x: point.x, y: point.y })
    },
    [me, send],
  )

  const clearBoard = useCallback(() => {
    setStrokes([])
    setLiveStrokes({})
    send("clear", {})
    schedulePersist()
  }, [send, schedulePersist])

  return {
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
  }
}
