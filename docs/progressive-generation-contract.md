# 0.3.0 experimental progressive generation contract

This is a local, provider-independent engine seam, **not a shipped UI or a 0.2.0 release change**. The engine itself has no transport, file reading, editor writeback or model calls. The separate backbone workbench below now supplies an experimental author-facing outline path. Block-diffusion annealing is an interaction inspiration, not an implemented diffusion model.

## Product direction: a backbone-refinement tool for authors (acceptance, not shipped)

Spaceship is a tool for authors to refine a work's backbone. A usable, reviewed outline that the author can write from is a successful session even if no prose is generated. Prose generation is optional and downstream, not the purpose or completion condition of backbone work. The outline, stubs and schema serve the author's understanding and revision of the work, not merely preparation for a drafting model.

The writer builds an expandable outline with explicit reading order and hierarchy, named stub blocks (purpose and what each changes), and a schema stating what each block needs and produces. Think named stubs that only print their contracts, composed into modules, with a `main` dry run before implementation. Dependency/backbone links are distinct from reading order; optional dependency and conflict annotations belong over the simple outline, not a mandatory graph canvas.

Acceptance for the next vertical slice:

- Run the complete outline without writing prose or starting prose-generation calls; inspect every stub's contract in reading order.
- See missing prerequisites, incompatible inputs/outputs and declared conflicts at the relevant outline positions, including prerequisites introduced too late for the reader. Surface unresolved questions rather than claiming automatic semantic proof.
- Revise one specific block and see its affected dependents, while retaining unaffected work. Plan changes require a new immutable confirmed revision; a cancelled or failed replacement must preserve committed proposals.
- Only after explicit confirmation may independent, dependency-ready blocks fill with bounded parallelism. Local refinement stays within confirmed constraints, preserves unrelated blocks, and invalidates dependent proposals only when a valid replacement commits.

These are priority and user-visible acceptance targets for existing draft PR #4, not implemented UI guarantees. The generation engine below is only a substrate (its current `edit` resets its draft). The separate backbone workbench now supports outline levels, named input/output checks and isolated stub edits; it is not wired to that engine or to prose generation. Do not treat existing engine tests as acceptance of this full workflow. No 0.2.x changes, editor writeback or release are included.

## Current engine contract

1. A writer edits a visible plan: goal, global constraints, typed blocks, each block's intent, local constraints, dependency IDs and context references.
2. `confirm(revision)` freezes a deep copy of the exact reviewed plan. No provider is called before confirmation. An edited plan creates a new draft revision, cancels old work and requires a new confirmation.
3. `run(generator, signal)` fills only ready blocks, in plan order when slots are free, with bounded parallelism (default two, range one to eight). A dependency must have completed before its dependent starts. A failed prerequisite blocks its descendants; independent blocks can complete.
4. `retry(id)` queues one failed block and its blocked descendants; a later explicit `run` does not rerun already successful independent blocks.
5. `refine(id, generator, signal)` regenerates only that completed block against the same confirmed constraints, giving the adapter its previous text and completed prerequisites. Only after a valid replacement completes, dependent proposals become blocked and their stale text is cleared atomically with the replacement; unrelated completed proposals are untouched. During refinement, snapshots retain every last committed proposal. Empty, invalid or failed refinements reject with a safe error and leave these proposals unchanged. Cancellation resolves without committing; late results cannot overwrite a newer revision or refinement. A failed refinement can be attempted again with `refine`, not `retry`, because its prior committed block remains completed. This first seam does not automatically refill these invalidated descendants: a reviewed plan edit and confirmation can start a new pass.

## Adapter boundary

`BlockGenerator(input, signal): AsyncIterable<string>` receives immutable plan revision, typed block, prerequisite outputs, context references, prior block text and `fill`/`refine` mode. It streams a candidate, which becomes the block's committed proposal only on successful completion. Empty or invalid streams fail the block without exposing provider error text. Partial drafts are not committed. The caller gets an immutable snapshot on demand; no UI event stream is claimed.

Context references are identifiers, not file-read authority or loaded text. A future read-context adapter should resolve only authorized immutable source versions/ranges, retain provenance and honor cancellation. The plan engine itself does not fetch them. Likewise, carrying constraints does **not** prove a model obeyed them: content checking and author acceptance remain future integration work. Only plan confirmation is implemented here, not finished-prose approval.

