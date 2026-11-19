import test from "node:test"
import assert from "node:assert/strict"
import {
  newStub,
  revise,
  move,
  canMove,
  canRemove,
  parentId,
  checkOutline,
  exportOutline,
  normalizeLevel,
  removeBlock,
  restoreBlock,
} from "../src/backbone/outline.ts"
const block = (id, patch = {}) => ({ ...newStub(id), name: id, purpose: "Explain", changes: "Reader understands", ...patch })
test("dry run exposes missing prerequisites, conflicts and hierarchy in reading order", () => {
  const outline = {
    title: "Work",
    blocks: [block("b", { needs: ["premise"], dependsOn: ["a"], conflicts: ["a"], level: 2 }), block("a", { produces: ["premise"] })],
  }
  const issues = checkOutline(outline)
  assert.equal(issues.length, 4)
  assert.ok(issues.every((x) => x.id === "b"))
  const fixed = move(revise(outline, "b", { conflicts: [], level: 1 }), "a", -1)
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

test("moving chapter siblings preserves whole subtrees and Markdown hierarchy in both directions", () => {
  const a = block("a", { name: "Chapter A" }),
    sceneA = block("scene-a", { name: "Scene A", level: 2, dependsOn: ["a"] })
  const b = block("b", { name: "Chapter B" }),
    sceneB = block("scene-b", { name: "Scene B", level: 2, dependsOn: ["b"] })
  const original = { title: "Chapters", blocks: [a, sceneA, b, sceneB] }
  const moved = move(original, "b", -1)
  assert.deepEqual(moved.blocks, [b, sceneB, a, sceneA])
  assert.deepEqual(checkOutline(moved), [])
  assert.match(exportOutline(moved), /## Chapter B[\s\S]*### Scene B[\s\S]*## Chapter A[\s\S]*### Scene A/)
  assert.deepEqual(move(moved, "b", 1), original)
  assert.equal(moved.blocks[1], sceneB)
  assert.equal(canMove(original, "scene-a", 1), false)
  assert.equal(move(original, "scene-a", 1), original)
  assert.equal(canMove(original, "a", -1), false)
  assert.equal(canMove(original, "b", 1), false)
})
test("inner sibling subtrees move only within the same parent; invalid nesting is a no-op", () => {
  const outline = {
    title: "",
    blocks: [block("a"), block("s1", { level: 2 }), block("detail", { level: 3 }), block("s2", { level: 2 }), block("b"), block("s3", { level: 2 })],
  }
  const moved = move(outline, "s2", -1)
  assert.deepEqual(
    moved.blocks.map((b) => b.id),
    ["a", "s2", "s1", "detail", "b", "s3"],
  )
  assert.deepEqual(move(moved, "s2", 1), outline)
  assert.equal(canMove(outline, "s2", 1), false)
  assert.equal(canMove(outline, "s3", -1), false)
  const invalid = revise(outline, "s1", { level: 3 })
  assert.equal(canMove(invalid, "b", -1), false)
  assert.equal(move(invalid, "b", -1), invalid)
  assert.equal(move(outline, "b", 2), outline)
})

test("removing a parent is blocked, never silently adopting its child into another chapter", () => {
  const a = block("a"),
    b = block("b"),
    child = block("child", { level: 2, dependsOn: ["b"] })
  const outline = { title: "", blocks: [a, b, child] }
  assert.equal(canRemove(outline, "b"), false)
  assert.equal(removeBlock(outline, "b"), outline)
  assert.deepEqual(checkOutline(outline), [])
  assert.equal(canRemove(outline, "child"), true)
  const removed = removeBlock(outline, "child")
  assert.equal(canRemove(removed, "b"), true)
  assert.deepEqual(restoreBlock(removed, child, 2), outline)
  const explicit = revise(outline, "child", { level: 1 })
  assert.equal(canRemove(explicit, "b"), true)
  assert.match(checkOutline(removeBlock(explicit, "b"))[0].message, /Dependency b/)
})

test("guarded leaf undo does not adopt into another parent after intervening edits", () => {
  const a = block("a"),
    b = block("b"),
    child = block("child", { level: 2 })
  const original = { title: "", blocks: [a, b, child] }
  const parent = parentId(original, "child")
  const leafRemoved = removeBlock(original, "child")
  assert.deepEqual(restoreBlock(leafRemoved, child, 2, parent), original)
  const parentRemoved = removeBlock(leafRemoved, "b")
  assert.equal(restoreBlock(parentRemoved, child, 2, parent), parentRemoved)
})

test("leaf undo cannot capture existing descendants at an obsolete insertion index", () => {
  const a = block("a"),
    removedRoot = block("removed"),
    b = block("b")
  const changed = { title: "", blocks: [a, block("new-child", { level: 2 }), b] }
  assert.equal(restoreBlock(changed, removedRoot, 1, null), changed)
  assert.equal(parentId(changed, "new-child"), "a")
})
