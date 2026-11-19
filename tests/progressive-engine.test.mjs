import test from "node:test"
import assert from "node:assert/strict"
import { createProgressiveEngine } from "../src/progressive/engine.ts"
const block = (id, dependsOn = []) => ({
  id,
  kind: "claim",
  intent: `Explain ${id}`,
  dependsOn,
  constraints: ["No invented facts"],
  contextRefs: ["source@v1:1-4"],
})
const plan = (blocks = [block("a"), block("b", ["a"]), block("c")]) => ({ goal: "Explain tradeoffs", constraints: ["Keep the conclusion qualified"], blocks })
const gate = () => {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}
const tick = () => new Promise((r) => setImmediate(r))

test("confirmation is explicit, revision-checked and deeply immutable", async () => {
  const source = plan()
  const engine = createProgressiveEngine(source)
  source.blocks[0].intent = "mutated"
  await assert.rejects(
    engine.run(async function* () {
      assert.fail("must not generate")
    }),
    /Confirm/,
  )
  assert.throws(() => engine.confirm(0), /changed/)
  const snap = engine.confirm(1)
  assert.equal(snap.plan.blocks[0].intent, "Explain a")
  assert.throws(() => {
    snap.plan.blocks[0].constraints.push("bad")
  }, TypeError)
  engine.edit(plan())
  assert.equal(engine.snapshot().revision, 2)
  await assert.rejects(
    engine.run(async function* () {}),
    /Confirm/,
  )
  assert.throws(() => engine.confirm(1), /changed/)
})

test("bounded parallel fill honors graph order and immutable predecessor outputs", async () => {
  const engine = createProgressiveEngine(plan(), 2)
  engine.confirm(1)
  const held = gate()
  const started = []
  let active = 0,
    maximum = 0
  const running = engine.run(async function* ({ block, dependencies, plan }, signal) {
    active++
    maximum = Math.max(maximum, active)
    started.push(block.id)
    assert.equal(plan.revision, 1)
    assert.equal(signal.aborted, false)
    if (block.id === "a" || block.id === "c") await held.promise
    if (block.id === "b") {
      assert.deepEqual(dependencies, { a: "A" })
      assert.ok(Object.isFrozen(dependencies))
    }
    yield block.id.toUpperCase()
    active--
  })
  await tick()
  assert.deepEqual(started, ["a", "c"])
  held.resolve()
  const result = await running
  assert.deepEqual(started, ["a", "c", "b"])
  assert.equal(maximum, 2)
  assert.ok(Object.values(result.blocks).every((b) => b.status === "done"))
})

test("failure blocks descendants; targeted retry preserves successful independent results", async () => {
  const engine = createProgressiveEngine(plan())
  engine.confirm(1)
  let result = await engine.run(async function* ({ block }) {
    if (block.id === "a") throw Error("private response")
    yield block.id
  })
  assert.equal(result.blocks.a.status, "failed")
  assert.equal(result.blocks.b.status, "blocked")
  assert.equal(result.blocks.c.status, "done")
  assert.equal(JSON.stringify(result).includes("private response"), false)
  engine.retry("a")
  const retried = []
  result = await engine.run(async function* ({ block }) {
    retried.push(block.id)
    yield "new " + block.id
  })
  assert.deepEqual(retried, ["a", "b"])
  assert.equal(result.blocks.c.text, "c")
})

test("editing cancels old revision even when generator ignores its abort signal", async () => {
  const engine = createProgressiveEngine(plan([block("a")]))
  engine.confirm(1)
  const held = gate()
  let oldSignal
  const old = engine.run(async function* (_, signal) {
    oldSignal = signal
    await held.promise
    yield "stale"
  })
  await tick()
  engine.edit(plan([block("new")]))
  assert.equal(oldSignal.aborted, true)
  await old
  engine.confirm(2)
  await engine.run(async function* () {
    yield "fresh"
  })
  held.resolve()
  await tick()
  assert.deepEqual(Object.keys(engine.snapshot().blocks), ["new"])
  assert.equal(engine.snapshot().blocks.new.text, "fresh")
})

test("targeted refinement keeps confirmed constraints and invalidates only descendants", async () => {
  const engine = createProgressiveEngine(plan())
  engine.confirm(1)
  await engine.run(async function* ({ block }) {
    yield block.id
  })
  const calls = []
  const result = await engine.refine("a", async function* (input) {
    calls.push(input.block.id)
    assert.equal(input.mode, "refine")
    assert.equal(input.previous, "a")
    assert.deepEqual(input.plan.constraints, ["Keep the conclusion qualified"])
    yield "a revised"
  })
  assert.deepEqual(calls, ["a"])
  assert.equal(result.revision, 1)
  assert.equal(result.blocks.a.text, "a revised")
  assert.equal(result.blocks.b.status, "blocked")
  assert.equal(result.blocks.b.text, "")
  assert.equal(result.blocks.c.text, "c")
})

test("invalid graphs are rejected; pre-aborted and explicit cancellation launch no stale work", async () => {
  for (const blocks of [[block("a", ["missing"])], [block("a", ["b"]), block("b", ["a"])], [block("a"), block("a")]])
    assert.throws(() => createProgressiveEngine(plan(blocks)))
  const engine = createProgressiveEngine(plan())
  engine.confirm(1)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    engine.run(async function* () {
      assert.fail()
    }, controller.signal),
    { name: "AbortError" },
  )
  const held = gate()
  const running = engine.run(async function* () {
    await held.promise
    yield "discard"
  })
  await tick()
  engine.cancel()
  await running
  assert.equal(engine.snapshot().blocks.a.status, "pending")
  assert.equal(engine.snapshot().blocks.a.text, "")
  held.resolve()
})

test("same-turn cancellation launches no provider and refinement pre-abort preserves results", async () => {
  const engine = createProgressiveEngine(plan())
  engine.confirm(1)
  const running = engine.run(async function* () {
    assert.fail("cancelled before start")
  })
  engine.cancel()
  await running
  await engine.run(async function* ({ block }) {
    yield block.id
  })
  const before = engine.snapshot()
  const c = new AbortController()
  c.abort()
  await assert.rejects(engine.refine("a", async function* () {}, c.signal))
  assert.deepEqual(engine.snapshot(), before)
})
