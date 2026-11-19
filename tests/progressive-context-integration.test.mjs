import test from "node:test"
import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { createTextStream } from "../src/text/text-stream.ts"

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
const { createLiveSource } = await import("../src/text/live-completion.ts")

test("a live continuation sends scoped ranges, finds the named early clue and preserves the full draft", async () => {
  const oldClue = "The blue envelope contains Ada’s train ticket."
  const omitted = "A private note in the omitted middle."
  const filler = "This passage fills a line in the draft."
  const ending = "她回头看着车站。"
  const raw = [oldClue, ...Array(400).fill(filler), omitted, ...Array(400).fill(filler), ending].join("\n")
  let calls = 0
  let observed
  let request
  globalThis.window = {
    spaceshipEditor: {
      async request(route, body) {
        assert.equal(route, "chat")
        calls++
        request = JSON.parse(body)
        return new Response('data: {"choices":[{"delta":{"content":" 下一班车进站了。"}}]}\n\ndata: [DONE]\n\n')
      },
    },
  }
  const stream = createTextStream(
    createLiveSource((value) => {
      observed = value
    }),
    () => {},
  )
  stream.replace(raw)
  const guide = { direction: 'Resolve "blue envelope" in Chinese.', leads: [], controls: [] }
  assert.equal(await stream.generate("steering changed", guide), "done")
  assert.equal(calls, 1)
  assert.equal(stream.text, raw + " 下一班车进站了。")
  assert.equal(observed.omitted, true)
  assert.ok(observed.tail.endsWith(ending))
  assert.ok(observed.excerpts.some(({ text, startLine }) => startLine === 1 && text.includes(oldClue)))
  const modelInput = request.messages[1].content
  assert.ok(modelInput.includes(oldClue))
  assert.ok(modelInput.includes(ending))
  assert.ok(modelInput.includes(guide.direction))
  assert.ok(modelInput.length < raw.length * 0.4)
  assert.ok(!modelInput.includes(omitted))
  assert.doesNotMatch(modelInput, /\[Manuscript\]\nThe blue envelope/)
})
