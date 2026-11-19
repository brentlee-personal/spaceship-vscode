export type BlockKind = "claim" | "evidence" | "transition" | "scene" | "conclusion"
export type PlanBlock = { id: string; kind: BlockKind; intent: string; dependsOn: string[]; constraints: string[]; contextRefs: string[] }
export type PlanDraft = { goal: string; constraints: string[]; blocks: PlanBlock[] }
export type ConfirmedPlan = Readonly<PlanDraft & { revision: number }>
export type BlockState = { status: "pending" | "running" | "done" | "failed" | "blocked"; text: string; mode: "fill" | "refine" }
export type GenerationInput = { plan: ConfirmedPlan; block: PlanBlock; dependencies: Record<string, string>; previous: string; mode: "fill" | "refine" }
export type BlockGenerator = (input: Readonly<GenerationInput>, signal: AbortSignal) => AsyncIterable<string>

/** A proposal engine only: no provider, file access, editor edits or implicit confirmation. */
export function createProgressiveEngine(initial: PlanDraft, concurrency = 2) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error("Concurrency must be between 1 and 8.")
  let revision = 1
  let draft = validated(initial)
  let confirmed: ConfirmedPlan | undefined
  let states = freshStates(draft)
  let active: AbortController | undefined
  let epoch = 0

  function snapshot() {
    return freeze(structuredClone({ revision, phase: confirmed ? "confirmed" : "draft", plan: confirmed ?? draft, blocks: states }))
  }

  function cancel() {
    epoch++
    active?.abort()
    active = undefined
    for (const state of Object.values(states)) if (state.status === "running") state.status = "pending"
  }

  function edit(next: PlanDraft) {
    const replacement = validated(next)
    cancel()
    draft = replacement
    revision++
    confirmed = undefined
    states = freshStates(draft)
    return snapshot()
  }

  function confirm(expectedRevision: number) {
    if (expectedRevision !== revision) throw new Error("The plan changed; review the current revision.")
    confirmed ??= freeze(structuredClone({ ...draft, revision }))
    return snapshot()
  }

  async function run(generate: BlockGenerator, signal?: AbortSignal) {
    if (!confirmed) throw new Error("Confirm the plan before generation.")
    if (active) throw new Error("Generation is already active.")
    signal?.throwIfAborted()
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener("abort", abort, { once: true })
    active = controller
    const token = ++epoch
    const plan = confirmed
    const current = states
    const jobs = new Map<string, Promise<void>>()
    const valid = () => token === epoch && !controller.signal.aborted

    async function produce(block: PlanBlock) {
      if (!valid()) return
      const state = current[block.id]
      state.status = "running"
      const input = freeze(
        structuredClone({
          plan,
          block,
          mode: state.mode,
          previous: state.text,
          dependencies: Object.fromEntries(block.dependsOn.map((id) => [id, current[id].text])),
        }),
      )
      try {
        const text = await candidate(generate, input, controller.signal)
        if (valid()) {
          state.text = text
          state.status = "done"
        }
      } catch {
        if (valid()) state.status = "failed"
      } finally {
        if (valid()) jobs.delete(block.id)
      }
    }

    try {
      while (valid()) {
        for (const block of plan.blocks) {
          if (jobs.size >= concurrency) break
          if (current[block.id].status !== "pending") continue
          if (block.dependsOn.every((id) => current[id].status === "done"))
            jobs.set(
              block.id,
              Promise.resolve().then(() => produce(block)),
            )
        }
        if (!jobs.size) break
        await Promise.race(jobs.values())
      }
      if (valid()) for (const state of Object.values(current)) if (state.status === "pending") state.status = "blocked"
    } finally {
      signal?.removeEventListener("abort", abort)
      if (token === epoch) {
        active = undefined
        for (const state of Object.values(current)) if (state.status === "running") state.status = "pending"
      }
    }
    return snapshot()
  }

  function retry(id: string) {
    if (!confirmed || active) throw new Error("Retry requires an idle confirmed plan.")
    if (states[id]?.status !== "failed") throw new Error("Only a failed block can be retried.")
    states[id].status = "pending"
    for (const dependent of descendants(draft, id)) if (states[dependent].status === "blocked") states[dependent].status = "pending"
    return snapshot()
  }

  async function refine(id: string, generate: BlockGenerator, signal?: AbortSignal) {
    signal?.throwIfAborted()
    if (!confirmed || active || states[id]?.status !== "done") throw new Error("Refine requires a completed block and an idle confirmed plan.")
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener("abort", abort, { once: true })
    active = controller
    const token = ++epoch
    const plan = confirmed
    const input = freeze(
      structuredClone({
        plan,
        block: plan.blocks.find((block) => block.id === id)!,
        mode: "refine" as const,
        previous: states[id].text,
        dependencies: Object.fromEntries(plan.blocks.find((block) => block.id === id)!.dependsOn.map((parent) => [parent, states[parent].text])),
      }),
    )
    const valid = () => token === epoch && !controller.signal.aborted
    try {
      const text = await candidate(generate, input, controller.signal)
      if (valid()) {
        // Publish the replacement and invalidate its descendants in one synchronous transaction.
        // Until this point every snapshot still contains the last committed proposals.
        const replacement = { ...states, [id]: { status: "done" as const, text, mode: "refine" as const } }
        for (const dependent of descendants(plan, id)) replacement[dependent] = { status: "blocked", text: "", mode: "fill" }
        states = replacement
      }
    } catch {
      if (valid()) throw new Error("Refinement failed; committed proposals preserved.")
    } finally {
      signal?.removeEventListener("abort", abort)
      if (token === epoch) active = undefined
    }
    return snapshot()
  }

  return { snapshot, edit, confirm, cancel, run, retry, refine }
}

