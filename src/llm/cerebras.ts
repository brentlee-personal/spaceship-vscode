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

  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`)
  if (!response.body) throw new Error("no response body")

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
        if (!data || data === "[DONE]") continue
        const content = JSON.parse(data).choices?.[0]?.delta?.content
        if (content) yield content as string
      }
    }
  } finally {
    requestController.abort()
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
