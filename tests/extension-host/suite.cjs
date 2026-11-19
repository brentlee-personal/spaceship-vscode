const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const path = require("node:path")
const vscode = require("vscode")
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(check, message) {
  for (let i = 0; i < 300; i++) {
    if (await check()) return
    await sleep(100)
  }
  throw Error(message)
}
exports.run = async () => {
  const extension = vscode.extensions.getExtension("brentlee-personal.spaceship-writer")
  assert.ok(extension, "Development extension must be discovered")
  await extension.activate()
  assert.equal(extension.isActive, true)
  assert.equal(vscode.workspace.getConfiguration("spaceship").get("model"), "")
  await vscode.commands.executeCommand("spaceship.backbone")
  await until(
    () => vscode.window.tabGroups.all.flatMap((g) => g.tabs).some((t) => t.label === "Spaceship · Backbone"),
    "Real command did not open workbench tab",
  )
  await vscode.commands.executeCommand("workbench.action.closeAllEditors")

  // Real factory and real VS Code APIs, not a fake DOM bridge. Inject only a test
  // driver to click production controls; leave production CSP and scripts intact.
  const { openBackbone } = require(path.join(extension.extensionPath, "backbone.cjs"))
  const driverPath = path.join(extension.extensionPath, "media", "host-smoke-driver.js")
  await fs.copyFile(path.join(__dirname, "driver.js"), driverPath)
  const panel = openBackbone(vscode, { extensionUri: extension.extensionUri })
  const messages = []
  const listener = panel.webview.onDidReceiveMessage((m) => {
    if (m.type === "exportOutline") messages.push(m.content)
  })
  try {
    const script = panel.webview.asWebviewUri(vscode.Uri.file(driverPath))
    panel.webview.html = panel.webview.html.replace("</body>", `<script type="module" src="${script}"></script></body>`)
    await until(
      () => messages.length >= 2 || messages.some((m) => m.includes("HOST SMOKE FAILURE")),
      "Real webview did not send both exports (CSP/module/driver failure)",
    )
    assert.equal(
      messages.some((m) => m.includes("HOST SMOKE FAILURE")),
      false,
      messages.join("\n"),
    )
    assert.match(messages[0], /## Chapter A[\s\S]*### Scene A[\s\S]*## Chapter B[\s\S]*### Scene B/)
    assert.match(messages[1], /HOST SMOKE: evidence repaired/)
    assert.match(messages[1], /Structural checks passed/)
    await until(
      () => messages.every((text) => vscode.workspace.textDocuments.some((d) => d.isUntitled && d.languageId === "markdown" && d.getText() === text)),
      "Exports were not opened as new untitled Markdown documents",
    )
    assert.equal(vscode.workspace.textDocuments.filter((d) => d.uri.scheme === "file").length, 0, "No manuscript file should be opened or changed")
    console.log(
      "PASS actual Electron Extension Host: activation, command tab, production webview controls, subtree round trip, synthetic missing premise/fix, real message bridge and untitled Markdown exports",
    )
  } finally {
    listener.dispose()
    panel.dispose()
    await fs.unlink(driverPath)
  }
}
