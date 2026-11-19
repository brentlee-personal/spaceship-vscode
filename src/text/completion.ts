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
  "The wind rang the bell at the end of the porch. ",
  "She paused to listen to the footsteps upstairs. ",
  "Steam still rose from the cup on the table. ",
  "Only a row of bicycles remained by the river. ",
  "He drew a circle on the paper. ",
  "A short whistle sounded in the distance. ",
]

export const simulatedSource: TextSource = { complete }

async function* complete(_prefix: string, steering: Steering, signal: AbortSignal) {
  const words = steeredWordsOf(steering)
  if (steering.direction) yield `She noted the direction: “${steering.direction}”. `
  for (let sent = 0; sent < WORDS_PER_COMPLETION; sent += WORDS_PER_CHUNK) {
    await delay(sent === 0 ? LATENCY_MS : CHUNK_INTERVAL_MS, signal)
    const lead = Math.random() < STEERED_SHARE && pick(words)?.()
    yield lead ? `She thought again about ${lead}. ` : pick(SENTENCES)!
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
