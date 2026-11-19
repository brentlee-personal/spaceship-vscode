import test from "node:test"
import assert from "node:assert/strict"
import { createGenerationFailure } from "../src/text/generation-failure.ts"
import { createTextStream } from "../src/text/text-stream.ts"

const steering = { direction: "continue", leads: [], controls: [] }
test("failed requests pause until explicit reset, with safe actionable feedback", () => {
  for (const [error, expected] of [
    [new Error("401 SECRET manuscript"), /API key/],
    [new Error("403 forbidden"), /permissions/],
    [new Error("429 quota"), /Wait/],
    [new Error("fetch failed"), /gateway/],
    [new Error("TimeoutError"), /timed out/],
    [undefined, /no continuation/],
  ]) {
    const failure = createGenerationFailure()
    const message = failure.fail(error)
    assert.equal(failure.paused, true)
    assert.match(message, expected)
    assert.doesNotMatch(message, /SECRET|manuscript/)
    failure.reset()
    assert.equal(failure.paused, false)
  }
})
test("failure preserves original and partial text; paused refill does not re-request; explicit retry works", async () => {
  let calls = 0
  const failure = createGenerationFailure()
  const stream = createTextStream(
    {
      async *complete() {
        calls++
        if (calls === 1) {
          yield " partial"
          throw new Error("401 invalid key")
        }
        yield " recovered"
      },
    },
    () => {},
  )
  stream.replace("Original 原文")
  async function refill() {
    if (failure.paused) return
    try {
      await stream.generate("buffer low", steering)
    } catch (error) {
      failure.fail(error)
    }
  }
  await refill()
  assert.equal(stream.text, "Original 原文 partial")
  assert.equal(stream.activity().isGenerating, false)
  for (let i = 0; i < 20; i++) await refill()
  assert.equal(calls, 1)
  failure.reset()
  await refill()
  assert.equal(stream.text, "Original 原文 partial recovered")
  assert.equal(calls, 2)
})
test("intentional cancellation is not a failed request", async () => {
  const stream = createTextStream(
    {
      async *complete(_text, _steering, signal) {
        await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }))
        throw new Error("aborted")
      },
    },
    () => {},
  )
  stream.replace("Draft")
  const pending = stream.generate("steering changed", steering)
  stream.replace("New draft")
  assert.equal(await pending, "aborted")
  assert.equal(stream.text, "New draft")
})
