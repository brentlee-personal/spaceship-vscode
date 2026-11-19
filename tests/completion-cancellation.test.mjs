import test from "node:test"
import assert from "node:assert/strict"
import { registerHooks } from "node:module"
registerHooks({
  load(url, context, next) {
    if (url.endsWith("/src/llm/local-flight.ts"))
      return {
        format: "module",
        shortCircuit: true,
        source: 'export const localModel="mock"; export const localChatUrl="/chat"; export const localDecisionsUrl="/decisions";',
      }
    return next(url, context)
  },
})
let transportSignal,
  cancelled = false
// Same cancellation seam as the VS Code bridge: aborting the supplied signal cancels the host job.
globalThis.window = {
  spaceshipEditor: {
    async request(_route, _payload, signal) {
      transportSignal = signal
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"first"}}]}\n\n'))
          },
          cancel() {
            cancelled = true
          },
        }),
      )
    },
  },
}
const { streamCompletion } = await import("../src/llm/cerebras.ts")
test("consumer early return aborts host request signal and closes response reader", async () => {
  const original = new AbortController()
  for await (const chunk of streamCompletion({ system: "s", user: "u", temperature: 0, maxCompletionTokens: 10, signal: original.signal })) {
    assert.equal(chunk, "first")
    break
  }
  assert.equal(transportSignal.aborted, true)
  assert.equal(cancelled, true)
  assert.equal(original.signal.aborted, false)
})

const params = () => ({ system: "s", user: "u", temperature: 0, maxCompletionTokens: 10, signal: new AbortController().signal })

test("DONE terminates without waiting for the transport to close", async () => {
  let closed = false
  window.spaceshipEditor.request = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"prose"}}]}\n\ndata: [DONE]\n\n'))
        },
        cancel() {
          closed = true
        },
      }),
    )
  assert.deepEqual(await Array.fromAsync(streamCompletion(params())), ["prose"])
  assert.equal(closed, true)
})

test("HTTP and bad event errors omit provider data", async () => {
  const marker = "private manuscript fragment"
  let closed = false
  window.spaceshipEditor.request = async (_, __, signal) =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(marker))
        },
        cancel() {
          closed = signal.aborted
        },
      }),
      { status: 401 },
    )
  await assert.rejects(
    () => Array.fromAsync(streamCompletion(params())),
    (error) => /^401\b/.test(error.message) && !error.message.includes(marker),
  )
  assert.equal(closed, true)
  window.spaceshipEditor.request = async () => new Response(`data: ${marker}\n\n`)
  await assert.rejects(
    () => Array.fromAsync(streamCompletion(params())),
    (error) => /Invalid event/.test(error.message) && !error.message.includes(marker),
  )
})
