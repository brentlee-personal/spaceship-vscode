const fs = require("node:fs")
const path = require("node:path")
function openBackbone(vscode, context) {
  const { Uri, window, workspace, ViewColumn } = vscode
  const media = Uri.joinPath(context.extensionUri, "media")
  const panel = window.createWebviewPanel("spaceship.backbone", "Spaceship · Backbone", ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [media],
  })
  const web = panel.webview
  const csp = `default-src 'none'; style-src ${web.cspSource} 'unsafe-inline'; script-src ${web.cspSource}; base-uri ${web.cspSource}; connect-src 'none'`
  web.html = fs
    .readFileSync(path.join(media.fsPath, "extra/backbone.html"), "utf8")
    .replace("<head>", `<head><meta http-equiv="Content-Security-Policy" content="${csp}"><base href="${web.asWebviewUri(Uri.joinPath(media, "extra"))}/">`)
  const listener = web.onDidReceiveMessage(async (message) => {
    if (message?.type !== "exportOutline" || typeof message.content !== "string" || message.content.length > 2_000_000) return
    try {
      const doc = await workspace.openTextDocument({ language: "markdown", content: message.content })
      await window.showTextDocument(doc, { viewColumn: ViewColumn.One, preview: false })
    } catch {
      window.showErrorMessage("Could not open the outline copy. Your backbone remains in the panel; try exporting again.")
    }
  })
  panel.onDidDispose(() => listener.dispose())
  return panel
}
module.exports = { openBackbone }
