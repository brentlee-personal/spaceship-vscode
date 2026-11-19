import { delay } from "./completion.ts"
import type { Dimension, DimensionSource } from "./dimension.ts"

const MENU_SIZE = 5
const LATENCY_MS = 150

const DIMENSIONS: Dimension[] = [
  { name: "紧张感", kind: "scale", low: "平静", high: "紧张" },
  { name: "转折", kind: "choice", options: ["揭晓", "留白", "反转"] },
  { name: "节奏", kind: "scale", low: "舒缓", high: "明快" },
  { name: "表达", kind: "choice", options: ["动作", "对话", "思绪"] },
  { name: "氛围", kind: "scale", low: "阴郁", high: "轻快" },
  { name: "叙述距离", kind: "scale", low: "贴近", high: "疏离" },
]

export const simulatedDimension: DimensionSource = async function* ({ taken }, signal) {
  await delay(LATENCY_MS, signal)
  const takenNames = new Set(taken.map(({ name }) => name))
  const free = DIMENSIONS.filter(({ name }) => !takenNames.has(name))
  yield* (free.length ? free : DIMENSIONS).slice(0, MENU_SIZE)
}
