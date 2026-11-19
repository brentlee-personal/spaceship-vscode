import type { Dimension, DimensionContext, DimensionSource } from "./dimension.ts"

export function bindDimensionSuggestions(
  dialog: HTMLDialogElement,
  source: DimensionSource,
  context: () => DimensionContext,
  select: (dimension: Dimension) => void,
) {
  const ask = dialog.querySelector<HTMLButtonElement>("#suggest-dimensions")!
  const list = dialog.querySelector<HTMLElement>("#dimension-suggestions")!
  let pending: AbortController | undefined

  function clear() {
    pending?.abort()
    pending = undefined
    list.replaceChildren()
    ask.disabled = false
  }

  function updateSelected(names: Set<string>) {
    for (const button of list.querySelectorAll("button")) button.disabled = names.has(button.value)
  }

  ask.addEventListener("click", async () => {
    clear()
    const input = context()
    if (!input.text && !input.direction) {
      list.textContent = "Enter text or a direction before requesting suggestions."
      return
    }
    const controller = (pending = new AbortController())
    ask.disabled = true
    list.textContent = "Finding suggestions…"
    try {
      const items = await Array.fromAsync(source(input, controller.signal))
      if (controller.signal.aborted) return
      list.textContent = items.length ? "Click to add" : "No more suggestions right now."
      for (const dimension of items) {
        const button = document.createElement("button")
        button.type = "button"
        button.textContent = button.value = dimension.name
        button.addEventListener("click", () => select(dimension))
        list.append(button)
      }
      updateSelected(new Set(context().taken.map((item) => item.name)))
    } catch {
      if (!controller.signal.aborted) list.textContent = "Suggestions unavailable. Retry or add a dimension manually."
    } finally {
      if (pending === controller) {
        pending = undefined
        ask.disabled = false
      }
    }
  })
  dialog.addEventListener("close", clear)
  return { clear, updateSelected }
}
