import { valueOf, type Dimension, type DimensionContext, type DimensionSource } from "./dimension.ts"

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
      let offered = 0
      for await (const dimension of source(input, controller.signal)) {
        if (controller.signal.aborted) return
        if (offered++ === 0) list.textContent = "Click to add a direction"
        const button = document.createElement("button")
        button.type = "button"
        button.value = dimension.name
        const position = dimension.suggestedPosition
        button.textContent = position === undefined ? dimension.name : `${dimension.name} → ${valueOf({ dimension, position })}`
        button.addEventListener("click", () => select(dimension))
        list.append(button)
        updateSelected(new Set(context().taken.map((item) => item.name)))
      }
      if (!controller.signal.aborted && !offered) list.textContent = "No more suggestions right now."
    } catch {
      if (!controller.signal.aborted && !list.querySelector("button")) list.textContent = "Suggestions unavailable. Retry or add a dimension manually."
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
