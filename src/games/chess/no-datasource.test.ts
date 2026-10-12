// Structural enforcement of CLAUDE.md's "Chess" rule: this game never calls the DataSource,
// usePuzzle, usePlay, finish or completeGame, and writes nothing to Supabase. Rather than trust
// that every future edit remembers this, scan chess's own source for the telltale imports/calls.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CHESS_DIR = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /from\s+["'].*\/lib\/data(?:\/|["'])/, reason: 'imports from "lib/data" (the DataSource)' },
  { pattern: /from\s+["'].*\/lib\/hooks["']/, reason: 'imports from "lib/hooks" (usePuzzle/usePlay/useStats/...)' },
  { pattern: /\busePuzzle\s*\(/, reason: "calls usePuzzle(...)" },
  { pattern: /\busePlay\s*\(/, reason: "calls usePlay(...)" },
  { pattern: /\bcompleteGame\s*\(/, reason: "calls completeGame(...)" },
  { pattern: /\bdataSource\./, reason: "references dataSource.*" },
];

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
    });
  }
});