Cancellation invalidates all previous callbacks immediately and releases the local scheduler even if an adapter ignores its signal. It cannot guarantee that a remote server stopped computation, or prevent a new run overlapping abandoned remote work. The concurrency bound applies to the current local run. No selected-range writeback is part of this seam; generated text cannot overwrite a manuscript.

## Deterministic checks

`node --test tests/progressive-engine.test.mjs` covers confirmation/revision guards, defensive snapshots, graph order, parallel limits, failed prerequisites, targeted retry, selective refinement, edit invalidation, late results from an uncooperative source, invalid graphs, and pre-aborted/same-turn cancellation. These are engine checks, not language-model quality, GUI usability, latency or shipped-feature claims.

## Experimental author-facing slice

Run **Spaceship: Open Backbone Workbench** from the VS Code Command Palette. No open manuscript, gateway, key or model is needed. Add named blocks; edit their purpose, what changes for the reader, outline level (1–3), named inputs/outputs, dependency IDs and declared conflicts. Use Move up/down to change reading order; collapse a block to scan the outline.

**Run outline check** walks the entire list without model calls or generated prose. It points to missing/late inputs or dependencies, explicit conflicts, duplicate output ownership, incomplete stubs and skipped hierarchy levels. Click a finding to focus its block; edit it or reorder blocks. Other blocks retain their fields. These are exact-name structural checks, not automatic logical contradiction detection or a proof of meaning. No implicit prose generation follows a passing check.

**Export Markdown copy** opens a new unsaved Markdown document containing the full outline and outstanding checks. Use normal VS Code Save to retain it; the command never applies to an existing manuscript or selection. The panel retains state while hidden; export before closing it. Markdown re-import and cross-session editable project persistence are not part of this slice.

Validation: domain tests cover prose-free diagnostics, order changes, selective edits and export; a mocked VS Code host test covers model-free opening and new-document-only export. `tests/backbone-ui.mjs` exercises the real browser page with a mock VS Code messaging bridge, but this environment blocks Chromium startup (`socket() failed: Operation not permitted`), so its assertions have not run. A separate actual Electron Extension Host smoke now passes in GitHub CI (see below); visual accessibility remains unverified. This is draft implementation, not shipped UX.

## Actual Electron Extension Host evidence

At commit `4eb4a963562d7ecfbbcf06119130305485b8d741`, [CI run 44590756880](https://github.com/brentlee-personal/spaceship-vscode/actions/runs/44590756880) passed the real host smoke with Microsoft VS Code 1.105.1, `@vscode/test-electron` 3.1.0 and Xvfb. The job log records the actual-host PASS line and exit code 0. This uses the [official integration-test runner](https://code.visualstudio.com/api/working-with-extensions/testing-extension) and [documented Linux CI setup](https://code.visualstudio.com/api/working-with-extensions/continuous-integration#github-actions), not a mocked VS Code API.

Run locally where a desktop display is available: `npm run build:extension && npm run test:extension-host`. On headless Linux use `xvfb-run -a npm run test:extension-host` after building.

The smoke activates the development extension and executes its registered workbench command, verifying the real tab. It then opens the same production panel factory with real VS Code APIs, retaining its CSP and compiled production modules while injecting a temporary test-only script to operate actual DOM controls. Production `acquireVsCodeApi` sends the exports through the real host listener; assertions verify new untitled Markdown documents. The temporary driver is deleted, and CI packages the VSIX before injection.

Fixtures cover chapter/scene subtree round trips, disabled parent removal and child boundary movement, actionable missing-premise focus, and a synthetic nonfiction evidence mismatch: a chart initially produces `all registrations`, while the inference needs `approved counts on the same basis`; correcting the explicitly declared evidence clears the check without changing unrelated blocks. No private manuscripts, credentials, model calls or inferred semantic reasoning are involved.

Coverage limits: this loads the development extension directory, not an installed VSIX. It does not test manual visual/keyboard usability, persistence/re-import, model generation, save-dialog operation or preservation of an existing manuscript (the fixture has none). The standalone mock-bridge browser smoke remains unexecuted locally. A green host smoke is evidence of this bounded path, not release approval or a claim of shipped UX.
