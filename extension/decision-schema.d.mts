import type { DecisionResponse } from "../src/llm/decisions.ts"
export function decisionPrompt(
  input: unknown,
  questions: unknown,
): {
  temperature: number
  max_completion_tokens: number
  stream: boolean
  messages: { role: string; content: string }[]
}
export function validateQuestions(questions: unknown): void
export function decisionAnswers(body: unknown, questions: unknown): Pick<DecisionResponse, "answers">
