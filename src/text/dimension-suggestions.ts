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
      list.textContent = "先填正文或续写方向，再获取推荐。"
      return
    }
    const controller = (pending = new AbortController())
    ask.disabled = true
    list.textContent = "正在推荐…"
    try {
      const items = await Array.fromAsync(source(input, controller.signal))
      if (controller.signal.aborted) return
      list.textContent = items.length ? "点击添加" : "当前没有更多推荐。"
      for (const dimension of items) {
        const button = document.createElement("button")
        button.type = "button"
        button.textContent = button.value = dimension.name
        button.addEventListener("click", () => select(dimension))
        list.append(button)
      }
      updateSelected(new Set(context().taken.map((item) => item.name)))
    } catch {
      if (!controller.signal.aborted) list.textContent = "未能取得推荐，可以重试或手动添加维度。"
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
