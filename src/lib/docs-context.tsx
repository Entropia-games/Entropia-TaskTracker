"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { getSupabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { useIssues } from "@/lib/issues-context"
import type { Database } from "@/lib/database.types"

export type DocSection = Database["public"]["Tables"]["doc_sections"]["Row"]
export type Document = Database["public"]["Tables"]["documents"]["Row"]

type DocsContext = {
  sections: DocSection[]
  documents: Document[]
  activeDocument: Document | null
  setActiveDocument: (doc: Document | null) => void
  createSection: (name: string, parentId?: number | null) => Promise<DocSection | null>
  updateSection: (id: number, changes: Partial<DocSection>) => Promise<void>
  deleteSection: (id: number) => Promise<void>
  createDocument: (sectionId?: number | null, title?: string) => Promise<Document | null>
  updateDocument: (id: number, changes: Partial<Document>) => Promise<void>
  deleteDocument: (id: number) => Promise<void>
  moveSection: (id: number, newParentId: number | null, newPosition: number) => Promise<void>
  moveDocument: (id: number, newSectionId: number | null, newPosition: number) => Promise<void>
  reorderSections: (ids: number[]) => Promise<void>
  reorderDocuments: (ids: number[]) => Promise<void>
  loading: boolean
}

const DocsContext = createContext<DocsContext | null>(null)

