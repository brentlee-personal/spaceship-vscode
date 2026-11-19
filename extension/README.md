# Spaceship Writer

Write in VS Code with independent steering controls. This is an adaptation of [Chuanqi Sun’s Spaceship IDE](https://github.com/chuanqisun/spaceship), not a Chinese-only edition. The interface defaults to English; live writing supports Chinese and other languages through your chosen model.

## Start writing

1. Run **Spaceship: Open Writing Desk**. Right-click a Markdown/text file to **Open File in Writing Desk**, or select text and choose **Continue from Selection**. Right-click a folder to create a **New Markdown Draft**.
2. Enter a manuscript, a direction, or both. Use **Suggest Dimensions** or **Add Dimension**, then **Continue Writing**.
3. Choose **Apply to Editor** to replace the bound file or selection with the visible manuscript. Save and undo using VS Code. If the source has changed, **Save As…** keeps your draft without overwriting those changes.

Live continuation follows the manuscript language unless Direction explicitly requests another. With no manuscript it follows the direction's language, and defaults to English only if both are empty. Intentional mixed-language writing should stay mixed. UI labels and control names do not select the prose language. Output quality depends on the model.

Examples:

- English: “Explain the trade-off in a concise paragraph.”
- 中文：“用中文继续，保留原文语气，通过对话揭开谜底。”
- Explicit switch: “Continue this English draft in French.”

Simulation uses canned English samples to demonstrate interaction; it does not follow arbitrary writing instructions. Historical design demos include Chinese examples. Switch to Live for model-generated writing in your language.

## Model connection

Run **Spaceship: Configure Model Connection**. Set `spaceship.model` and the local CLIProxyAPI `spaceship.proxyPort` (default 8317), then switch to Live. Use **Spaceship: Set CLIProxyAPI Key** to store a key in VS Code SecretStorage, or configure `spaceship.keyFile` with a local dotenv path containing `CLIPROXY_API_KEY`.

Decisions uses the local service at `spaceship.decisionsPort`. For a remote service, set `spaceship.decisionsSshHost` to an SSH configuration alias; that host needs curl and a Plumb service listening on loopback. The bundled webview sends model requests through the extension host. The upstream hosted browser demo uses a separate direct-provider flow.

## Help maintain Spaceship

Try a disposable manuscript and report reproducible issues, especially Windows, Linux, accessibility and multilingual writing behavior. [Contributing guide](https://github.com/brentlee-personal/spaceship-vscode/blob/main/CONTRIBUTING.md) · [Open issues](https://github.com/brentlee-personal/spaceship-vscode/issues)

MIT licensed. Extension identifier: `brentlee-personal.spaceship-writer`.
