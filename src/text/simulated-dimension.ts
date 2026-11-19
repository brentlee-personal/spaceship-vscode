import { delay } from "./completion.ts"
import type { Dimension, DimensionSource } from "./dimension.ts"

const MENU_SIZE = 5
const LATENCY_MS = 150

const DIMENSIONS: Dimension[] = [
  { name: "tension", kind: "scale", low: "calm", high: "tense" },
  { name: "turn", kind: "choice", options: ["reveal", "withhold", "reverse"] },
  { name: "pace", kind: "scale", low: "slow", high: "brisk" },
  { name: "presentation", kind: "choice", options: ["action", "dialogue", "thoughts"] },
  { name: "mood", kind: "scale", low: "dark", high: "light" },
  { name: "narrative distance", kind: "scale", low: "close", high: "distant" },
]

export const simulatedDimension: DimensionSource = async function* ({ taken }, signal) {
  await delay(LATENCY_MS, signal)
  const takenNames = new Set(taken.map(({ name }) => name))
  const free = DIMENSIONS.filter(({ name }) => !takenNames.has(name))
  yield* (free.length ? free : DIMENSIONS).slice(0, MENU_SIZE)
}
