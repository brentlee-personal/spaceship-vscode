import { chromium } from "playwright-core"
import assert from "node:assert/strict"
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript(() => {
    window.calls = 0
    window.recover = false
    window.spaceshipEditor = {
      model: "test-model",
      ready: Promise.resolve({ text: "Original manuscript 原文。", label: "Test manuscript", live: true }),
      onEditor() {},
      post() {},
      async request(route) {
        if (route !== "chat") return new Response("{}", { status: 200 })
        window.calls++
        if (window.recover) {
          window.recover = false
          return new Response("data: " + JSON.stringify({ choices: [{ delta: { content: " Continued text." } }] }) + "\n\ndata: [DONE]\n\n")
        }
        return new Response("private provider response", { status: 401 })
      },
    }
  })
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173/spaceship/")
  await page.locator("#writing-dialog[open]").waitFor()
  await page.locator('#writing-dialog button[type="submit"]').click()
  await page.waitForFunction(() => document.querySelector("#writing-status").textContent.includes("API key"))
  assert.equal(await page.evaluate(() => window.calls), 1)
  await page.waitForTimeout(2200)
  assert.equal(await page.evaluate(() => window.calls), 1)
  await page.locator("#write-story").click()
  assert.equal(await page.locator("#manuscript").inputValue(), "Original manuscript 原文。")
  await page.evaluate(() => {
    window.recover = true
  })
  await page.locator('#writing-dialog button[type="submit"]').click()
  // The explicit retry succeeds; the next automatic refill fails and must stop too.
  await page.waitForFunction(() => window.calls === 3 && document.querySelector("#writing-status").textContent.includes("API key"))
  await page.waitForTimeout(2200)
  assert.equal(await page.evaluate(() => window.calls), 3)
  await page.locator("#write-story").click()
  assert.equal(await page.locator("#manuscript").inputValue(), "Original manuscript 原文。 Continued text.")
  assert.deepEqual(errors, [])
  console.log("PASS: manual 401 -> preserved manuscript -> explicit retry -> automatic 401 -> no repeated requests; no page errors")
} finally {
  await browser.close()
}
