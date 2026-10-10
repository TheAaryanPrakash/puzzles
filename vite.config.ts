/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Dev server port is set per agent (see prompts/<agent>.md) so 15 worktrees can run at once.
const port = Number(process.env.PORT) || 5173;

/**
 * Serves content/puzzles/<gameId>/<date>.json to the local data adapter, for dev only.
 * `configureServer` only runs under `vite dev`/`vite serve`, never under `vite build` — so this
 * is a stronger guarantee than a runtime `import.meta.env.DEV` check: puzzle content can never
 * end up as bytes in dist/, not even in an unreached code-split chunk.
 */
function puzzleContentDevServer(): Plugin {
  return {
    name: "puzzle-content-dev-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/__content\/([\w-]+)\/(\d{4}-\d{2}-\d{2})\.json(?:\?.*)?$/);
        if (!match) return next();
        const [, gameId, date] = match;
        try {
          const file = resolve(process.cwd(), "content/puzzles", gameId, `${date}.json`);
          const data = await readFile(file, "utf8");
          res.setHeader("Content-Type", "application/json");
          res.end(data);
        } catch {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end("null");
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), puzzleContentDevServer()],
  server: {
    port,
    strictPort: true,
    watch: {
      // Without this, the main checkout's dev server also reacts to every agent worktree's files.
      ignored: ["**/.claude/**"],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // supabase/tests/schema.test.mjs is run directly via `pnpm test:db` (it takes a CLI arg),
    // not picked up as a Vitest spec.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/**", "supabase/**"],
  },
});
