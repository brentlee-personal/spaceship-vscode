import type { Lead } from "./attention.ts"
import { groundedLeads } from "./direction-recommendation.ts"
import { valueOf, writingDimensions, type Control, type Dimension, type DimensionSource } from "./dimension.ts"

import { bindDimensionSuggestions } from "./dimension-suggestions.ts"

export type Manuscript = { text: string; direction: string; controls: Control[] }

export function bindWritingDialog(
  button: HTMLButtonElement,
  dialog: HTMLDialogElement,
  current: () => Manuscript,
  apply: (draft: Manuscript) => void,
  suggest: DimensionSource,
  leads: () => Lead[] = () => [],
) {
  const text = dialog.querySelector<HTMLTextAreaElement>('[name="manuscript"]')!
  const direction = dialog.querySelector<HTMLTextAreaElement>('[name="direction"]')!
  const rows = dialog.querySelector<HTMLElement>("#knob-rows")!
  const template = dialog.querySelector<HTMLTemplateElement>("#writing-knob-row")!
  const add = dialog.querySelector<HTMLButtonElement>("#add-knob")!
  const dimensions = new Map<string, Dimension>()

  const suggestions = bindDimensionSuggestions(
    dialog,
    suggest,
    () => ({
      text: text.value.trim(),
      direction: direction.value.trim(),
      leads: groundedLeads(text.value.trim(), leads()),
      taken: axes().flatMap((axis) => dimensions.get(axis.value) ?? []),
    }),
    (dimension) => {
      if (axes().some((axis) => axis.value === dimension.name)) return
      dimensions.set(dimension.name, dimension)
      for (const axis of axes()) {
        if (![...axis.options].some((option) => option.value === dimension.name)) axis.add(new Option(dimension.name, dimension.name))
      }
      const empty = axes().find((axis) => !axis.value)
      const axis = empty ?? addRow()
      axis.value = dimension.name
      axis.dispatchEvent(new Event("change"))
      axis.focus()
    },
  )
  text.addEventListener("input", suggestions.clear)
  direction.addEventListener("input", suggestions.clear)

  function axes() {
    return [...rows.querySelectorAll<HTMLSelectElement>('select[name="dimension"]')]
  }

  function updateAvailable() {
    const used = new Set(axes().map((axis) => axis.value))
    for (const axis of axes()) {
      for (const option of axis.options) option.disabled = Boolean(option.value) && option.value !== axis.value && used.has(option.value)
    }
    suggestions.updateSelected(used)
    add.disabled = rows.childElementCount >= dimensions.size
  }

  function addRow(control?: Control) {
    const row = template.content.firstElementChild!.cloneNode(true) as HTMLElement
    const axis = row.querySelector<HTMLSelectElement>('[name="dimension"]')!
    const target = row.querySelector<HTMLSelectElement>('[name="target"]')!
    const strength = row.querySelector<HTMLInputElement>("input")!
    const output = row.querySelector("output")!
    for (const name of dimensions.keys()) axis.add(new Option(name, name))
    axis.value = control?.dimension.name ?? ""
    strength.value = String(Math.round((control?.strength ?? 0.64) * 100))
    output.value = strength.value + "%"
    rows.append(row)

    function setTarget(previous?: number) {
      target.replaceChildren()
      const dimension = dimensions.get(axis.value)
      target.disabled = strength.disabled = !dimension
      if (dimension) {
        const positions = dimension.kind === "scale" ? [0, 0.3, 0.5, 0.7, 1] : dimension.options.map((_, i) => (i + 0.5) / dimension.options.length)
        const position = previous ?? (dimension.kind === "scale" ? 0.5 : positions[0])
        const currentLabel = valueOf({ dimension, position })
        for (const p of positions) {
          const label = valueOf({ dimension, position: p })
          target.add(new Option(label, String(label === currentLabel ? position : p)))
        }
        if (![...target.options].some((option) => option.value === String(position))) target.add(new Option(currentLabel, String(position)))
        target.value = String(position)
      }
      updateAvailable()
    }

    setTarget(control?.position)
    axis.addEventListener("change", () => setTarget(dimensions.get(axis.value)?.suggestedPosition))
    strength.addEventListener("input", () => {
      output.value = strength.value + "%"
    })
    row.querySelector("[data-remove]")!.addEventListener("click", () => {
      row.remove()
      updateAvailable()
      add.focus()
    })
    return axis
  }

  function open(preset?: string) {
    const draft = current()
    text.value = draft.text
    direction.value = draft.direction
    dimensions.clear()
    for (const item of writingDimensions) if (item.kind === "scale" || item.options.length) dimensions.set(item.name, item)
    for (const { dimension } of draft.controls) dimensions.set(dimension.name, dimension)
    const controls = [...draft.controls]
    const dimension = preset && dimensions.get(preset)
    if (dimension && !controls.some((item) => item.dimension.name === preset)) controls.push({ dimension, position: 1, strength: 0.64 })
    rows.replaceChildren()
    for (const control of controls) addRow(control)
    if (!controls.length) addRow()
    dialog.showModal()
    const field = draft.text ? direction : text
    field.focus()
  }

  button.addEventListener("click", () => open())
  add.addEventListener("click", () => addRow().focus())
  dialog.querySelector("form")!.addEventListener("submit", (event) => {
    event.preventDefault()
    const controls: Control[] = []
    for (const row of rows.children) {
      const dimension = dimensions.get(row.querySelector("select")!.value)
      if (!dimension) continue
      controls.push({
        dimension,
        position: Number(row.querySelector<HTMLSelectElement>('[name="target"]')!.value),
        strength: row.querySelector("input")!.valueAsNumber / 100,
      })
    }
    dialog.close()
    apply({ text: text.value.trim(), direction: direction.value.trim(), controls })
  })
  return open
}
