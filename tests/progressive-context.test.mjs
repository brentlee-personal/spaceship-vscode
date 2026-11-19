import test from "node:test"
import assert from "node:assert/strict"
import { progressiveContext } from "../src/story/progressive-context.ts"

test("short bilingual manuscript is unchanged without duplicate excerpts", () => {
  for (const text of ["", "你好，世界。\nThe door opened. 🚀", "x".repeat(6000)]) {
    const result = progressiveContext(text, { keywords: ["世界"] })
    assert.equal(result.tail, text)
    assert.equal(result.omitted, false)
    assert.deepEqual(result.excerpts, [])
    assert.equal(result.sentCharacters, text.length)
  }
})

test("quoted facts and active keywords retrieve exact older bilingual evidence", () => {
  const text = "档案记载：红色钥匙在林舟手上。\nThe cobalt key belongs to Ada.\n" + "日常记录。\n".repeat(2400) + "现在打开门。"
  const result = progressiveContext(text, { direction: "Use “cobalt key” again", keywords: ["红色钥匙"] })
  assert.ok(result.excerpts.some((e) => e.text.includes("红色钥匙")))
  assert.ok(result.excerpts.some((e) => e.text.includes("cobalt key")))
  assert.ok(result.tail.length <= 6000)
  assert.ok(result.sentCharacters <= 8500)
  assert.ok(result.omitted)
  for (const e of result.excerpts) {
    assert.equal(e.text, text.slice(e.sourceStart, e.sourceEnd))
    assert.equal(e.startLine, text.slice(0, e.sourceStart).split("\n").length)
    assert.equal(e.endLine, text.slice(0, e.sourceEnd - 1).split("\n").length)
  }
})

test("CJK direction uses local word matches without requiring spaces", () => {
  const text = "她记得那座城堡。" + "很久以前。".repeat(2000)
  const result = progressiveContext(text, { direction: "请继续描述城堡" })
  assert.ok(result.excerpts.some((e) => e.text.includes("城堡")))
})

test("long single line is bounded, lossless within exact ranges, and code-point safe", () => {
  const text = "🚀".repeat(12000) + "钥匙" + "🚀".repeat(7000) + "结尾"
  const result = progressiveContext(text, { keywords: ["钥匙"] })
  assert.ok(result.excerpts.length)
  assert.equal(result.tailStartLine, 1)
  assert.equal(result.tailEndLine, 1)
  assert.ok(result.tail.endsWith("结尾"))
  assert.ok(result.tail.length <= 6000)
  assert.ok(result.sentCharacters <= 8500)
  for (const s of [result.tail, ...result.excerpts.map((e) => e.text)]) assert.ok(s.isWellFormed())
  for (const e of result.excerpts) assert.equal(e.text, text.slice(e.sourceStart, e.sourceEnd))
})

test("edits are recomputed from supplied snapshot, never stale cached evidence", () => {
  const original = "secret-key belongs to Ada.\n" + "filler\n".repeat(2000)
  const first = progressiveContext(original, { keywords: ["secret-key"] })
  const revised = original.replace("secret-key", "ordinary item")
  const second = progressiveContext(revised, { keywords: ["secret-key"] })
  assert.ok(first.excerpts.length)
  assert.deepEqual(second.excerpts, [])
  assert.equal(first.excerpts[0].text.includes("secret-key"), true)
})

test("repeated hits have globally bounded nonoverlapping output and exact count", () => {
  const text = ("Ada kept 钥匙.\n" + "x".repeat(500) + "\n").repeat(200)
  const result = progressiveContext(text, { keywords: ["Ada", "钥匙"] })
  assert.ok(result.excerpts.length <= 8)
  assert.ok(result.excerpts.reduce((n, e) => n + e.text.length, 0) <= 2500)
  assert.equal(result.sentCharacters, result.tail.length + result.excerpts.reduce((n, e) => n + e.text.length, 0))
  for (let i = 1; i < result.excerpts.length; i++) assert.ok(result.excerpts[i - 1].sourceEnd <= result.excerpts[i].sourceStart)
})
