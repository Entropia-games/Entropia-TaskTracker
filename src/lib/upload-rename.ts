export function renameFile(file: File, newName: string): File {
  return new File([file], newName, { type: file.type, lastModified: file.lastModified })
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}