export function DocsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { currentProject } = useIssues()
  const [sections, setSections] = useState<DocSection[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [activeDocument, setActiveDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !currentProject) {
      setSections([])
      setDocuments([])
      setActiveDocument(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const sb = getSupabase()
    const projectId = currentProject.id

    Promise.all([
      sb.from("doc_sections").select("*").eq("project_id", projectId).order("position"),
      sb.from("documents").select("*").eq("project_id", projectId).order("position"),
    ]).then(([secRes, docRes]) => {
      if (secRes.data) setSections(secRes.data as DocSection[])
      if (docRes.data) setDocuments(docRes.data as Document[])
    }).catch((e) => {
      console.error("Failed to load docs", e)
    }).finally(() => {
      setLoading(false)
    })
  }, [user, currentProject])

  useEffect(() => {
    if (!user || !currentProject) return
    const sb = getSupabase()
    const projectId = currentProject.id
    const filter = `project_id=eq.${projectId}`

    const upsertBy = <T extends { id: number }>(row: T) => (prev: T[]) => {
      const idx = prev.findIndex((r) => r.id === row.id)
      if (idx === -1) return [...prev, row]
      const next = [...prev]
      next[idx] = row
      return next
    }

    const channel = sb
      .channel(`docs-changes-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "doc_sections", filter },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id: number }).id
            setSections((prev) => prev.filter((s) => s.id !== oldId))
          } else {
            setSections(upsertBy(payload.new as DocSection))
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id: number }).id
            setDocuments((prev) => prev.filter((d) => d.id !== oldId))
            setActiveDocument((prev) => (prev?.id === oldId ? null : prev))
          } else {
            const doc = payload.new as Document
            setDocuments(upsertBy(doc))
            setActiveDocument((prev) => (prev?.id === doc.id ? doc : prev))
          }
        },
      )
      .subscribe()

    return () => {
      sb.removeChannel(channel)
    }
  }, [user, currentProject])

  const createSection = useCallback(async (name: string, parentId?: number | null) => {
    if (!user || !currentProject) return null
    const sb = getSupabase()
    const { data, error } = await sb
      .from("doc_sections")
      .insert({
        project_id: currentProject.id,
        parent_id: parentId ?? null,
        name,
        position: 0,
      })
      .select()
      .single()
    if (error || !data) {
      console.error("Failed to create section", JSON.stringify(error))
      return null
    }
    setSections((prev) => [...prev, data as DocSection])
    return data as DocSection
  }, [user, currentProject])

  const updateSection = useCallback(async (id: number, changes: Partial<DocSection>) => {
    if (!user) return
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)))
    const { error } = await getSupabase().from("doc_sections").update(changes).eq("id", id)
    if (error) console.error("Failed to update section", JSON.stringify(error))
  }, [user])

  const deleteSection = useCallback(async (id: number) => {
    if (!user) return
    const { error } = await getSupabase().from("doc_sections").delete().eq("id", id)
    if (error) {
      console.error("Failed to delete section", JSON.stringify(error))
      return
    }
    setSections((prev) => prev.filter((s) => s.id !== id && s.parent_id !== id))
    setDocuments((prev) => prev.map((d) => (d.section_id === id ? { ...d, section_id: null } : d)))
  }, [user])

  const createDocument = useCallback(async (sectionId?: number | null, title?: string) => {
    if (!user || !currentProject) return null
    const sb = getSupabase()
    const { data, error } = await sb
      .from("documents")
      .insert({
        project_id: currentProject.id,
        section_id: sectionId ?? null,
        title: title ?? "Untitled",
        content: "",
        created_by: user.id,
      })
      .select()
      .single()
    if (error || !data) {
      console.error("Failed to create document", JSON.stringify(error))
      return null
    }
    setDocuments((prev) => [...prev, data as Document])
    setActiveDocument(data as Document)
    return data as Document
  }, [user, currentProject])

  const extractImageUrls = (content: string): string[] => {
    const re = /!\[.*?\]\((.*?)\)/g
    const urls: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) urls.push(m[1])
    return urls
  }

  const deleteImages = (urls: string[]) => {
    if (urls.length === 0) return
    fetch("/api/delete-images", { method: "POST", body: JSON.stringify({ urls }) })
      .catch((e) => console.error("Failed to delete images", e))
  }

  const updateDocument = useCallback(async (id: number, changes: Partial<Document>) => {
    if (!user) return
    if (changes.content !== undefined) {
      const { data: old } = await getSupabase().from("documents").select("content").eq("id", id).single()
      const oldUrls = old?.content ? new Set(extractImageUrls(old.content)) : new Set<string>()
      const newUrls = new Set(extractImageUrls(changes.content))
      const removed = [...oldUrls].filter((u) => !newUrls.has(u))
      deleteImages(removed)
    }
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...changes } : d)))
    setActiveDocument((prev) => (prev?.id === id ? { ...prev, ...changes } as Document : prev))
    const { error } = await getSupabase().from("documents").update(changes).eq("id", id)
    if (error) console.error("Failed to update document", JSON.stringify(error))
  }, [user])

  const deleteDocument = useCallback(async (id: number) => {
    if (!user) return
    const { data: doc } = await getSupabase().from("documents").select("content").eq("id", id).single()
    if (doc?.content) deleteImages(extractImageUrls(doc.content))
    const { error } = await getSupabase().from("documents").delete().eq("id", id)
    if (error) {
      console.error("Failed to delete document", JSON.stringify(error))
      return
    }
    setDocuments((prev) => prev.filter((d) => d.id !== id))
    setActiveDocument((prev) => (prev?.id === id ? null : prev))
  }, [user])

  const moveSection = useCallback(async (id: number, newParentId: number | null, newPosition: number) => {
    if (!user) return
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, parent_id: newParentId, position: newPosition } : s))
    )
    const { error } = await getSupabase()
      .from("doc_sections")
      .update({ parent_id: newParentId, position: newPosition })
      .eq("id", id)
    if (error) console.error("Failed to move section", JSON.stringify(error))
  }, [user])

  const moveDocument = useCallback(async (id: number, newSectionId: number | null, newPosition: number) => {
    if (!user) return
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, section_id: newSectionId, position: newPosition } : d))
    )
    const { error } = await getSupabase()
      .from("documents")
      .update({ section_id: newSectionId, position: newPosition })
      .eq("id", id)
    if (error) console.error("Failed to move document", JSON.stringify(error))
  }, [user])

  const reorderSections = useCallback(async (ids: number[]) => {
    if (!user) return
    setSections((prev) =>
      prev.map((s) => ({ ...s, position: ids.indexOf(s.id) }))
    )
    const sb = getSupabase()
    for (let i = 0; i < ids.length; i++) {
      await sb.from("doc_sections").update({ position: i }).eq("id", ids[i])
    }
  }, [user])

  const reorderDocuments = useCallback(async (ids: number[]) => {
    if (!user) return
    setDocuments((prev) =>
      prev.map((d) => ({ ...d, position: ids.indexOf(d.id) }))
    )
    const sb = getSupabase()
    for (let i = 0; i < ids.length; i++) {
      await sb.from("documents").update({ position: i }).eq("id", ids[i])
    }
  }, [user])

  return (
    <DocsContext.Provider value={{
      sections,
      documents,
      activeDocument,
      setActiveDocument,
      createSection,
      updateSection,
      deleteSection,
      createDocument,
      updateDocument,
      deleteDocument,
      moveSection,
      moveDocument,
      reorderSections,
      reorderDocuments,
      loading,
    }}>
      {children}
    </DocsContext.Provider>
  )
}

export function useDocs() {
  const ctx = useContext(DocsContext)
  if (!ctx) throw new Error("useDocs must be used within DocsProvider")
  return ctx
}
