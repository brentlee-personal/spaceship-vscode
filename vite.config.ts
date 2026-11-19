import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig, loadEnv } from "vite"

import { localFlight } from "./scripts/local-flight.ts"

export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, import.meta.dirname, ["VITE_", "CLIPROXY_", "DECISIONS_"])
  return {
    plugins: command === "serve" && !isPreview && env.VITE_CLIPROXY_MODEL ? [localFlight(env)] : [],
    base: "/spaceship/",
    build: {
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, "index.html"),
          ...Object.fromEntries(
            readdirSync(resolve(import.meta.dirname, "extra"))
              .filter((file) => file.endsWith(".html"))
              .map((file) => [`extra/${file.slice(0, -".html".length)}`, resolve(import.meta.dirname, "extra", file)]),
          ),
        },
      },
    },
  }
})
