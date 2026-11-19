import { canMove, canRemove, parentId, checkOutline, exportOutline, move, newStub, revise, normalizeLevel, removeBlock, restoreBlock } from "./outline"
import type { Outline, Stub } from "./outline"
import "./style.css"
declare const acquireVsCodeApi: undefined | (() => { postMessage(message: unknown): void; getState(): Outline | undefined; setState(state: Outline): void })
const host = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined
let outline: Outline = host?.getState() ?? { title: "Working outline", blocks: [] }
const list = document.querySelector<HTMLOListElement>("#outline")!
const title = document.querySelector<HTMLInputElement>("#title")!
const status = document.querySelector<HTMLElement>("#status")!
const results = document.querySelector<HTMLElement>("#findings")!
let checked = false
const removed: { block: Stub; index: number; parent: string | null }[] = []
const undo = document.querySelector<HTMLButtonElement>("#undo-remove")!
undo.onclick = () => {
  const last = removed.at(-1)
  if (!last) return
  const restored = restoreBlock(outline, last.block, last.index, last.parent)
  if (restored === outline) {
    status.textContent =
      "Cannot undo here without changing outline parent relationships. Restore the original parent/order first; the removed block is still retained for undo."
    return
  }
  removed.pop()
  outline = restored
  undo.disabled = !removed.length
  persist()
  render()
}
function persist() {
  host?.setState(outline)
  if (checked) showChecks()
}
function showChecks() {
  checked = true
  results.replaceChildren()
  const findings = checkOutline(outline)
  for (const f of findings) {
    const li = document.createElement("li"),
      button = document.createElement("button")
    button.textContent = `${f.id}: ${f.message}`
    button.onclick = () => {
      const block = document.getElementById(f.id) as HTMLDetailsElement
      block.open = true
      block.querySelector("input")?.focus()
    }
    li.append(button)
    results.append(li)
  }
  status.textContent = !outline.blocks.length
    ? "Add a block to begin. No prose was generated."
    : findings.length
      ? `${findings.length} checks need attention. Select a finding to edit its block.`
      : "Structural checks passed. Review the meaning yourself; no prose was generated. Exporting this outline can finish your session."
}
function render() {
  list.replaceChildren()
  title.value = outline.title
  for (const b of outline.blocks) {
    const li = document.createElement("li"),
      details = document.createElement("details"),
      summary = document.createElement("summary")
    details.id = b.id
    details.open = true
    li.style.marginInlineStart = `${(b.level - 1) * 1.5}rem`
    summary.textContent = `${b.name} · ${b.id}`
    details.append(summary)
    const field = (key: keyof Omit<Stub, "id">, label: string) => {
      const wrapper = document.createElement("label"),
        input = document.createElement("input")
      wrapper.textContent = label
      input.value = Array.isArray(b[key]) ? (b[key] as string[]).join(", ") : String(b[key])
      input.dataset.field = key
      if (key === "level") {
        input.type = "number"
        input.min = "1"
        input.max = "3"
      }
      input.oninput = () => {
        const value =
          key === "level"
            ? normalizeLevel(Number(input.value))
            : Array.isArray(b[key])
              ? [
                  ...new Set(
                    input.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  ),
                ]
              : input.value
        if (key === "level") input.value = String(value)
        outline = revise(outline, b.id, { [key]: value })
        persist()
        const updated = outline.blocks.find((x) => x.id === b.id)!
        summary.textContent = `${updated.name} · ${b.id}`
        li.style.marginInlineStart = `${(updated.level - 1) * 1.5}rem`
        if (key === "level") {
          for (const button of list.querySelectorAll<HTMLButtonElement>("button[data-move]"))
            button.disabled = !canMove(outline, button.dataset.block!, Number(button.dataset.move))
          for (const button of list.querySelectorAll<HTMLButtonElement>("button[data-remove]")) button.disabled = !canRemove(outline, button.dataset.remove!)
        }
      }
      wrapper.append(input)
      details.append(wrapper)
    }
    field("name", "Name")
    field("purpose", "Purpose")
    field("changes", "What changes for the reader")
    field("level", "Outline level (1–3)")
    field("needs", "Needs (named inputs)")
    field("produces", "Produces (named outputs)")
    field("dependsOn", "Dependency block IDs")
    field("conflicts", "Conflicting block IDs")
    for (const [label, delta] of [
      ["Move up", -1],
      ["Move down", 1],
    ] as const) {
      const button = document.createElement("button")
      button.textContent = label
      button.dataset.block = b.id
      button.dataset.move = String(delta)
      button.disabled = !canMove(outline, b.id, delta)
      button.onclick = () => {
        outline = move(outline, b.id, delta)
        persist()
        render()
        document.getElementById(b.id)?.querySelector("input")?.focus()
      }
      details.append(button)
    }
    const remove = document.createElement("button")
    remove.textContent = "Remove block"
    remove.dataset.remove = b.id
    remove.disabled = !canRemove(outline, b.id)
    remove.title = "Blocks with descendants cannot be removed. Remove children first or explicitly revise their levels."
    remove.onclick = () => {
      if (!canRemove(outline, b.id)) return
      removed.push({
        parent: parentId(outline, b.id),
        block: outline.blocks.find((x) => x.id === b.id)!,
        index: outline.blocks.findIndex((x) => x.id === b.id),
      })
      outline = removeBlock(outline, b.id)
      undo.disabled = false
      checked = true
      persist()
      render()
      undo.focus()
    }
    details.append(remove)
    li.append(details)
    list.append(li)
  }
}
title.oninput = () => {
  outline = { ...outline, title: title.value }
  persist()
}
document.querySelector("#add")!.addEventListener("click", () => {
  const b = newStub(`block-${crypto.randomUUID().slice(0, 8)}`)
  outline = { ...outline, blocks: [...outline.blocks, b] }
  persist()
  render()
  document.getElementById(b.id)?.querySelector("input")?.focus()
})
document.querySelector("#check")!.addEventListener("click", showChecks)
document.querySelector("#export")!.addEventListener("click", () => {
  const content = exportOutline(outline)
  if (host) {
    host.postMessage({ type: "exportOutline", content })
    status.textContent = "Opening an unsaved Markdown copy. Use File → Save to keep it; your manuscript is not changed."
  } else {
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "outline.md"
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
})
render()
