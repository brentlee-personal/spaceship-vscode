import { localDecisionsUrl, localModel } from "./local-flight.ts"
import { streamCompletion } from "./cerebras.ts"
import { decisionAnswers, decisionPrompt } from "../../extension/decision-schema.mjs"

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
  | { type: "noul"; noul: number; confidence?: number }
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence?: number }
  | { type: "score"; score: number; probabilities: Record<string, number>; legend?: Record<string, string>; confidence?: number }

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

/** Local editor routing is configured in the extension host; no sidecar is required. */
export async function createDecisions(request: DecisionRequest, signal: AbortSignal): Promise<Pick<DecisionResponse, "answers">> {
  signal.throwIfAborted()
  if (window.spaceshipEditor) {
    const response = await window.spaceshipEditor.request(
      "decisions",
      JSON.stringify({ state: request.input, questions: request.questions }),
      AbortSignal.any([signal, AbortSignal.timeout(21_000)]),
    )
    if (!response.ok) throw new Error(`Decision request failed (HTTP ${response.status}).`)
    const result = decisionAnswers(await response.json(), request.questions)
    signal.throwIfAborted()
    return result
  }
  // Preserve explicitly selected browser providers, but never require another API key.
  const apiKey = !localModel && localStorage.getItem(KEY_STORAGE)?.trim()
  const usePlumb = localModel && import.meta.env.VITE_DECISION_PROVIDER === "plumb"
  if (apiKey || usePlumb) {
    try {
      const response = await fetch(usePlumb ? localDecisionsUrl : API_URL, {
        method: "POST",
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        headers: usePlumb ? { "Content-Type": "application/json" } : { "Content-Type": "application/json", "x-goog-api-key": apiKey as string },
        body: JSON.stringify(usePlumb ? { state: request.input, questions: request.questions } : request),
      })
      if (!response.ok) throw new Error("Decision service unavailable.")
      const result = decisionAnswers(await response.json(), request.questions)
      signal.throwIfAborted()
      return result
    } catch {
      signal.throwIfAborted()
    }
  }
  const prompt = decisionPrompt(request.input, request.questions)
  let text = ""
  for await (const delta of streamCompletion({
    system: prompt.messages[0].content,
    user: prompt.messages[1].content,
    temperature: 0,
    maxCompletionTokens: prompt.max_completion_tokens,
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  }))
    text += delta
  signal.throwIfAborted()
  return decisionAnswers(text, request.questions)
}
