import test from "node:test"
import assert from "node:assert/strict"
import { newStub, revise, move, checkOutline, exportOutline, normalizeLevel, removeBlock, restoreBlock } from "../src/backbone/outline.ts"
const block = (id, patch = {}) => ({ ...newStub(id), name: id, purpose: "Explain", changes: "Reader understands", ...patch })
test("dry run exposes missing prerequisites, conflicts and hierarchy in reading order", () => {
  const outline = {
    title: "Work",
    blocks: [block("b", { needs: ["premise"], dependsOn: ["a"], conflicts: ["a"], level: 2 }), block("a", { produces: ["premise"] })],
  }
  const issues = checkOutline(outline)
  assert.equal(issues.length, 4)
  assert.ok(issues.every((x) => x.id === "b"))
  const fixed = revise(move(outline, "a", -1), "b", { conflicts: [], level: 1 })
  assert.deepEqual(checkOutline(fixed), [])
  assert.equal(fixed.blocks[0], outline.blocks[1])
  assert.equal(outline.blocks[0].conflicts[0], "a")
})
test("one block edit retains all unrelated fields and export is a reusable prose-free outline", () => {
  const outline = { title: "Essay", blocks: [block("a"), block("b")] }
  const fixed = revise(outline, "b", { needs: ["evidence"] })
  assert.equal(fixed.blocks[0], outline.blocks[0])
  assert.equal(fixed.blocks[1].purpose, "Explain")
  const md = exportOutline(fixed)
  assert.match(md, /# Essay/)
  assert.match(md, /## a/)
  assert.match(md, /Missing earlier output/)
  assert.match(md, /not generated prose/)
})
test("duplicate outputs, self dependency and unknown conflicts stay actionable", () => {
  const issues = checkOutline({
    title: "",
    blocks: [block("a", { produces: ["x"] }), block("b", { produces: ["x"], dependsOn: ["b"], conflicts: ["missing"] })],
  })
  assert.equal(issues.length, 3)
  assert.equal(move({ title: "", blocks: [block("a")] }, "a", -1).blocks[0].id, "a")
})

test("fractional levels are diagnosed; empty export does not claim success", () => {
  assert.equal(normalizeLevel(1.5), 1)
  assert.equal(normalizeLevel(Infinity), 1)
  assert.match(checkOutline({ title: "", blocks: [block("a"), block("b", { level: 1.5 })] })[0].message, /hierarchy/)
  assert.match(exportOutline({ title: "", blocks: [] }), /No blocks yet/)
})
test("remove and undo preserve intervening edits and expose dangling references", () => {
  const a = block("a"),
    b = block("b", { dependsOn: ["a"] })
  const removed = removeBlock({ title: "", blocks: [a, b] }, "a")
  assert.match(checkOutline(removed)[0].message, /Dependency a/)
  const edited = revise(removed, "b", { purpose: "Revised" })
  const restored = restoreBlock(edited, a, 0)
  assert.equal(restored.blocks[1].purpose, "Revised")
  assert.deepEqual(checkOutline(restored), [])
})

test("reader knowledge is not protagonist knowledge: discovery repairs only the missing premise", () => {
  const opening = block("opening", { name: "Anonymous witness", produces: ["witness appears"] })
  const clue = block("ring", { name: "Ring clue", needs: ["witness appears"], produces: ["reader knows witness identity"] })
  const confrontation = block("confrontation", { name: "Protagonist confronts witness", needs: ["protagonist knows witness identity"] })
  const draft = { title: "Witness mystery", blocks: [opening, clue, confrontation] }
  const issues = checkOutline(draft)
  assert.equal(issues.length, 1)
  assert.equal(issues[0].id, "confrontation")
  assert.match(issues[0].message, /Missing earlier output: protagonist knows witness identity/)
  const discovery = block("discovery", { name: "Protagonist discovers identity", needs: ["witness appears"], produces: ["protagonist knows witness identity"] })
  const repaired = { ...draft, blocks: [opening, clue, discovery, confrontation] }
  assert.deepEqual(checkOutline(repaired), [])
  assert.equal(repaired.blocks[0], draft.blocks[0])
  assert.equal(repaired.blocks[1], draft.blocks[1])
  assert.equal(repaired.blocks[3], draft.blocks[2])
})
