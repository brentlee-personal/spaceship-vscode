// Run after npm run dev -- --host 127.0.0.1. This is a browser smoke, not a VS Code Extension Host test.
import { chromium } from "playwright-core"
import assert from "node:assert/strict"
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] })
try {
  const page = await browser.newPage()
  const errors = [],
    calls = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript(() => {
    window.exports = []
    window.acquireVsCodeApi = () => ({ getState: () => undefined, setState: () => {}, postMessage: (message) => window.exports.push(message) })
  })
  page.on("request", (req) => {
    if (req.method() === "POST") calls.push(req.url())
  })
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173/spaceship/extra/backbone.html")
  await page.getByRole("button", { name: "Add block", exact: true }).click()
  await page.getByRole("button", { name: "Add block", exact: true }).click()
  const blocks = page.locator("details")
  await blocks.nth(0).locator('[data-field="name"]').fill("Conclusion")
  await blocks.nth(0).locator('[data-field="purpose"]').fill("Conclude")
  await blocks.nth(0).locator('[data-field="changes"]').fill("Reader can decide")
  await blocks.nth(0).locator('[data-field="needs"]').fill("evidence")
  await blocks.nth(1).locator('[data-field="name"]').fill("Evidence")
  await blocks.nth(1).locator('[data-field="purpose"]').fill("Establish facts")
  await blocks.nth(1).locator('[data-field="changes"]').fill("Reader knows the facts")
  await blocks.nth(1).locator('[data-field="produces"]').fill("evidence")
  await page.getByRole("button", { name: "Run outline check", exact: true }).click()
  assert.match(await page.locator("#findings").innerText(), /Missing earlier output: evidence/)
  await page.locator("#findings button").click()
  assert.equal(
    await blocks
      .nth(0)
      .locator('[data-field="name"]')
      .evaluate((e) => e === document.activeElement),
    true,
  )
  await blocks.nth(1).getByRole("button", { name: "Move up", exact: true }).click()
  assert.match(await page.locator("#status").innerText(), /Structural checks passed/)
  assert.equal(await blocks.nth(1).locator('[data-field="purpose"]').inputValue(), "Conclude")
  await page.getByRole("button", { name: "Export Markdown copy", exact: true }).click()
  const exports = await page.evaluate(() => window.exports)
  assert.equal(exports[0].type, "exportOutline")
  assert.ok(exports[0].content.indexOf("## Evidence") < exports[0].content.indexOf("## Conclusion"))
  assert.deepEqual(errors, [])
  assert.deepEqual(calls, [])
  console.log("PASS: author creates stubs, checks, follows finding, reorders without loss, exports; zero model POSTs")
} finally {
  await browser.close()
}
