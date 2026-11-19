import { optionIndexAt } from "./dimension.ts"
import type { Steering, TextSource } from "./text-stream.ts"

const LATENCY_MS = 150
const WORDS_PER_SECOND = 800
const WORDS_PER_CHUNK = 8
const WORDS_PER_COMPLETION = 400
/** Share of words drawn from the steering instead of the dictionary, so its effect is visible. */
const STEERED_SHARE = 0.25
const CHUNK_INTERVAL_MS = (WORDS_PER_CHUNK / WORDS_PER_SECOND) * 1000

const SENTENCES = [
  "风把门廊尽头的铃铛吹响了。",
  "她停下脚步，听了听楼上的动静。",
  "桌边的杯子还冒着热气。",
  "河岸上只剩一排自行车。",
  "他用铅笔在纸上画了个圈。",
  "远处传来一声短促的汽笛。",
]

export const simulatedSource: TextSource = { complete }

async function* complete(_prefix: string, steering: Steering, signal: AbortSignal) {
  const words = steeredWordsOf(steering)
  if (steering.direction) yield `她在纸上记下：“${steering.direction}”`
  for (let sent = 0; sent < WORDS_PER_COMPLETION; sent += WORDS_PER_CHUNK) {
    await delay(sent === 0 ? LATENCY_MS : CHUNK_INTERVAL_MS, signal)
    const lead = Math.random() < STEERED_SHARE && pick(words)?.()
    yield lead ? `她又想起了${lead}。` : pick(SENTENCES)!
  }
}

/** One word picker per lead and control: a lead gives its keyword, a control its value words (a scale's high pole as often as its position), as often as its strength. */
function steeredWordsOf({ leads, controls }: Steering): (() => string | undefined)[] {
  return [
    ...leads.map(
      ({ keyword }) =>
        () =>
          keyword,
    ),
    ...controls.map(({ dimension, position, strength }) => () => {
      if (Math.random() >= strength) return
      if (dimension.kind === "choice") return dimension.options[optionIndexAt(dimension.options.length, position)]
      return Math.random() < position ? dimension.high : dimension.low
    }),
  ]
}

function pick<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)]
}

export function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted()
    const timer = setTimeout(resolve, ms)
    signal.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true })
  })
}
