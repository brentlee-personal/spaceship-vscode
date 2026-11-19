import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRequire } from "node:module"
const { openBackbone } = createRequire(import.meta.url)("../extension/backbone.cjs")
test("plugin opens without editor/model and exports only a new Markdown document", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "backbone-host-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, "media/extra"), { recursive: true })
  writeFileSync(join(root, "media/extra/backbone.html"), "<html><head></head><body>Backbone Workbench</body></html>")
  let receive, disposed, opened, shown
  const panel = {
    webview: {
      cspSource: "https://local.invalid",
      asWebviewUri: () => "https://local.invalid/extra",
      onDidReceiveMessage(fn) {
        receive = fn
        return { dispose() {} }
      },
    },
    onDidDispose(fn) {
      disposed = fn
    },
  }
  const vscode = {
    Uri: { joinPath: (base, ...parts) => ({ fsPath: [base.fsPath, ...parts].join("/") }) },
    ViewColumn: { Beside: 2, One: 1 },
    window: {
      createWebviewPanel: () => panel,
      showTextDocument: async (doc) => {
        shown = doc
      },
    },
    workspace: {
      openTextDocument: async (options) => {
        opened = options
        return options
      },
    },
  }
  openBackbone(vscode, { extensionUri: { fsPath: root } })
  assert.match(panel.webview.html, /connect-src 'none'/)
  assert.match(panel.webview.html, /Backbone Workbench/)
  await receive({ type: "model", content: "must ignore" })
  assert.equal(opened, undefined)
  await receive({ type: "exportOutline", content: "# My outline" })
  assert.deepEqual(opened, { language: "markdown", content: "# My outline" })
  assert.equal(shown, opened)
  assert.equal(typeof disposed, "function")
})
