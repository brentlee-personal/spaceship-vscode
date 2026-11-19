async function routeDecisions(body, signal, { provider, llm, plumb, serviceTimeoutMs = 5000, llmTimeoutMs = 15000 }) {
  const { decisionAnswers, decisionPrompt, validateQuestions } = await import("./decision-schema.mjs")
  signal.throwIfAborted()
  validateQuestions(body.questions)
  if (provider === "plumb") {
    try {
      const response = await plumb(AbortSignal.any([signal, AbortSignal.timeout(serviceTimeoutMs)]))
      if (!response.ok) throw new Error("Decision service unavailable.")
      const result = decisionAnswers(await response.json(), body.questions)
      signal.throwIfAborted()
      return Response.json(result)
    } catch {
      signal.throwIfAborted()
    }
  }
  const response = await llm(decisionPrompt(body.state, body.questions), AbortSignal.any([signal, AbortSignal.timeout(llmTimeoutMs)]))
  if (!response.ok) throw new Error(`Decision model request failed (HTTP ${response.status}).`)
  let result
  try {
    result = await response.json()
  } catch {
    throw new Error("Invalid decision gateway response.")
  }
  signal.throwIfAborted()
  return Response.json(decisionAnswers(result.choices?.[0]?.message?.content, body.questions))
}
module.exports = { routeDecisions }
