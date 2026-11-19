type Source<A extends unknown[], T> = (...args: [...A, AbortSignal]) => AsyncIterable<T>

/** Writing preempts optional analysis; analyses share one slot and never delay writing. */
export function createGenerationCoordinator() {
  const writers = new Set<object>()
  let analysis: AbortController | undefined
  const changed = new Set<() => void>()
  const notify = () => {
    for (const wake of changed) wake()
    changed.clear()
  }

  function foreground<A extends unknown[], T>(source: Source<A, T>): Source<A, T> {
    return async function* (...args) {
      const writer = {}
      writers.add(writer)
      analysis?.abort()
      try {
        yield* source(...args)
      } finally {
        writers.delete(writer)
        notify()
      }
    }
  }

  function background<A extends unknown[], T>(source: Source<A, T>): Source<A, T> {
    return async function* (...args) {
      const signal = args.at(-1) as AbortSignal
      while (writers.size || analysis) {
        signal.throwIfAborted()
        await new Promise<void>((resolve) => {
          const wake = () => {
            changed.delete(wake)
            signal.removeEventListener("abort", wake)
            resolve()
          }
          changed.add(wake)
          signal.addEventListener("abort", wake, { once: true })
        })
      }
      signal.throwIfAborted()
      const controller = new AbortController()
      analysis = controller
      const combined = AbortSignal.any([signal, controller.signal])
      const input = [...args.slice(0, -1), combined] as [...A, AbortSignal]
      try {
        for await (const result of source(...input)) {
          if (combined.aborted) return
          yield result
        }
      } catch (error) {
        if (!controller.signal.aborted) throw error
      } finally {
        if (analysis === controller) analysis = undefined
        notify()
      }
    }
  }
  return { foreground, background }
}
