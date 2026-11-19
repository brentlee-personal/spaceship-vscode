import { createDecisions, type Question } from "../llm/decisions.ts"
import type { RelevanceSource } from "./keyword-relevance.ts"

const MODEL = "gemini-decision-1"
const LEVELS = ["无关", "弱：只在背景或细节上有关", "中：与当前句的主题有关", "强：它是当前句的主题或关键"]

export const liveRelevance: RelevanceSource = async function* ({ story, tip, leads }, signal) {
  const input = [
    ...(story ? [`前文\n${story}`] : []),
    `当前句\n${tip}`,
    `关键词\n${leads.map(({ before, keyword, after }, i) => `[${i + 1}] ${keyword} （出自“${before}${keyword}${after}”）`).join("\n")}`,
  ].join("\n\n")
  const questions = Object.fromEntries(
    leads.map((lead, i): [string, Question] => [
      keyOf(i),
      { type: "score", instructions: `关键词 [${i + 1}]“${lead.keyword}”与当前句有多大关联？`, criteria: LEVELS },
    ]),
  )
  const { answers } = await createDecisions({ model: MODEL, input, questions }, signal)

  for (const index of leads.keys()) {
    const answer = answers[keyOf(index)]
    if (answer?.type === "score") yield { index, relevance: answer.score / (LEVELS.length - 1) }
  }
}

function keyOf(index: number) {
  return `k${index + 1}`
}
