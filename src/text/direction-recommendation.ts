import type { Lead } from "./attention.ts"
import type { Dimension, DimensionContext } from "./dimension.ts"

export function groundedLeads(text: string, leads: Lead[]) {
  const seen = new Set<string>()
  return leads
    .filter(({ before, keyword, after }) => {
      if (!keyword.trim() || seen.has(keyword) || !text.includes(before + keyword + after)) return false
      seen.add(keyword)
      return true
    })
    .slice(0, 3)
}

export function recommendationPrompt({ text, leads, direction }: DimensionContext, dimensions: Dimension[], size: number) {
  const excerpt = Array.from(text).slice(-3000).join("")
  const keyPhrases = groundedLeads(text, leads).map(({ before, keyword, after }) => `${before}[${keyword}]${after}`)
  return JSON.stringify({
    recentManuscript: excerpt,
    authorDirection: direction?.trim(),
    keyPhrases,
    candidates: dimensions.map((axis) => ({
      name: axis.name,
      targets: axis.kind === "scale" ? [axis.low, axis.high] : axis.options.length ? axis.options : ["<character names>", "narrator"],
    })),
    count: size,
  })
}

export function suggestedDimension(line: string, dimensions: Dimension[], manuscript: string): Dimension | undefined {
  const parts = line.split("=>")
  if (parts.length !== 2) return
  const [name, ...details] = parts[0].split(":")
  const target = parts[1].trim()
  const axis = dimensions.find((item) => item.name === name.trim().toLowerCase())
  if (!axis || !target) return
  const same = (value: string) => value.toLowerCase() === target.toLowerCase()
  if (axis.kind === "scale") {
    if (details.length) return
    if (same(axis.low)) return { ...axis, suggestedPosition: 0 }
    if (same(axis.high)) return { ...axis, suggestedPosition: 1 }
    return
  }
  let options = axis.options
  if (!options.length) {
    const names = [
      ...new Set(
        details
          .join(":")
          .split("|")
          .map((item) => item.trim()),
      ),
    ].filter((item) => item && item !== "narrator" && Array.from(item).length <= 36 && manuscript.includes(item))
    if (!names.length) return
    options = [...names.slice(0, 3), "narrator"]
  } else if (details.length) return
  const index = options.findIndex(same)
  if (index >= 0) return { ...axis, options, suggestedPosition: (index + 0.5) / options.length }
}
