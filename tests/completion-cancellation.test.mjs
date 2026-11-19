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
