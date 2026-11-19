import { streamCompletion } from "../llm/cerebras.ts"
import { STORY_OPENINGS } from "../story/openings.ts"
import { STORY_REQUEST } from "../story/prompt.ts"
import { strengthLevelOf, valueOf, type Control } from "./dimension.ts"
import type { Steering, TextSource } from "./text-stream.ts"

export const liveSource: TextSource = {
  expand: (text) => text || STORY_OPENINGS[Math.floor(Math.random() * STORY_OPENINGS.length)],
  complete: completeStory,
}

async function* completeStory(prefix: string, { direction, leads, controls }: Steering, signal: AbortSignal) {
  const blocks = [
    ["已有正文", prefix],
    ["关键词", leads.map(({ before, keyword, after }) => `${before}[${keyword}]${after}`).join("\n")],
    ["旋钮", controls.map(controlLine).join("\n")],
    ["作者的续写方向", direction],
  ]
  const user = blocks
    .filter(([, value]) => value)
    .map(([label, value]) => `【${label}】\n${value}`)
    .join("\n\n")
  yield* streamCompletion({ ...STORY_REQUEST, user, signal })
}

function controlLine(control: Control) {
  return `${control.dimension.name}：${valueOf(control)}（影响${strengthLevelOf(control.strength)}，强度 ${Math.round(control.strength * 100)}%）`
}
