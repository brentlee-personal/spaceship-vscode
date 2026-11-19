const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const path = require("node:path")
const vscode = require("vscode")
exports.run = async () => {
  const extension = vscode.extensions.getExtension("brentlee-personal.spaceship-writer")
  assert.ok(extension, "Installed package must be discovered")
  const installRoot = await fs.realpath(process.env.SPACESHIP_TEST_EXTENSIONS)
  const resolved = await fs.realpath(extension.extensionPath)
  assert.ok(resolved.startsWith(installRoot + path.sep), "Target must resolve from isolated installed extensions, not development root")
  assert.equal(extension.packageJSON.version, process.env.SPACESHIP_TEST_EXPECTED_VERSION)
  await extension.activate()
  assert.equal(extension.isActive, true)
  assert.ok((await vscode.commands.getCommands()).includes("spaceship.backbone"))
  assert.equal(vscode.workspace.getConfiguration("spaceship").get("model"), "")
  const sourcePath = process.env.SPACESHIP_TEST_SOURCE
  const disk = await fs.readFile(sourcePath, "utf8")
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(sourcePath))
  const editor = await vscode.window.showTextDocument(doc)
  assert.equal(await editor.edit((edit) => edit.insert(doc.positionAt(doc.getText().length), "Unsaved synthetic revision.\n")), true)
  assert.equal(doc.isDirty, true)
  const dirty = doc.getText(),
    version = doc.version
  await vscode.commands.executeCommand("spaceship.backbone")
  for (let i = 0; i < 100 && !vscode.window.tabGroups.all.flatMap((g) => g.tabs).some((t) => t.label === "Spaceship · Backbone"); i++)
    await new Promise((r) => setTimeout(r, 100))
  assert.ok(
    vscode.window.tabGroups.all.flatMap((g) => g.tabs).some((t) => t.label === "Spaceship · Backbone"),
    "Installed command must open real workbench tab",
  )
  assert.equal(doc.getText(), dirty)
  assert.equal(doc.version, version)
  assert.equal(doc.isDirty, true)
  assert.equal(await fs.readFile(sourcePath, "utf8"), disk)
  const evidence = {
    checkout: process.env.SPACESHIP_TEST_CHECKOUT,
    vsix: process.env.SPACESHIP_TEST_VSIX_NAME,
    sha256: process.env.SPACESHIP_TEST_VSIX_SHA256,
    installedVersion: extension.packageJSON.version,
    resolvedExtensionPath: resolved,
    isolatedExtensions: installRoot,
    vscode: vscode.version,
    activated: true,
    commandOpenedTab: true,
    originalDiskUnchanged: true,
    dirtyBufferUnchanged: true,
    coverageLimit:
      "Installed package activation and command opening only. No test JS injected into installed package; export covered separately by development-host smoke.",
  }
  await fs.writeFile(process.env.SPACESHIP_TEST_EVIDENCE, JSON.stringify(evidence, null, 2) + "\n")
  console.log("PASS isolated installed VSIX: " + JSON.stringify(evidence))
}
