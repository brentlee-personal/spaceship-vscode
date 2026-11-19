import test from "node:test"
import assert from "node:assert/strict"
import { createGenerationCoordinator } from "../src/text/generation-coordinator.ts"
import { createTextStream } from "../src/text/text-stream.ts"
const steering = { direction: "continue", leads: [], controls: [] }
const deferred = () => {
  let resolve
  return { promise: new Promise((r) => (resolve = r)), resolve: () => resolve() }
}
const collect = async (source) => {
  const out = []
  for await (const item of source) out.push(item)
  return out
}

test("slow analysis never gates first text; new writing cancels active analysis and discards stale scores", async () => {
  const coordinator = createGenerationCoordinator(),
    started = deferred(),
    late = deferred()
  let aborted = false
  const scoring = coordinator.background(async function* (signal) {
    signal.addEventListener("abort", () => {
      aborted = true
    })
    started.resolve()
    await late.promise
    yield "stale score"
  })
  const old = collect(scoring(new AbortController().signal))
  await started.promise
  const write = coordinator.foreground(async function* () {
    yield "first text"
  })
  assert.deepEqual(await collect(write(new AbortController().signal)), ["first text"])
  assert.equal(aborted, true)
  late.resolve()
  assert.deepEqual(await old, [])
})

test("background single concurrency, queued aborted work never starts, interactive work bypasses backlog", async () => {
  const coordinator = createGenerationCoordinator(),
    release = deferred(),
    entered = deferred()
  const foreground = collect(
    coordinator.foreground(async function* () {
      entered.resolve()
      await release.promise
      yield "text"
    })(new AbortController().signal),
  )
  await entered.promise
  let calls = 0,
    active = 0,
    peak = 0
  const background = coordinator.background(async function* () {
    calls++
    active++
    peak = Math.max(peak, active)
    await Promise.resolve()
    yield "score"
    active--
  })
  const controller = new AbortController()
  const cancelled = collect(background(controller.signal))
  controller.abort()
  await assert.rejects(cancelled, { name: "AbortError" })
  const pending = [collect(background(new AbortController().signal)), collect(background(new AbortController().signal))]
  assert.equal(calls, 0)
  const recommend = coordinator.foreground(async function* () {
    yield "recommended"
  })
  assert.deepEqual(await collect(recommend(new AbortController().signal)), ["recommended"])
  release.resolve()
  await foreground
  await Promise.all(pending)
  assert.equal(calls, 2)
  assert.equal(peak, 1)
})

test("speculative refill respects character budget and closes upstream generator", async () => {
  let aborted = false,
    closed = false
  const stream = createTextStream(
    {
      async *complete(_prefix, _steering, signal) {
        signal.addEventListener("abort", () => {
          aborted = true
        })
        try {
          yield "abcdef"
          throw new Error("must not read past budget")
        } finally {
          closed = true
        }
      },
    },
    () => {},
  )
  stream.replace("Draft ")
  assert.equal(await stream.generate("buffer low", steering, 3), "done")
  assert.equal(stream.text, "Draft abc")
  assert.equal(aborted, true)
  assert.equal(closed, true)
})

test("replacement rejects delayed old output and exposes only latest first-chunk timing", async () => {
  const oldGate = deferred(),
    started = deferred()
  const stream = createTextStream(
    {
      async *complete(prefix) {
        if (prefix === "old") {
          started.resolve()
          await oldGate.promise
          yield "obsolete"
        } else yield " latest"
      },
    },
    () => {},
  )
  stream.replace("old")
  const old = stream.generate("steering changed", steering)
  await started.promise
  stream.replace("new")
  await stream.generate("steering changed", steering)
  oldGate.resolve()
  assert.equal(await old, "aborted")
  assert.equal(stream.text, "new latest")
  assert.equal(typeof stream.activity().firstChunkMs, "number")
})

test("cancelled keyword capture settles without waiting for an uncooperative source", async () => {
  const { startAttention } = await import("../src/text/attention.ts")
  const gate = deferred()
  const generation = startAttention(async function* () {
    await gate.promise
    yield { keyword: 0, before: 0, after: 0 }
  }, "old")
  const iterator = generation[Symbol.asyncIterator]()
  const pending = iterator.next()
  generation.abort()
  assert.equal((await pending).done, true)
  gate.resolve()
})
