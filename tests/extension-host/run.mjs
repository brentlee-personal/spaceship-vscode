import { runTests } from "@vscode/test-electron"
import { fileURLToPath } from "node:url"
await runTests({
  version: "1.105.1",
  extensionDevelopmentPath: fileURLToPath(new URL("../../extension", import.meta.url)),
  extensionTestsPath: fileURLToPath(new URL("./suite.cjs", import.meta.url)),
  launchArgs: ["--disable-extensions", "--skip-welcome", "--skip-release-notes"],
})
