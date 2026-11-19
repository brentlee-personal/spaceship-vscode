import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { parseEnv } from "node:util"
import type { Plugin, ProxyOptions } from "vite"

/** Keep the gateway credential and SSH connection on the local dev server. */
export function localFlight(env: Record<string, string>): Plugin {
  const key = parseEnv(readFileSync(env.CLIPROXY_ENV_FILE, "utf8")).CLIPROXY_API_KEY
  if (!key) throw new Error("CLIPROXY_ENV_FILE must contain CLIPROXY_API_KEY")
  const proxyPort = Number(env.CLIPROXY_PORT || 8317)
  const port = Number(env.DECISIONS_TUNNEL_PORT)
  const host = env.DECISIONS_SSH_HOST
  const remotePort = Number(env.DECISIONS_REMOTE_PORT)
  const proxy = (target: string, path: string, headers?: Record<string, string>): ProxyOptions => ({
    target,
    changeOrigin: true,
    headers,
    rewrite: () => path,
    bypass(req) {
      const host = req.headers.host
      if (
        req.method !== "POST" ||
        !/^127\.0\.0\.1:\d+$/.test(host ?? "") ||
        req.headers.origin !== `http://${host}` ||
        req.headers["content-type"] !== "application/json"
      )
        return false
    },
  })

  return {
    name: "local-flight",
    config() {
      return {
        server: {
          host: "127.0.0.1",
          cors: false,
          strictPort: true,
          proxy: {
            "^/spaceship/api/chat$": proxy(`http://127.0.0.1:${proxyPort}`, "/v1/chat/completions", { Authorization: `Bearer ${key}` }),
            "^/spaceship/api/decisions$": proxy(`http://127.0.0.1:${port}`, "/v1/systemone"),
          },
        },
      }
    },
    configureServer(server) {
      let closing = false
      let reconnect: ReturnType<typeof setTimeout>
      let child: ReturnType<typeof spawn>
      function connect() {
        child = spawn(
          "ssh",
          [
            "-NT",
            "-o",
            "BatchMode=yes",
            "-o",
            "ExitOnForwardFailure=yes",
            "-o",
            "ConnectTimeout=8",
            "-o",
            "ServerAliveInterval=15",
            "-o",
            "ServerAliveCountMax=2",
            "-L",
            `127.0.0.1:${port}:127.0.0.1:${remotePort}`,
            host,
          ],
          { stdio: ["ignore", "ignore", "inherit"] },
        )
        child.on("error", (error) => server.config.logger.error(error.message))
        child.once("close", () => {
          if (!closing) reconnect = setTimeout(connect, 5000)
        })
      }
      connect()
      function stop() {
        closing = true
        clearTimeout(reconnect)
        child.kill()
      }
      process.once("exit", stop)
      server.httpServer?.once("close", () => {
        process.off("exit", stop)
        stop()
      })
    },
  }
}
