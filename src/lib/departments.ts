export const DEPARTMENT_COLORS: Record<string, string> = {
  "3D": "text-red-400",
  Concept: "text-blue-400",
  DEV: "text-purple-400",
  QA: "text-white/80",
  GD: "text-yellow-400",
  Sound: "text-orange-400",
  LD: "text-green-400",
  CM: "text-pink-400",
}

/**
 * Accepts a single department or a list and normalizes them:
 * splits combined values like "DEV, QA", trims whitespace, drops empties
 * and removes duplicates case-insensitively.
 */
export function normalizeDepartments(value: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of raw) {
    for (const part of item.split(/[,;|]+/)) {
      const dept = part.trim()
      if (!dept) continue
      const key = dept.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      result.push(dept)
    }
  }
  return result
}

export function departmentColor(department: string): string {
  const key = department.trim().toLowerCase()
  for (const [name, color] of Object.entries(DEPARTMENT_COLORS)) {
    if (name.toLowerCase() === key) return color
  }
  return "text-muted-foreground"
}
