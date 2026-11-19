const characters = new Intl.Segmenter("zh-CN", { granularity: "grapheme" })

/** Count visible characters so a Chinese sentence can be scrubbed without spaces. */
export function countCharacters(text: string) {
  let count = 0
  for (const { segment } of characters.segment(text)) if (segment.trim()) count++
  return count
}

/** Preserve whitespace inside the original prefix and never split a grapheme. */
export function firstCharacters(text: string, count: number) {
  if (count <= 0) return ""
  for (const { segment, index } of characters.segment(text)) {
    if (segment.trim() && --count === 0) return text.slice(0, index + segment.length)
  }
  return text
}
