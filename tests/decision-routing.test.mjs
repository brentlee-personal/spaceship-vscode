import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { decisionAnswers } from "../extension/decision-schema.mjs"
const require = createRequire(import.meta.url)
const { routeDecisions } = require("../extension/decision-router.cjs")
const questions = { k: { type: "score", instructions: "Relevance", criteria: ["none", "strong"] } }
const answer = { answers: { k: { type: "score", score: 1, confidence: 0.8 } } }
const transcript = () => Response.json({ choices: [{ message: { content: JSON.stringify(answer) } }] })
const body = { state: "A private manuscript", questions }

test("no Plumb by default: one LLM transcript, validated result", async () => {
  let count = 0
  const result = await routeDecisions(body, new AbortController().signal, {
    provider: "llm",
    plumb: () => assert.fail("unrequested endpoint"),
    llm: async (payload) => {
      count++
      assert.equal(payload.stream, false)
      assert.deepEqual(JSON.parse(payload.messages[1].content), { input: body.state, questions })
      return transcript()
    },
  })
  assert.equal((await result.json()).answers.k.score, 1)
  assert.equal(count, 1)
})

test("configured Plumb works or falls back once on unavailable/malformed reply", async () => {
  for (const response of [Response.json(answer), new Response("secret provider error", { status: 503 }), Response.json({ answers: {} })]) {
    let calls = 0
    const ok = response.ok && (await response.clone().json()).answers.k
    const result = await routeDecisions(body, new AbortController().signal, {
      provider: "plumb",
      plumb: async () => response,
      llm: async () => {
        calls++
        return transcript()
      },
    })
    assert.equal((await result.json()).answers.k.score, 1)
    assert.equal(calls, ok ? 0 : 1)
  }
})

test("service timeout falls back, caller cancellation never does", async () => {
  const waiting = (signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }))
  const keeper = setTimeout(() => {}, 1000)
  try {
    let fallbacks = 0
    await routeDecisions(body, new AbortController().signal, {
      provider: "plumb",
      serviceTimeoutMs: 10,
      plumb: waiting,
      llm: async () => {
        fallbacks++
        return transcript()
      },
    })
    assert.equal(fallbacks, 1)
    const controller = new AbortController()
    const result = routeDecisions(body, controller.signal, { provider: "plumb", plumb: waiting, llm: () => assert.fail("fallback after cancellation") })
    setTimeout(() => controller.abort(), 10)
    await assert.rejects(result, { name: "AbortError" })
  } finally {
    clearTimeout(keeper)
  }
})

test("schema rejects invalid scores and missing answers; errors omit provider bodies", async () => {
  for (const score of [-1, 2, 0.5, "1", null]) assert.throws(() => decisionAnswers({ answers: { k: { type: "score", score, confidence: 1 } } }, questions))
  assert.throws(() => decisionAnswers({ answers: {} }, questions))
  await assert.rejects(
    routeDecisions(body, new AbortController().signal, { provider: "llm", llm: async () => new Response("SECRET", { status: 401 }) }),
    (error) => error.message === "Decision model request failed (HTTP 401).",
  )
  const q = { p: { type: "noul", instructions: "yes?" }, c: { type: "choice", instructions: "which?", criteria: { a: "A" } } }
  assert.equal(
    decisionAnswers({ answers: { p: { type: "noul", noul: 0.5, confidence: 0.8 }, c: { type: "choice", choice: "a", confidence: 1 } } }, q).answers.c.choice,
    "a",
  )
})

test("extension host pins model and endpoint; payload cannot select another gateway", async () => {
  const values = { model: "writer", decisionModel: "judge", proxyPort: 8317, decisionProvider: "llm" }
  const requests = []
  const module = { exports: {} }
  vm.runInNewContext(readFileSync(new URL("../extension/model.cjs", import.meta.url), "utf8"), {
    require: (name) =>
      name === "vscode"
        ? { workspace: { getConfiguration: () => ({ get: (key, fallback) => values[key] ?? fallback, inspect: (key) => ({ globalValue: values[key] }) }) } }
        : name === "./decision-router.cjs"
          ? { routeDecisions }
          : require(name),
    module,
    process: { env: {} },
    Response,
    AbortSignal,
    fetch: async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body), redirect: init.redirect })
      return transcript()
    },
  })
  const call = module.exports.modelResponse
  await call("decisions", { ...body, model: "attacker", url: "https://unintended.example" }, new AbortController().signal, { get: async () => "test-key" })
  assert.equal(requests[0].url, "http://127.0.0.1:8317/v1/chat/completions")
  assert.equal(requests[0].body.model, "judge")
  assert.equal(requests[0].redirect, "error")
  values.decisionModel = ""
  await call("decisions", body, new AbortController().signal, { get: async () => "test-key" })
  assert.equal(requests[1].body.model, "writer")
  await call("chat", { model: "judge" }, new AbortController().signal, { get: async () => "test-key" })
  assert.equal(requests[2].body.model, "writer")
})

test("legacy service answers need no confidence; fenced JSON is accepted without leaking invalid text", () => {
  assert.equal(decisionAnswers({ answers: { k: { type: "score", score: 1 } } }, questions).answers.k.confidence, undefined)
  assert.equal(decisionAnswers("```json\n" + JSON.stringify(answer) + "\n```", questions).answers.k.score, 1)
  assert.throws(
    () => decisionAnswers("SECRET private invalid JSON", questions),
    (error) => error.message === "Invalid decision JSON.",
  )
})

test("decision LLM timeout is bounded; browser Gemini key is optional", async () => {
  const keeper = setTimeout(() => {}, 1000)
  try {
    await assert.rejects(
      routeDecisions(body, new AbortController().signal, {
        provider: "llm",
        llmTimeoutMs: 10,
        llm: (_, signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
      }),
      { name: "TimeoutError" },
    )
  } finally {
    clearTimeout(keeper)
  }
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
  const input = html.match(/<input\s+name="gemini"[^>]*>/)[0]
  assert.doesNotMatch(input, /required/)
})
