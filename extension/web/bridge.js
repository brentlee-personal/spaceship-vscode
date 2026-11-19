;(() => {
  const api = acquireVsCodeApi()
  const jobs = new Map()
  let initialize
  const ready = new Promise((resolve) => {
    initialize = resolve
  })
  const listeners = new Set()

  window.addEventListener("message", ({ data }) => {
    if (!data || typeof data !== "object") return
    if (data.type === "init") return initialize(data)
    if (data.type === "editor") {
      for (const listener of listeners) listener(data)
      return
    }
    const job = jobs.get(data.id)
    if (!job) return
    if (data.type === "headers") {
      const stream = new ReadableStream({
        start(controller) {
          job.stream = controller
        },
      })
      job.resolve(new Response(stream, { status: data.status }))
    } else if (data.type === "chunk") job.stream.enqueue(new TextEncoder().encode(data.text))
    else if (data.type === "end") {
      job.stream.close()
      job.finish()
    } else if (data.type === "error") job.fail(new Error(data.message))
  })

  window.spaceshipEditor = {
    ready,
    model: document.querySelector('meta[name="spaceship-model"]').content,
    onEditor(listener) {
      listeners.add(listener)
    },
    post(message) {
      api.postMessage(message)
    },
    request(route, body, signal) {
      signal.throwIfAborted()
      const id = crypto.randomUUID()
      return new Promise((resolve, reject) => {
        const abort = () => {
          api.postMessage({ type: "abort", id })
          job.fail(new DOMException("请求已取消", "AbortError"))
        }
        const job = {
          resolve,
          finish() {
            signal.removeEventListener("abort", abort)
            jobs.delete(id)
          },
          fail(error) {
            job.finish()
            if (job.stream) job.stream.error(error)
            else reject(error)
          },
        }
        jobs.set(id, job)
        signal.addEventListener("abort", abort, { once: true })
        api.postMessage({ type: "model", id, route, body })
      })
    },
  }
  document.addEventListener("click", (event) => {
    const a = event.target.closest?.("a[href]")
    if (!a) return
    event.preventDefault()
    api.postMessage({ type: "navigate", href: a.getAttribute("href") })
  })
  api.postMessage({ type: "ready" })
})()
