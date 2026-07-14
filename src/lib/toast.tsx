"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

type Toast = { id: number; message: string }

let listeners: ((toasts: Toast[]) => void)[] = []
let toasts: Toast[] = []
let nextId = 1

export function showToast(message: string) {
  const toast = { id: nextId++, message }
  toasts = [...toasts, toast]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== toast.id)
    emit()
  }, 3500)
}

function emit() {
  for (const l of listeners) l(toasts)
}

export function ToastViewport() {
  const [items, setItems] = useState<Toast[]>(toasts)

  useEffect(() => {
    listeners.push(setItems)
    return () => {
      listeners = listeners.filter((l) => l !== setItems)
    }
  }, [])

  if (typeof document === "undefined") return null

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex flex-col items-end gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto max-w-xs rounded-lg border border-border/40 bg-zinc-900/95 px-4 py-2.5 text-sm text-foreground shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>,
    document.body,
  )
}
