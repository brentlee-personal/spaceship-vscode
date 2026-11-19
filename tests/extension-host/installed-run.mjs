import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from "@vscode/test-electron"
import { createHash } from "node:crypto"
import { spawnSync, execFileSync } from "node:child_process"
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve, basename } from "node:path"
import { fileURLToPath } from "node:url"
const repo = fileURLToPath(new URL("../../", import.meta.url))
const files = (await readdir(join(repo, "extension"))).filter((f) => f.endsWith(".vsix"))
if (files.length !== 1) throw Error("Expected exactly one same-job VSIX; never select by public release version")
const vsix = join(repo, "extension", files[0])
const sha256 = createHash("sha256")
  .update(await readFile(vsix))
  .digest("hex")
const scratch = await mkdtemp(join(tmpdir(), "spaceship-installed-smoke-"))
const extensions = join(scratch, "extensions"),
  userData = join(scratch, "user-data"),
  harness = join(scratch, "harness")
const evidence = resolve(repo, "test-evidence", "installed-vsix.json")
await mkdir(harness, { recursive: true })
await mkdir(extensions)
await mkdir(userData)
await mkdir(join(repo, "test-evidence"), { recursive: true })
await writeFile(
  join(harness, "package.json"),
  JSON.stringify({
    name: "isolated-package-test-harness",
    publisher: "spaceship-tests",
    version: "0.0.0",
    engines: { vscode: "^1.105.0" },
    main: "index.cjs",
    activationEvents: ["*"],
  }),
)
await writeFile(join(harness, "index.cjs"), "exports.activate = () => {}\n")
const source = join(scratch, "synthetic.md")
await writeFile(source, "# Synthetic manuscript\nOriginal on-disk content.\n")
const executable = await downloadAndUnzipVSCode("1.105.1")
// Suppress helper-added defaults; both explicit directories below are fresh scratch paths.
const [cli, ...args] = resolveCliArgsFromVSCodeExecutablePath(executable, { reuseMachineInstall: true })
try {
  const install = spawnSync(cli, [...args, "--user-data-dir", userData, "--extensions-dir", extensions, "--install-extension", vsix], { encoding: "utf8" })
  process.stdout.write(install.stdout || "")
  process.stderr.write(install.stderr || "")
  if (install.error || install.status !== 0) throw Error(`Isolated VSIX installation failed: ${install.error?.message || install.status}`)
  await runTests({
    vscodeExecutablePath: executable,
    extensionDevelopmentPath: harness,
    extensionTestsPath: join(repo, "tests/extension-host/installed-suite.cjs"),
    launchArgs: ["--user-data-dir", userData, "--extensions-dir", extensions],
    extensionTestsEnv: {
      SPACESHIP_TEST_EXTENSIONS: extensions,
      SPACESHIP_TEST_SOURCE: source,
      SPACESHIP_TEST_EVIDENCE: evidence,
      SPACESHIP_TEST_VSIX_SHA256: sha256,
      SPACESHIP_TEST_VSIX_NAME: basename(vsix),
      SPACESHIP_TEST_CHECKOUT: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(),
      SPACESHIP_TEST_EXPECTED_VERSION: JSON.parse(await readFile(join(repo, "extension/package.json"), "utf8")).version,
    },
  })
  if (
    createHash("sha256")
      .update(await readFile(vsix))
      .digest("hex") !== sha256
  )
    throw Error("VSIX changed during validation")
  console.log(`PASS unchanged same-job VSIX SHA256 ${sha256}`)
} finally {
  await rm(scratch, { recursive: true, force: true })
}
