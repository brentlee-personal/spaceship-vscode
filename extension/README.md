# Spaceship Writer

Write in VS Code with independent steering controls. This is an adaptation of [Chuanqi Sun’s Spaceship IDE](https://github.com/chuanqisun/spaceship), not a Chinese-only edition. The interface defaults to English; live writing supports Chinese and other languages through your chosen model.

## Start writing

1. Run **Spaceship: Open Writing Desk**. Right-click a Markdown/text file to **Open File in Writing Desk**, or select text and choose **Continue from Selection**. Right-click a folder to create a **New Markdown Draft**.
2. Enter a manuscript, a direction, or both. **Suggest Dimensions** offers concrete targets such as `tension → calm` as they arrive. Click one to add it, then adjust the target or strength. You can also **Add Dimension** yourself or **Continue Writing** without a recommendation.
3. Choose **Apply to Editor** to replace the bound file or selection with the visible manuscript. Save and undo using VS Code. If the source has changed, **Save As…** keeps your draft without overwriting those changes.

Live continuation follows the manuscript language unless Direction explicitly requests another. With no manuscript it follows the direction's language, and defaults to English only if both are empty. Intentional mixed-language writing should stay mixed. UI labels and control names do not select the prose language. Output quality depends on the model.

Examples:

- English: “Explain the trade-off in a concise paragraph.”
- 中文：“用中文继续，保留原文语气，通过对话揭开谜底。”
- Explicit switch: “Continue this English draft in French.”

Simulation uses canned English samples to demonstrate interaction; it does not follow arbitrary writing instructions. Historical design demos include Chinese examples. Switch to Live for model-generated writing in your language.

## Model connection

Run **Spaceship: Configure Model Connection**. Set `spaceship.model` and the local CLIProxyAPI `spaceship.proxyPort` (default 8317), then switch to Live. Use **Spaceship: Set CLIProxyAPI Key** to store a key in VS Code SecretStorage, or configure `spaceship.keyFile` with a local dotenv path containing `CLIPROXY_API_KEY`.

The bundled webview sends model requests through the extension host. The upstream hosted browser demo uses a separate direct-provider flow.

## How the models work together

| Stage                | Model and priority                                                                                                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catch keywords       | The writing model looks for a few distinct, unresolved details in recent text. Only phrases grounded in the manuscript are shown; outdated captures are canceled.                                                                                                                               |
| Offer directions     | On request, the writing model uses the current draft, author direction, and any available grounded keywords in one call. Suggestions arrive as choices, not edits. It does not wait for a separate scoring pass.                                                                                |
| Continue and iterate | The writing model streams prose directly from the accepted controls and the manuscript. Passive keyword discovery, menu prefetch, and scoring yield to writing or an explicit recommendation request. A new steering action cancels obsolete generation; the background text buffer is bounded. |
| Inspect the effect   | The decision model scores keyword relevance, influence, and whether a steering control is reflected in the output. Slow or missing scores do not block prose.                                                                                                                                   |

The status bar reports time to the first text chunk and streaming characters per second. Actual speed depends on the gateway/provider; cancellation does not guarantee that a remote server drops queued work.

## Decision feedback without a dedicated decision model

By default, keyword relevance, influence and realization feedback use your writing model through the same configured local CLIProxyAPI gateway. No Gemini key or Plumb service is required. Set **Spaceship: Decision Model** (`spaceship.decisionModel`) to another model ID offered by that gateway if you prefer; an empty value uses `spaceship.model`. It does not change the continuation model or add a new endpoint.

Choose **Spaceship: Decision Provider** = `plumb` to try the existing local/SSH Decisions service. Configure `spaceship.decisionsPort` for the service on loopback; for an existing SSH setup use `spaceship.decisionsSshHost` (an SSH config alias). A failed, malformed or unavailable service falls back once to the selected LLM. The service attempt has a 5-second limit and the LLM attempt a 15-second limit; cancellation cancels the active request without starting fallback. Existing installations with an explicitly configured Decisions port or SSH host keep that service-first route unless Decision Provider is explicitly set to `llm`.

All new settings are machine-scoped. The LLM adapter validates complete, correctly typed answers and rejects invalid scores rather than inventing neutral values. Confidence, when supplied, is model-reported, not a calibrated probability; an LLM substitute can be slower and less calibrated than a dedicated decision model. Failure leaves feedback unavailable rather than blocking your manuscript. Cancellation stops local processing and transport; it cannot promise that a remote backend has removed already queued work.

The browser demo also falls back to its existing writing LLM when no Gemini key is supplied. Browser development uses the writing LLM by default; `VITE_DECISION_PROVIDER=plumb` explicitly enables the existing configured service route. Model selection in VS Code is controlled by its machine settings, not by webview request payloads.

## Help maintain Spaceship

Try a disposable manuscript and report reproducible issues, especially Windows, Linux, accessibility and multilingual writing behavior. [Contributing guide](https://github.com/brentlee-personal/spaceship-vscode/blob/main/CONTRIBUTING.md) · [Open issues](https://github.com/brentlee-personal/spaceship-vscode/issues)

MIT licensed. Extension identifier: `brentlee-personal.spaceship-writer`.

## Experimental backbone workbench (0.3.0 draft only)

Use **Spaceship: Open Backbone Workbench** to build a readable outline of named stubs, their purpose and what changes, with explicit inputs, outputs and dependencies. Run the prose-free structural check, revise one block without losing the others, and export a new Markdown copy to save normally. No model configuration is needed. A useful outline is a complete outcome; prose generation is optional and is not connected to this workbench yet. Export before closing the panel. This draft path has unit coverage and a passing real Electron Extension Host smoke for production controls and untitled Markdown export. Installed-VSIX and manual visual/keyboard acceptance remain unverified; this is not a released feature.
