import { localDecisionsUrl, localModel } from "./local-flight.ts"

const API_URL = "https://generativelanguage.googleapis.com/v1beta/decisions"

export const KEY_STORAGE = "gemini-api-key"

export type Resolution = "low" | "medium" | "high" | "ultra_high"

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mime_type: string; resolution?: Resolution }
  | { type: "audio"; data: string; mime_type: string }
  | { type: "video"; data: string; mime_type: string; resolution?: Exclude<Resolution, "ultra_high"> }

export type Question =
  | { type: "noul"; instructions: string; criteria?: { true_description?: string; false_description?: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] }

export type Answer =
  | { type: "noul"; noul: number; confidence: number }
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: "score"; score: number; probabilities: Record<string, number>; legend?: Record<string, string>; confidence: number }

export type DecisionResponse = {
  answers: Record<string, Answer>
  usage: {
    total_input_tokens: number
    input_tokens_by_modality: { modality: string; tokens: number }[]
    total_output_tokens: number
    total_tokens: number
  }
}

export type DecisionRequest = {
  model: string
  input: string | ContentBlock[]
  questions: Record<string, Question>
}

// Plumb serves one inference at a time, even when the caller discards its result.
let pending = Promise.resolve()

async function requestPlumb(request: DecisionRequest, signal: AbortSignal) {
  const timeout = AbortSignal.timeout(120_000)
  const payload = JSON.stringify({ state: request.input, questions: request.questions })
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted()
    const response = window.spaceshipEditor
      ? await window.spaceshipEditor.request("decisions", payload, timeout)
      : await fetch(localDecisionsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          signal: timeout,
        })
    if (response.ok) {
      const body = await response.json()
      signal.throwIfAborted()
      return body as Pick<DecisionResponse, "answers">
    }
    const error = await response.text()
    if (response.status !== 503 || !error.includes("another decision is running") || attempt >= 2) throw new Error(`Plumb HTTP ${response.status}: ${error}`)
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
  }
}

export async function createDecisions(request: DecisionRequest, signal: AbortSignal) {
  if (localModel) {
    const result = pending.then(() => requestPlumb(request, signal))
    pending = result.then(
      () => {},
      () => {},
    )
    return result
  }

  const apiKey = localStorage.getItem(KEY_STORAGE)?.trim()
  if (!apiKey) throw new Error("save a Gemini API key on the decisions page first")
  const response = await fetch(API_URL, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(request),
  })
  const body = await response.json()

  if (!response.ok)
    throw new Error(`HTTP ${response.status} ${body.error?.code ?? ""} ${body.error?.status ?? ""}: ${body.error?.message ?? JSON.stringify(body)}`)

  return body as DecisionResponse
}
