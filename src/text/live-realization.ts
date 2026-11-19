import { createDecisions, type Question } from "../llm/decisions.ts"
import type { RealizationSource } from "./realization.ts"

const MODEL = "gemini-decision-1"

export const liveRealization: RealizationSource = async function* ({ context, sentences, asked, control }, signal) {
  const input = [
    ...(context ? [`前文\n${context}`] : []),
    `待评句子\n${sentences.map((sentence, i) => `[${i + 1}] ${sentence}`).join("\n")}`,
    `写作要求\n${control}`,
  ].join("\n\n")
  const questions = Object.fromEntries(asked.map((index) => [keyOf(index), questionAbout(index)]))
  const { answers } = await createDecisions({ model: MODEL, input, questions }, signal)

  for (const index of asked) {
    const answer = answers[keyOf(index)]
    if (answer?.type === "noul") yield { index, confidence: answer.noul }
  }
}

function keyOf(index: number) {
  return `s${index + 1}`
}

function questionAbout(index: number): Question {
  return {
    type: "noul",
    instructions: `第 ${index + 1} 句体现了写作要求吗？`,
    criteria: {
      true_description: "该句清晰体现了写作要求。",
      false_description: "该句没有体现这个要求，或表现相反。",
    },
  }
}
