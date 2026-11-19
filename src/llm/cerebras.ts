import { localChatUrl, localModel } from "./local-flight.ts"

const API_URL = "https://api.cerebras.ai/v1/chat/completions"
const MODEL = "gpt-oss-120b"

export const KEY_STORAGE = "cerebras-api-key"

export type CompletionRequest = {
  system: string
  user: string
  temperature: number
  maxCompletionTokens: number
  signal: AbortSignal
}

export async function* streamCompletion({ system, user, temperature, maxCompletionTokens, signal }: CompletionRequest) {
  const requestController = new AbortController()
  signal = AbortSignal.any([signal, requestController.signal])
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (!localModel) {
    const key = localStorage.getItem(KEY_STORAGE)?.trim()
    if (!key) throw new Error("save an API key first")
    headers.Authorization = `Bearer ${key}`
  }
  const payload = JSON.stringify({
    model: localModel || MODEL,
    stream: true,
    reasoning_effort: "low",
    temperature,
    max_completion_tokens: maxCompletionTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  })
  const response = window.spaceshipEditor
    ? await window.spaceshipEditor.request("chat", payload, signal)
    : await fetch(localModel ? localChatUrl : API_URL, { method: "POST", signal, headers, body: payload })

  if (!response.ok || !response.body) {
    requestController.abort()
    if (response.body) await response.body.cancel().catch(() => {})
    throw new Error(response.ok ? "No response body from the model service." : `${response.status} from the model service.`)
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      buffer += value

      const events = buffer.split("\n")
      buffer = events.pop() ?? ""

      for (const line of events) {
        const data = line.startsWith("data:") ? line.slice(5).trim() : ""
        if (!data) continue
        if (data === "[DONE]") return
        let event
        try {
          event = JSON.parse(data)
        } catch {
          throw new Error("Invalid event from the model service.")
        }
        const content = event?.choices?.[0]?.delta?.content
        if (typeof content === "string" && content) yield content
      }
    }
  } finally {
    requestController.abort()
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
