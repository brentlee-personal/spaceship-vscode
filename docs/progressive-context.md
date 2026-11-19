# Progressive context for interactive writing

The editor owns the complete manuscript. The model receives a bounded view for the current operation; limiting that view never shortens the draft or edits anything outside the original VS Code binding.

## First slice

1. Open a file or selection. Use the active writing target only; no workspace-wide scan and no new provider.
2. Continue from the exact end of the active draft. A short draft fits unchanged. A long draft starts with a bounded recent window.
3. When the author names a specific earlier anchor or the active keyword cues match earlier material, look up the relevant passages locally. Include only bounded, line-labelled excerpts with the recent window in the same completion request. The prose path never waits for a separate search model.
4. Show which ranges reached the model. Treat earlier excerpts as read-only evidence, not writing instructions or a separate edit target. Recompute from the latest draft rather than keep stale citations.

This is bounded progressive disclosure, not a whole-workspace agent or a claim to find every indirectly related fact. Selected text stays an isolated writing target; explicit reference files and search across them are a follow-up, as is persistent cached indexing. For a missing exact anchor, the interface must not claim it found one.

## Mature patterns adapted

- [OpenCode bounded reads](https://github.com/anomalyco/opencode/blob/c740f6dcb2805d6d627df1169c03ca792b181190/packages/core/src/tool/plugin/read.ts#L23-L42): search for candidate locations, then read a bounded range, with explicit truncation. Do not copy its general-purpose tool autonomy into the writer.
- [Kilo context and mentions](https://kilo.ai/docs/code-with-ai/agents/context-mentions), [bounded read implementation](https://github.com/Kilo-Org/kilocode/blob/182a5f9f501d4d2bff2b5a4372d6f06065cf9904/packages/opencode/src/tool/read.ts): scope data deliberately, search before fetching details and distinguish excerpts from a complete source.

## Acceptance

Compare the same fixture with full input and with bounded context. Long drafts must send substantially fewer characters, while an explicitly named early clue is still present in the request. Report exact sent ranges, preserve the exact continuation tail and leave the active draft and out-of-selection text intact. Test repeated and mixed-script clues, no match, revisions, whitespace and large lines. Measure provider first-chunk time and generated factual continuity separately before making real-provider performance claims.

## Later: progressive generation

The next minor version separates editable framework, author confirmation, bounded parallel filling and localized refinement. Context loading supports that flow but does not imply diffusion inference.
