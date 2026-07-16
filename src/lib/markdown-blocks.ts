export type BlockType = "heading" | "paragraph" | "code" | "list" | "blockquote" | "hr"

export interface Block {
  id: number
  type: BlockType
  raw: string
  level?: number
  lang?: string
}

let _nextId = 0

export function parseBlocks(content: string): Block[] {
  _nextId = 0
  const lines = content.split("\n")
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === "") {
      i++
      continue
    }

    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim()
      const codeLines: string[] = [line]
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ id: _nextId++, type: "code", raw: codeLines.join("\n"), lang: lang || undefined })
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      blocks.push({ id: _nextId++, type: "heading", raw: line, level: headingMatch[1].length })
      i++
      continue
    }

    if (/^(---|\*\*\*|___)\s*$/.test(line.trim())) {
      blocks.push({ id: _nextId++, type: "hr", raw: line })
      i++
      continue
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [line]
      i++
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i])
        i++
      }
      blocks.push({ id: _nextId++, type: "blockquote", raw: quoteLines.join("\n") })
      continue
    }

    if (/^\s*([-*+]|\d+\.)\s/.test(line)) {
      const listLines: string[] = [line]
      i++
      while (i < lines.length && lines[i].trim() !== "" && /^\s*([-*+]|\d+\.)\s/.test(lines[i])) {
        listLines.push(lines[i])
        i++
      }
      blocks.push({ id: _nextId++, type: "list", raw: listLines.join("\n") })
      continue
    }

    const paraLines: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !lines[i].trim().startsWith("```") &&
      !/^(---|\*\*\*|___)\s*$/.test(lines[i].trim()) &&
      !lines[i].startsWith(">") &&
      !/^\s*([-*+]|\d+\.)\s/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push({ id: _nextId++, type: "paragraph", raw: paraLines.join("\n") })
  }

  return blocks
}

export function blocksToContent(blocks: Block[]): string {
  return blocks.map((b) => b.raw).join("\n\n")
}

export function createEmptyBlock(type: BlockType = "paragraph"): Block {
  return { id: _nextId++, type, raw: type === "hr" ? "---" : "", ...(type === "hr" ? {} : {}) }
}
