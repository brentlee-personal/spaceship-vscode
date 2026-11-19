const vscode = require("vscode")
const { routeDecisions } = require("./decision-router.cjs")
const { readFile } = require("node:fs/promises")
const { parseEnv } = require("node:util")
const { spawn } = require("node:child_process")

function port(value) {
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error("请检查 Spaceship 端口设置。")
  return value
}

async function modelResponse(route, body, signal, secrets, decisionModel = false) {
  if (route === "decisions") {
    const config = vscode.workspace.getConfiguration("spaceship")
    return routeDecisions(body, signal, {
      provider: decisionProvider(config),
      llm: (payload, bounded) => modelResponse("chat", payload, bounded, secrets, true),
      plumb: (bounded) => modelResponse("plumb", body, bounded, secrets),
    })
  }
  const config = vscode.workspace.getConfiguration("spaceship")
  const headers = { "Content-Type": "application/json" }
  if (route === "chat") {
    const file = config.get("keyFile")
    const key = (await secrets.get("proxy-key")) || process.env.CLIPROXY_API_KEY || (file && parseEnv(await readFile(file, "utf8")).CLIPROXY_API_KEY)
    if (!key) throw new Error("请先执行「Spaceship: 设置 CLIProxyAPI 密钥」，或配置本机凭据文件。")
    headers.Authorization = `Bearer ${key}`
    body.model = (decisionModel && config.get("decisionModel")?.trim()) || config.get("model")
    if (!body.model?.trim()) throw new Error("Configure a Spaceship writing model first.")
    return fetch(`http://127.0.0.1:${port(config.get("proxyPort"))}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
      redirect: "error",
    })
  }
  if (route !== "plumb") throw new Error("未知模型接口。")
  const url = `http://127.0.0.1:${port(config.get("decisionsPort"))}/v1/systemone`
  const host = config.get("decisionsSshHost")
  if (!host) return fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal, redirect: "error" })
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(host)) throw new Error("请填写 SSH 配置中的主机别名。")
  // The remote command is fixed. Manuscripts travel on stdin.
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ssh",
      [
        "-T",
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=8",
        host,
        `curl -sS --noproxy '*' --max-time 120 -H 'Content-Type: application/json' --data-binary @- -w '\\n%{http_code}' '${url}'`,
      ],
      { signal, stdio: ["pipe", "pipe", "ignore"] },
    )
    let output = ""
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      output += chunk
    })
    child.on("error", reject)
    child.stdin.on("error", reject)
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error("无法通过 SSH 连接 Decisions 服务。"))
      const tail = output.lastIndexOf("\n")
      const status = Number(output.slice(tail + 1))
      if (tail < 0 || status < 200 || status > 599) return reject(new Error("Decisions 响应无效。"))
      resolve(new Response(output.slice(0, tail), { status }))
    })
    child.stdin.end(JSON.stringify(body))
  })
}
module.exports = { modelResponse }

function decisionProvider(config) {
  const explicit = (key) => {
    const value = config.inspect?.(key)
    return value?.globalValue !== undefined || value?.workspaceValue !== undefined || value?.workspaceFolderValue !== undefined
  }
  if (explicit("decisionProvider")) return config.get("decisionProvider", "llm")
  return explicit("decisionsPort") || Boolean(config.get("decisionsSshHost")) ? "plumb" : "llm"
}
