import { $node, $remark, $inputRule } from "@milkdown/kit/utils"
import { InputRule } from "@milkdown/prose/inputrules"

export const wikiLinkNode = $node("wiki_link", () => ({
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  attrs: {
    id: { default: "" },
    label: { default: "" },
  },
  parseMarkdown: {
    match: (node: { type: string }) => node.type === "wiki_link",
    runner: (state, node, type) => {
      state.addNode(type, {
        id: (node as unknown as { id: string }).id,
        label: (node as unknown as { label: string }).label || (node as unknown as { id: string }).id,
      })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "wiki_link",
    runner: (state, node) => {
      const id = node.attrs.id as string
      const label = node.attrs.label as string
      const text = label && label !== id ? `[[${id}|${label}]]` : `[[${id}]]`
      state.addNode("text", undefined, text)
    },
  },
  toDOM: (node) => [
    "span",
    {
      class: "wiki-link",
      "data-id": node.attrs.id as string,
    },
    node.attrs.label || node.attrs.id,
  ],
}))

function visitAndReplace(tree: { type: string; children?: unknown[]; value?: string }) {
  if (!tree.children) return
  let i = 0
  while (i < tree.children.length) {
    const node = tree.children[i] as {
      type: string
      value?: string
      children?: unknown[]
      id?: string
      label?: string
    }
    if (node.type === "text" && typeof node.value === "string") {
      const regex = /\[\[([^\]\n]+)\]\]/g
      const matches = [...node.value.matchAll(regex)]
      if (matches.length === 0) {
        i++
        continue
      }
      const nodes: unknown[] = []
      let lastIndex = 0
      for (const match of matches) {
        if (match.index! > lastIndex) {
          nodes.push({ type: "text", value: node.value!.slice(lastIndex, match.index) })
        }
        const content = match[1]
        const pipeIndex = content.indexOf("|")
        const id = pipeIndex >= 0 ? content.slice(0, pipeIndex).trim() : content.trim()
        const label = pipeIndex >= 0 ? content.slice(pipeIndex + 1).trim() : id
        if (id) {
          nodes.push({ type: "wiki_link", id, label })
        } else {
          nodes.push({ type: "text", value: match[0] })
        }
        lastIndex = match.index! + match[0].length
      }
      if (lastIndex < node.value!.length) {
        nodes.push({ type: "text", value: node.value!.slice(lastIndex) })
      }
      tree.children.splice(i, 1, ...nodes)
    } else {
      visitAndReplace(node as { type: string; children?: unknown[] })
      i++
    }
  }
}

export const wikiLinkRemark = $remark("wiki_link_remark", () => () => {
  return (tree: { type: string; children?: unknown[] }) => {
    visitAndReplace(tree)
  }
})

export const wikiLinkInputRule = $inputRule(
  (ctx) =>
    new InputRule(
      /\[\[([^\]\n]+)\]\]$/,
      (state, match, start, end) => {
        const wikiType = state.schema.nodes?.wiki_link
        if (!wikiType) return null

        const content = match[1]
        const pipeIndex = content.indexOf("|")
        const id = pipeIndex >= 0 ? content.slice(0, pipeIndex).trim() : content.trim()
        const label = pipeIndex >= 0 ? content.slice(pipeIndex + 1).trim() : id

        if (!id) return null

        const node = wikiType.create({ id, label })
        return state.tr.replaceWith(start, end, node)
      },
    ),
)
