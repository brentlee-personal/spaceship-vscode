export type ContextExcerpt = {
  startLine: number
  endLine: number
  text: string
  sourceStart: number
  sourceEnd: number
}

export type ProgressiveContext = {
  tail: string
  omitted: boolean
  excerpts: ContextExcerpt[]
  tailStartLine: number
  tailEndLine: number
  sentCharacters: number
}

/** Local selection only. Offsets are UTF-16, ranges half-open, lines one-based.
 * The caller owns the immutable manuscript snapshot; no files or network are read.
 */
export function progressiveContext(prefix: string, options: { direction?: string; keywords?: readonly string[] } = {}): ProgressiveContext {
  const tailStart = safeStart(prefix, Math.max(0, prefix.length - 6000))
  const tail = prefix.slice(tailStart)
  const lineStarts = [0]
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] === "\n") lineStarts.push(i + 1)
  }
  const lineAt = (offset: number) => {
    let lo = 0
    let hi = lineStarts.length
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1
      if (lineStarts[mid] <= offset) lo = mid
      else hi = mid
    }
    return lo + 1
  }
  if (tailStart === 0) return { tail, omitted: false, excerpts: [], tailStartLine: 1, tailEndLine: lineAt(prefix.length), sentCharacters: tail.length }
  const direction = (options.direction ?? "").slice(0, 4000)
  const quoted = Array.from(direction.matchAll(/["“「『]([^"”」』\n]{2,120})["”」』]/gu), (m) => m[1])
  const explicit = [...quoted, ...(options.keywords ?? []).slice(0, 24)]
  const tokens = [...new Intl.Segmenter(undefined, { granularity: "word" }).segment(direction)].filter((part) => part.isWordLike).map((part) => part.segment)
  const terms = [...new Set([...explicit, ...tokens].map((s) => s.trim()).filter((s) => s.length >= 2 && s.length <= 120))].slice(0, 32)
  const candidates: { start: number; end: number; score: number }[] = []
  const older = prefix.slice(0, tailStart)
  for (let t = 0; t < terms.length; t++) {
    const term = terms[t]
    let end = older.length
    // Most recent occurrences first; fixed per-term candidate cap bounds repeated names.
    for (let count = 0; count < 4; count++) {
      const hit = older.lastIndexOf(term, end - 1)
      if (hit < 0) break
      candidates.push({
        start: safeStart(prefix, Math.max(0, hit - 160)),
        end: safeEnd(prefix, Math.min(tailStart, hit + term.length + 240)),
        score: explicit.includes(term) ? 2 : 1,
      })
      end = hit
      if (hit === 0) break
    }
  }
  candidates.sort((a, b) => b.score - a.score || b.start - a.start)
  const ranges: { start: number; end: number }[] = []
  let remaining = 2500
  for (const candidate of candidates) {
    if (remaining <= 0 || ranges.length >= 8) break
    // Skip overlapping evidence rather than sending duplicated context.
    if (ranges.some((r) => candidate.start < r.end && candidate.end > r.start)) continue
    if (candidate.end - candidate.start > remaining) continue
    const end = candidate.end
    if (end <= candidate.start) continue
    ranges.push({ start: candidate.start, end })
    remaining -= end - candidate.start
  }
  ranges.sort((a, b) => a.start - b.start)
  const excerpts = ranges.map(({ start, end }) => ({
    startLine: lineAt(start),
    endLine: lineAt(Math.max(start, end - 1)),
    text: prefix.slice(start, end),
    sourceStart: start,
    sourceEnd: end,
  }))
  const sentCharacters = tail.length + excerpts.reduce((sum, item) => sum + item.text.length, 0)
  return { tail, omitted: sentCharacters < prefix.length, excerpts, tailStartLine: lineAt(tailStart), tailEndLine: lineAt(prefix.length), sentCharacters }
}

function safeStart(text: string, offset: number): number {
  return offset > 0 && /[\uDC00-\uDFFF]/.test(text[offset] ?? "") && /[\uD800-\uDBFF]/.test(text[offset - 1]) ? offset + 1 : offset
}

function safeEnd(text: string, offset: number): number {
  return offset > 0 && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset] ?? "") ? offset - 1 : offset
}
