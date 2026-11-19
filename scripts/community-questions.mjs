/** Maintainer utility. With --reply it answers explicit requests for the VS Code port. */
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { homedir } from "node:os"

const upstream = "chuanqisun/spaceship"
const project = "https://github.com/brentlee-personal/spaceship-vscode"
const reply = process.argv.includes("--reply")
const state = process.env.SPACESHIP_QUESTIONS_STATE || join(homedir(), ".local", "state", "spaceship-writer", "questions.json")
const api = (route, method, input) =>
  JSON.parse(
    execFileSync("gh", ["api", route, ...(method ? ["-X", method, "--input", "-"] : [])], {
      input: input && JSON.stringify(input),
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    }),
  )
const readPages = (route) => {
  const items = []
  for (let page = 1; ; page++) {
    const batch = api(route + (route.includes("?") ? "&" : "?") + `per_page=100&page=${page}`)
    items.push(...batch)
    if (batch.length < 100) return items
  }
}
const cutoff = new Date().toISOString()
function save(since) {
  mkdirSync(dirname(state), { recursive: true })
  writeFileSync(state + ".tmp", JSON.stringify({ since }), { mode: 0o600 })
  renameSync(state + ".tmp", state)
}
if (process.argv.includes("--initialize")) {
  try {
    readFileSync(state)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
    save(cutoff)
  }
  console.log("Question cursor ready.")
} else {
  const since = JSON.parse(readFileSync(state, "utf8")).since
  const repo = `repos/${upstream}/issues`
  const from = "?since=" + encodeURIComponent(since)
  const issues = readPages(repo + from + "&state=open")
  const comments = readPages(repo + "/comments" + from)
  const actor = api("user").login
  const seen = new Set()
  let posted = 0,
    matched = 0
  for (const item of [...issues, ...comments]) {
    if (item.created_at <= since || item.created_at > cutoff || item.pull_request || item.user?.type !== "User" || item.user.login === actor) continue
    const content = [item.title, item.body].filter(Boolean).join("\n").replace(/^>.*$/gm, "")
    // Only a direct request for an editor port/link qualifies. A generic feature request or bug report stays unanswered.
    const direct =
      /(?:is there|where (?:can|could) i (?:get|find|download)|looking for|anyone (?:made|built|know)|有没有|哪里(?:能|可以)?(?:下载|找到)|求).{0,85}?(?:vs\s*code|visual studio code).{0,30}?(?:extension|plugin|port\b|version|integration|扩展|插件|版本)/i
    if (!direct.test(content) || content.includes(project)) continue
    const number = item.number ?? Number(item.issue_url.split("/").at(-1))
    if (seen.has(number)) continue
    seen.add(number)
    const issue = api(repo + "/" + number)
    if (issue.state !== "open" || issue.pull_request || issue.body?.includes(project)) continue
    if (readPages(`${repo}/${number}/comments`).some((c) => c.body?.includes(project))) continue
    matched++
    if (reply) {
      const body = /[\u3400-\u9fff]/.test(content)
        ? `我维护了一个独立的 VS Code 版本，支持 Markdown 文件、选区写回和多维续写。仓库和安装说明：${project}。`
        : `I maintain an independent VS Code port with Markdown file and selection support, native undo, and multi-dimensional steering. The source and installation instructions are here: ${project}.`
      const result = api(`${repo}/${number}/comments`, "POST", { body })
      console.log(result.html_url)
      posted++
    } else console.log(issue.html_url)
  }
  if (reply) save(cutoff)
  console.log(`Explicit requests: ${matched}; replies: ${posted}`)
}
