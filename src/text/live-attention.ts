import { streamCompletion } from "../llm/cerebras.ts"
import type { AttentionBox, AttentionSource } from "./attention.ts"
import { wordSpans } from "./segments.ts"

const MAX_BOXES = 3

const SYSTEM_PROMPT = `从给出的正文里选一至三个会影响下一句的关键短语。每个短语逐字摘自原文，包含二至八个词，每行一个。
用半角方括号标记其中最重要的一个词。例如“她把[车票]攥在手里”。只输出这些短语。`

export const liveAttention: AttentionSource = async function* (text, signal) {
  const textWords = wordsOf(text)
  const yielded = new Set<number>()
  const deltas = streamCompletion({ system: SYSTEM_PROMPT, user: text, temperature: 0.3, maxCompletionTokens: 1000, signal })

  for await (const line of linesOf(deltas)) {
    const box = boxFromLine(line, textWords)
    if (!box || yielded.has(box.keyword)) continue
    yielded.add(box.keyword)
    yield box
    if (yielded.size >= MAX_BOXES) return
  }
}

async function* linesOf(deltas: AsyncIterable<string>) {
  let buffer = ""
  for await (const delta of deltas) {
    const lines = (buffer + delta).split("\n")
    buffer = lines.pop()!
    yield* lines
  }
  yield buffer
}

function boxFromLine(line: string, textWords: string[]): AttentionBox | undefined {
  const open = line.indexOf("[")
  const close = line.indexOf("]", open)
  const hasBrackets = open !== -1 && close !== -1
  const phrase = wordsOf(line.replace(/[[\]]/g, ""))
  if (!phrase.length) return

  const keywordWords = hasBrackets ? wordsOf(line.slice(open + 1, close)) : []
  const offset = hasBrackets ? wordsOf(line.slice(0, open)).length : phrase.length - 1
  const keyword = hasBrackets ? keywordWords[0] : phrase[offset]

  const at = lastIndexOfSequence(textWords, phrase)
  if (at !== -1 && offset < phrase.length) return { keyword: at + offset, before: offset, after: phrase.length - 1 - offset }

  const keywordAt = hasBrackets && keyword ? textWords.lastIndexOf(keyword) : -1
  if (keywordAt !== -1) return { keyword: keywordAt, before: 0, after: 0 }
}

function lastIndexOfSequence(haystack: string[], needle: string[]) {
  for (let at = haystack.length - needle.length; at >= 0; at--) {
    if (needle.every((word, i) => haystack[at + i] === word)) return at
  }
  return -1
}

function wordsOf(text: string) {
  const normalized = text.replaceAll("’", "'")
  return wordSpans(normalized).map(({ start, end }) => normalized.slice(start, end).toLowerCase())
}
