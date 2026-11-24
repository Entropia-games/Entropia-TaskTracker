import { $prose } from "@milkdown/kit/utils"
import { Plugin, TextSelection } from "@milkdown/prose/state"

const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
}

const CLOSERS = new Set(Object.values(PAIRS))

export const bracketPairPlugin = $prose(() => {
  return new Plugin({
    props: {
      handleTextInput(view, from, to, text) {
        // Skip-over closing bracket
        if (CLOSERS.has(text) && from === to) {
          const $pos = view.state.doc.resolve(from)
          const next = view.state.doc.textBetween(from, Math.min(from + 1, $pos.end()), "\0")
          if (next === text) {
            const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, from + 1))
            view.dispatch(tr)
            return true
          }
        }

        const close = PAIRS[text]
        if (!close) return false

        // Don't auto-pair inside code marks/blocks in a surprising way is fine; ProseMirror handles marks.
        const { state } = view
        const $from = state.doc.resolve(from)

        // For '[': avoid breaking '[[ ... ]]' wiki-link typing.
        // When user types second '[' and we previously auto-inserted ']', consume that extra ']'.
        if (text === "[") {
          const before = state.doc.textBetween(Math.max($from.start(), from - 1), from, "\0")
          const after = state.doc.textBetween(from, Math.min(to + 1, $from.end()), "\0")
          if (before === "[" && after === "]") {
            const tr = state.tr.replaceWith(from, to + 1, state.schema.text("["))
            tr.setSelection(TextSelection.create(tr.doc, from + 1))
            view.dispatch(tr.scrollIntoView())
            return true
          }
        }

        const tr = state.tr.insertText(text + close, from, to)
        tr.setSelection(TextSelection.create(tr.doc, from + 1))
        view.dispatch(tr.scrollIntoView())
        return true
      },
    },
  })
})
