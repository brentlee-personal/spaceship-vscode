import { execFileSync } from "node:child_process"
const sources = [
  ["续写旋钮", "chuanqisun/spaceship", "commits/master", "4ddd4d1061aa5f22113d5dd03462b3b3e5f506a6", ".sha"],
  [
    "文档编辑",
    "microsoft/vscode-extension-samples",
    "commits?path=custom-editor-sample/src/catScratchEditor.ts&per_page=1",
    "2f83557a56c37a5e48943ea0201e1729708690b6",
    ".[0].sha",
  ],
]
for (const [ability, repo, api, base, filter] of sources) {
  const head = execFileSync("gh", ["api", `repos/${repo}/${api}`, "--jq", filter], { encoding: "utf8" }).trim()
  if (!/^[0-9a-f]{40}$/.test(head)) throw new Error(`无法确认 ${repo} 的修订`)
  console.log(`${ability} · ${base === head ? "与已核对修订一致" : "有更新，待验证"} · https://github.com/${repo}/compare/${base}...${head}`)
}