function freshStates(plan: PlanDraft): Record<string, BlockState> {
  return Object.fromEntries(plan.blocks.map((block) => [block.id, { status: "pending", text: "", mode: "fill" }]))
}

function descendants(plan: PlanDraft, id: string) {
  const found = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const block of plan.blocks)
      if (!found.has(block.id) && block.dependsOn.some((parent) => parent === id || found.has(parent))) {
        found.add(block.id)
        changed = true
      }
  }
  return found
}

function validated(input: PlanDraft) {
  const plan = structuredClone(input)
  const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string")
  if (!plan || typeof plan.goal !== "string" || !plan.goal.trim() || !strings(plan.constraints) || !Array.isArray(plan.blocks) || !plan.blocks.length)
    throw new Error("A plan needs a goal, constraints and blocks.")
  const ids = new Set<string>()
  for (const block of plan.blocks) {
    if (
      !block ||
      typeof block.id !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(block.id) ||
      ["__proto__", "constructor", "prototype"].includes(block.id) ||
      ids.has(block.id) ||
      !["claim", "evidence", "transition", "scene", "conclusion"].includes(block.kind) ||
      typeof block.intent !== "string" ||
      !block.intent.trim() ||
      !strings(block.dependsOn) ||
      !strings(block.constraints) ||
      !strings(block.contextRefs)
    )
      throw new Error("Invalid or duplicate plan block.")
    ids.add(block.id)
  }
  const reached = new Set<string>()
  while (reached.size < ids.size) {
    const before = reached.size
    for (const block of plan.blocks) if (block.dependsOn.every((id) => reached.has(id))) reached.add(block.id)
    if (reached.size === before) throw new Error("Plan dependencies must exist and form an acyclic graph.")
  }
  return freeze(plan)
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) freeze(nested)
    Object.freeze(value)
  }
  return value
}

function cancellable<T>(promise: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener("abort", abort, { once: true })
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort))
    if (signal.aborted) abort()
  })
}

async function candidate(generate: BlockGenerator, input: GenerationInput, signal: AbortSignal) {
  signal.throwIfAborted()
  let iterator: AsyncIterator<string> | undefined
  let text = ""
  try {
    iterator = generate(input, signal)[Symbol.asyncIterator]()
    while (true) {
      const next = await cancellable(iterator.next(), signal)
      signal.throwIfAborted()
      if (next.done) break
      if (typeof next.value !== "string") throw new Error("Invalid generated block.")
      text += next.value
    }
    if (!text.trim()) throw new Error("Empty generated block.")
    return text
  } finally {
    // A provider ignoring cancellation cannot retain the scheduler or publish a late result.
    try {
      if (iterator?.return) void Promise.resolve(iterator.return()).catch(() => {})
    } catch {
      /* Cleanup cannot change the committed outcome. */
    }
  }
}
