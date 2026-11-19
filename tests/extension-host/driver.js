// Test-only script loaded by a real VS Code Webview. No mock acquireVsCodeApi.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const button = (name, root = document) => [...root.querySelectorAll("button")].find((b) => b.textContent === name)
const click = (name, root) => {
  const b = button(name, root)
  if (!b || b.disabled) throw Error(`Missing or disabled button: ${name}`)
  b.click()
}
const field = (root, key, value) => {
  const input = root.querySelector(`[data-field="${key}"]`)
  if (!input) throw Error(`Missing field: ${key}`)
  input.value = value
  input.dispatchEvent(new Event("input", { bubbles: true }))
}
const blocks = () => [...document.querySelectorAll("details")]
const requireTrue = (condition, message) => {
  if (!condition) throw Error(message)
}
const title = (value) => {
  const input = document.querySelector("#title")
  input.value = value
  input.dispatchEvent(new Event("input", { bubbles: true }))
}
try {
  // Wait for production module handlers, rather than faking the application's bridge.
  for (let attempt = 0; !blocks().length && attempt < 100; attempt++) {
    button("Add block")?.click()
    await sleep(100)
  }
  requireTrue(blocks().length === 1, "Production module did not initialize")
  for (let i = 1; i < 4; i++) click("Add block")
  for (const [i, name] of ["Chapter A", "Scene A", "Chapter B", "Scene B"].entries()) {
    field(blocks()[i], "name", name)
    field(blocks()[i], "purpose", "Synthetic purpose")
    field(blocks()[i], "changes", "Synthetic change")
    field(blocks()[i], "level", i % 2 ? "2" : "1")
  }
  requireTrue(button("Remove block", blocks()[2]).disabled, "Parent removal must be disabled")
  requireTrue(button("Move down", blocks()[1]).disabled, "Only child must not cross parent boundary")
  click("Move up", blocks()[2])
  requireTrue(
    blocks()
      .map((b) => b.querySelector('[data-field="name"]').value)
      .join("|") === "Chapter B|Scene B|Chapter A|Scene A",
    "Subtree move changed ownership",
  )
  click("Move down", blocks()[0])
  requireTrue(
    blocks()
      .map((b) => b.querySelector('[data-field="name"]').value)
      .join("|") === "Chapter A|Scene A|Chapter B|Scene B",
    "Subtree round trip failed",
  )
  click("Run outline check")
  requireTrue(!document.querySelector("#findings").children.length, "Unexpected structural finding")
  title("HOST SMOKE: chapters")
  click("Export Markdown copy")
  // Reuse the real panel with a wholly synthetic nonfiction premise mismatch.
  for (let i = 0; i < 4; i++) field(blocks()[i], "level", "1")
  field(blocks()[0], "name", "Registration chart")
  field(blocks()[0], "produces", "all registrations")
  field(blocks()[1], "name", "Approval inference")
  field(blocks()[1], "needs", "approved counts on the same basis")
  click("Run outline check")
  requireTrue(
    document.querySelector("#findings").textContent.includes("Missing earlier output: approved counts on the same basis"),
    "Nonfiction missing premise not flagged",
  )
  document.querySelector("#findings button").click()
  requireTrue(document.activeElement === blocks()[1].querySelector("input"), "Finding did not focus inference")
  field(blocks()[0], "produces", "approved counts on the same basis")
  requireTrue(!document.querySelector("#findings").children.length, "Corrected evidence did not clear finding")
  requireTrue(blocks()[2].querySelector('[data-field="name"]').value === "Chapter B", "Unrelated block changed")
  title("HOST SMOKE: evidence repaired")
  click("Export Markdown copy")
} catch (error) {
  title(`HOST SMOKE FAILURE: ${error.message}`)
  button("Export Markdown copy")?.click()
  throw error
}
