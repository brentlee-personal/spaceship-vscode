import { createDecisions, type Question } from "../llm/decisions.ts"
import type { Focus, InfluenceSource } from "./influence.ts"

const MODEL = "gemini-decision-1"

const QUESTIONS: Record<Focus["kind"], { instructions: string; levels: string[] }> = {
  "next sentence": {
    instructions: "影响接下来的句子",
    levels: ["无关联", "弱：仅共享背景或细节", "中：为下一句做铺垫", "强：直接引出下一句"],
  },
  "key phrase": {
    instructions: "与关键词的含义、成因或后果相关",
    levels: ["无关联", "弱：仅共享背景或细节", "中：涉及关键词指代的事物", "强：直接描述该事物，或与它有因果关系"],
  },
}

export const liveInfluence: InfluenceSource = async function* (sentences, focus, signal) {
  const { instructions, levels } = QUESTIONS[focus.kind]
  const input = `已有句子\n${sentences.map((sentence, i) => `[${i + 1}] ${sentence}`).join("\n")}\n\n${focus.kind === "next sentence" ? "接下来的句子" : "关键词"}\n${focus.text}`
  const questions = Object.fromEntries(
    sentences.map((_, i): [string, Question] => [keyOf(i), { type: "score", instructions: `第 ${i + 1} 句在多大程度上${instructions}？`, criteria: levels }]),
  )
  const { answers } = await createDecisions({ model: MODEL, input, questions }, signal)

  for (const index of sentences.keys()) {
    const answer = answers[keyOf(index)]
    if (answer?.type === "score") yield { index, strength: answer.score / (levels.length - 1) }
  }
}

function keyOf(index: number) {
  return `s${index + 1}`
}
