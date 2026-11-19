const vscode = require("vscode")
const path = require("node:path")
const fs = require("node:fs")
const { modelResponse } = require("./model.cjs")

const { Uri, Range, Selection, ViewColumn, workspace, window: ui } = vscode
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

function activate(context) {
  const media = Uri.joinPath(context.extensionUri, "media")
  const pages = new Set(
    fs
      .readdirSync(path.join(media.fsPath, "extra"))
      .filter((f) => f.endsWith(".html"))
      .map((f) => "extra/" + f),
  )
  function command(id, run) {
    context.subscriptions.push(vscode.commands.registerCommand("spaceship." + id, run))
  }

  function openPanel(binding, preset) {
    const resources = [media, Uri.joinPath(context.extensionUri, "web")]
    const make = (kind, title) =>
      ui.createWebviewPanel(kind, title, ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: resources })
    const panel = make("spaceship.writer", "Spaceship · " + path.basename(binding.doc.fileName))
    let revision = 0
    let gallery
    const jobs = new Map()
    let live = Boolean(workspace.getConfiguration("spaceship").get("model")?.trim())
    let seed = binding.doc.getText(binding.range)
    const sourceLabel = () => {
      const relative = workspace.asRelativePath(binding.doc.uri)
      return (binding.selected ? "Selection · " : "File · ") + (path.isAbsolute(relative) ? path.basename(relative) : relative)
    }

    function render(target, page) {
      const web = target.webview
      const html = fs.readFileSync(path.join(media.fsPath, page), "utf8")
      const assetDir = page.startsWith("extra/") ? Uri.joinPath(media, "extra") : media
      const bridge = web.asWebviewUri(Uri.joinPath(context.extensionUri, "web", "bridge.js"))
      const csp = `default-src 'none'; img-src ${web.cspSource} data:; style-src ${web.cspSource} 'unsafe-inline'; font-src ${web.cspSource}; script-src ${web.cspSource}; connect-src ${web.cspSource}; base-uri ${web.cspSource}`
      web.html = html
        .replace(
          "<head>",
          `<head><meta http-equiv="Content-Security-Policy" content="${escape(csp)}"><base href="${web.asWebviewUri(assetDir)}/"><meta name="spaceship-render" content="${++revision}"><meta name="spaceship-model" content="${escape(workspace.getConfiguration("spaceship").get("model"))}"><script src="${bridge}"></script>`,
        )
        .replace("<body>", page.startsWith("extra/") ? '<body><a href="../" style="color:inherit">← Back to Writing Desk</a>' : "<body>")
    }

    function navigate(from, href) {
      if (typeof href !== "string") return
      const url = new URL(href, "https://spaceship.invalid/" + from)
      if (url.origin !== "https://spaceship.invalid") return
      const next = url.pathname.slice(1)
      if (!next || next === "index.html") {
        panel.reveal()
        if (url.searchParams.get("preset") === "tension") panel.webview.postMessage({ type: "editor", action: "tension" })
        return
      }
      if (!pages.has(next)) return
      if (!gallery) {
        gallery = make("spaceship.gallery", "Spaceship · Design demos")
        gallery.onDidDispose(() => {
          gallery = undefined
        })
        gallery.webview.onDidReceiveMessage((msg) => {
          if (msg?.type === "navigate") navigate("extra/index.html", msg.href)
        })
      }
      render(gallery, next)
      gallery.reveal()
    }

    const changeFile = workspace.onDidRenameFiles(async ({ files }) => {
      for (const { oldUri, newUri } of files) {
        const old = binding.doc.uri
        if (old.scheme !== oldUri.scheme || old.authority !== oldUri.authority || !(old.path === oldUri.path || old.path.startsWith(oldUri.path + "/")))
          continue
        const next = await workspace.openTextDocument(newUri.with({ path: newUri.path + old.path.slice(oldUri.path.length) }))
        binding.doc = next
        if (next.getText() === binding.snapshot) binding.version = next.version
        else binding.version = -1
        panel.title = "Spaceship · " + path.basename(next.fileName)
        panel.webview.postMessage({ type: "editor", action: "source", label: sourceLabel() })
      }
    })

    async function write(text, copy) {
      if (typeof text !== "string") return
      if (copy) {
        const document = await workspace.openTextDocument({ language: "markdown", content: text })
        await ui.showTextDocument(document, { viewColumn: ViewColumn.One, preview: false })
        await vscode.commands.executeCommand("workbench.action.files.saveAs")
        return
      }
      const doc = binding.doc
      const conflict = () =>
        ui.showWarningMessage("The source changed or was closed. Choose Save As in the writing desk to keep this draft, or reopen the latest file.")
      if (doc.isClosed || doc.version !== binding.version || doc.getText() !== binding.snapshot) return conflict()
      const editor = await ui.showTextDocument(doc, { viewColumn: binding.column, preview: false })
      if (doc.version !== binding.version || doc.isClosed) return conflict()
      const start = doc.offsetAt(binding.range.start)
      const ok = await editor.edit((builder) => builder.replace(binding.range, text))
      if (!ok) return conflict()
      const normalized = text.replace(/\r\n|\r|\n/g, doc.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n")
      binding.range = new Range(doc.positionAt(start), doc.positionAt(start + normalized.length))
      binding.version = doc.version
      binding.snapshot = doc.getText()
      seed = normalized
      editor.selection = new Selection(binding.range.start, binding.range.end)
      panel.webview.postMessage({ type: "editor", action: "written" })
    }

    const msgListener = panel.webview.onDidReceiveMessage(async (msg) => {
      if (!msg || typeof msg !== "object") return
      try {
        if (msg.type === "ready") return panel.webview.postMessage({ type: "init", text: seed, live, preset, label: sourceLabel() })
        if (msg.type === "navigate") return navigate("index.html", msg.href)
        if (msg.type === "write" || msg.type === "copy") return await write(msg.text, msg.type === "copy")
        if (msg.type === "mode" && typeof msg.live === "boolean" && typeof msg.text === "string") {
          if (msg.live && !workspace.getConfiguration("spaceship").get("model")?.trim()) {
            await vscode.commands.executeCommand("spaceship.settings")
            return
          }
          for (const job of jobs.values()) job.abort()
          live = msg.live
          seed = msg.text
          preset = undefined
          render(panel, "index.html")
          return
        }
        if (msg.type === "abort") return jobs.get(msg.id)?.abort()
        if (
          msg.type !== "model" ||
          typeof msg.id !== "string" ||
          !/^[0-9a-f-]{36}$/.test(msg.id) ||
          jobs.has(msg.id) ||
          !["chat", "decisions"].includes(msg.route) ||
          typeof msg.body !== "string"
        )
          return
        const controller = new AbortController()
        const id = msg.id
        jobs.set(id, controller)
        const send = (data) => panel.webview.postMessage({ ...data, id })
        try {
          const body = JSON.parse(msg.body)
          const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)])
          const response = await modelResponse(msg.route, body, signal, context.secrets)
          await send({ type: "headers", status: response.status })
          if (response.body) {
            const decoder = new TextDecoder()
            for await (const chunk of response.body) {
              const text = decoder.decode(chunk, { stream: true })
              if (text && !(await send({ type: "chunk", text }))) {
                controller.abort()
                return
              }
            }
            const rest = decoder.decode()
            if (rest) await send({ type: "chunk", text: rest })
          }
          await send({ type: "end" })
        } catch (error) {
          if (!controller.signal.aborted) await send({ type: "error", message: error.message })
        } finally {
          jobs.delete(id)
        }
      } catch (error) {
        ui.showErrorMessage("Spaceship：" + error.message)
      }
    })
    panel.onDidDispose(() => {
      for (const job of jobs.values()) job.abort()
      msgListener.dispose()
      changeFile.dispose()
      gallery?.dispose()
    })
    render(panel, "index.html")
  }

  async function open(uri, selected = false) {
    const editor = ui.activeTextEditor
    const doc = uri ? await workspace.openTextDocument(uri) : (editor?.document ?? (await workspace.openTextDocument({ language: "markdown" })))
    const useSelection = selected && editor?.document === doc && !editor.selection.isEmpty
    const range = useSelection ? editor.selection : new Range(doc.positionAt(0), doc.positionAt(doc.getText().length))
    openPanel({ doc, range, selected: useSelection, column: editor?.viewColumn ?? ViewColumn.One, version: doc.version, snapshot: doc.getText() })
  }
  command("open", () => open(undefined, true))
  command("openFile", (uri) => open(uri))
  command("fromSelection", () => open(undefined, true))
  command("newDraft", async (folder) => {
    const parent = folder ?? workspace.workspaceFolders?.[0]?.uri
    const doc =
      parent?.scheme === "file"
        ? await workspace.openTextDocument(Uri.joinPath(parent, `draft-${Date.now()}.md`).with({ scheme: "untitled" }))
        : await workspace.openTextDocument({ language: "markdown" })
    const editor = await ui.showTextDocument(doc, { preview: false })
    await open(editor.document.uri)
  })
  command("settings", () => vscode.commands.executeCommand("workbench.action.openSettings", "@ext:brentlee-personal.spaceship-writer"))
  command("setKey", async () => {
    const key = await ui.showInputBox({ title: "CLIProxyAPI Key", prompt: "Save in VS Code SecretStorage", password: true, ignoreFocusOut: true })
    if (key?.trim()) await context.secrets.store("proxy-key", key.trim())
  })
}
module.exports = { activate }
