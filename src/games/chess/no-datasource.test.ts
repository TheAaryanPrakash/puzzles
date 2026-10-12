// Structural enforcement of CLAUDE.md's "Chess" rule: this game never calls the scored
// DataSource, usePuzzle, usePlay, finish or completeGame, and writes nothing to the `plays`
// table. Rather than trust that every future edit remembers this, scan chess's own source for
// the telltale imports/calls. One narrow exception: friend-mode code (src/games/chess/friends/)
// is allowed to import src/lib/data/chess.ts — the dedicated, non-scored chess backend file —
// since "Play a Friend" genuinely needs a backend; every other lib/data import stays forbidden.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CHESS_DIR = dirname(fileURLToPath(import.meta.url));
const ALLOWED_IMPORT_PATH = /\/lib\/data\/chess["']$/;

const FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\busePuzzle\s*\(/, reason: "calls usePuzzle(...)" },
  { pattern: /\busePlay\s*\(/, reason: "calls usePlay(...)" },
  { pattern: /\bcompleteGame\s*\(/, reason: "calls completeGame(...)" },
  { pattern: /\bdataSource\./, reason: "references dataSource.*" },
];

/** Every `from "..."` import path in the file, so the lib/data check can allow the one exact
 *  exception (lib/data/chess) instead of a single regex trying to express "all but one". */
function importPaths(source: string): string[] {
  return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) && entry !== "no-datasource.test.ts") {
      files.push(full);
    }
  }
  return files;
}

describe("chess never touches the DataSource", () => {
  const files = collectSourceFiles(CHESS_DIR);

  it("found more than a couple of source files to check (sanity check on the scan itself)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    const relative = file.slice(CHESS_DIR.length + 1);
    it(`${relative} doesn't import or call the DataSource layer`, () => {
      const source = readFileSync(file, "utf8");
      for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
        expect(pattern.test(source), `${relative} ${reason} — chess must stay local-only`).toBe(false);
      }
      for (const path of importPaths(source)) {
        const isLibData = path.includes("/lib/data/") || path.endsWith("/lib/data");
        if (isLibData && !ALLOWED_IMPORT_PATH.test(`${path}"`)) {
          expect.fail(`${relative} imports "${path}" — only lib/data/chess is allowed outside the scored DataSource`);
        }
        if (path.endsWith("/lib/hooks")) {
          expect.fail(`${relative} imports "${path}" (usePuzzle/usePlay/useStats/...)`);
        }
      }
    });
  }
});
