import type { Lead } from "./attention.ts"

/** An aspect of the upcoming text that a future knob tunes: a two-pole scale, or a choice among options. */
export type Dimension = { name: string } & ({ kind: "scale"; low: string; high: string } | { kind: "choice"; options: string[] })

/** Independent axes of a short passage, most consequential first. `focus` has no generic options: its options are the story's characters. */
export const writingDimensions: Dimension[] = [
  { name: "紧张感", kind: "scale", low: "舒缓", high: "紧张" },
  { name: "悬念", kind: "scale", low: "留下疑问", high: "揭开谜底" },
  { name: "节奏", kind: "scale", low: "简述", high: "细写" },
  { name: "叙述方式", kind: "choice", options: ["对话", "动作", "描写"] },
  { name: "视角人物", kind: "choice", options: [] },
  { name: "语气", kind: "choice", options: ["诙谐", "温柔", "沉郁", "惊奇"] },
  { name: "叙述距离", kind: "scale", low: "外部观察", high: "内心独白" },
  { name: "境遇", kind: "scale", low: "恶化", high: "好转" },
  { name: "意外程度", kind: "scale", low: "顺理成章", high: "出人意料" },
]

/** A dimension with the knob's position across the fan (0 is the low pole or first option, 1 the high pole or last) and its strength of influence, both from 0 to 1. */
export type Control = { dimension: Dimension; position: number; strength: number }

export type DimensionContext = { text: string; direction?: string; leads: Lead[]; taken: Dimension[] }

/** Streams the dimensions offered for `context.text`, most relevant first: each differs from the others and from every one in `context.taken`. Must stop (by throwing or returning) once `signal` aborts. */
export type DimensionSource = (context: DimensionContext, signal: AbortSignal) => AsyncIterable<Dimension>

export type StrengthLevel = "弱" | "中" | "强"

/** The fan is split into `optionCount` equal sectors; returns the one containing `position`. */
export function optionIndexAt(optionCount: number, position: number) {
  return Math.min(optionCount - 1, Math.floor(position * optionCount))
}

/** Index 0–4 of the five grades a scale position is spoken as: very low, somewhat low, midway, somewhat high, very high. */
export function gradeIndexOf(position: number) {
  if (position < 0.2) return 0
  if (position < 0.4) return 1
  if (position <= 0.6) return 2
  if (position <= 0.8) return 3
  return 4
}

/** The control's value in words: a scale's grade, e.g. "very calm", "somewhat tense", "midway between calm and tense"; or a choice's selected option. */
export function valueOf({ dimension, position }: Pick<Control, "dimension" | "position">) {
  if (dimension.kind === "choice") return dimension.options[optionIndexAt(dimension.options.length, position)]
  const { low, high } = dimension
  if (position <= 0) return low
  if (position >= 1) return high
  return ["偏向" + low, "略偏" + low, `${low}与${high}之间`, "略偏" + high, "偏向" + high][gradeIndexOf(position)]
}

/** Thirds of the strength range. */
export function strengthLevelOf(strength: number): StrengthLevel {
  if (strength < 1 / 3) return "弱"
  if (strength < 2 / 3) return "中"
  return "强"
}
