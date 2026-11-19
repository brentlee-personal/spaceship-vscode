# 0.3.0 experimental progressive generation contract

This is a local, provider-independent engine seam, **not a shipped UI or a 0.2.0 release change**. No extension commands, transport, file reading, editor writeback or model calls are connected. Block-diffusion annealing is an interaction inspiration, not an implemented diffusion model.

## Intended interaction

1. A writer edits a visible plan: goal, global constraints, typed blocks, each block's intent, local constraints, dependency IDs and context references.
2. `confirm(revision)` freezes a deep copy of the exact reviewed plan. No provider is called before confirmation. An edited plan creates a new draft revision, cancels old work and requires a new confirmation.
3. `run(generator, signal)` fills only ready blocks, in plan order when slots are free, with bounded parallelism (default two, range one to eight). A dependency must have completed before its dependent starts. A failed prerequisite blocks its descendants; independent blocks can complete.
4. `retry(id)` queues one failed block and its blocked descendants; a later explicit `run` does not rerun already successful independent blocks.
5. `refine(id, generator, signal)` regenerates only that completed block against the same confirmed constraints, giving the adapter its previous text and completed prerequisites. Dependent proposals become blocked and their stale text is cleared; unrelated completed proposals are untouched. This first seam does not automatically refill these invalidated descendants: a reviewed plan edit and confirmation can start a new pass.

## Adapter boundary

`BlockGenerator(input, signal): AsyncIterable<string>` receives immutable plan revision, typed block, prerequisite outputs, context references, prior block text and `fill`/`refine` mode. It streams a candidate, which becomes the block's committed proposal only on successful completion. Empty or invalid streams fail the block without exposing provider error text. Partial drafts are not committed. The caller gets an immutable snapshot on demand; no UI event stream is claimed.

Context references are identifiers, not file-read authority or loaded text. A future read-context adapter should resolve only authorized immutable source versions/ranges, retain provenance and honor cancellation. The plan engine itself does not fetch them. Likewise, carrying constraints does **not** prove a model obeyed them: content checking and author acceptance remain future integration work. Only plan confirmation is implemented here, not finished-prose approval.

Cancellation invalidates all previous callbacks immediately and releases the local scheduler even if an adapter ignores its signal. It cannot guarantee that a remote server stopped computation, or prevent a new run overlapping abandoned remote work. The concurrency bound applies to the current local run. No selected-range writeback is part of this seam; generated text cannot overwrite a manuscript.

## Deterministic checks

`node --test tests/progressive-engine.test.mjs` covers confirmation/revision guards, defensive snapshots, graph order, parallel limits, failed prerequisites, targeted retry, selective refinement, edit invalidation, late results from an uncooperative source, invalid graphs, and pre-aborted/same-turn cancellation. These are engine checks, not language-model quality, GUI usability, latency or shipped-feature claims.
