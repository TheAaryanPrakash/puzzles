// Exhaustive checks against the real generated output and the real shared country data. Lives
// under scripts/ (not src/games/flagle/logic.test.ts) because it reads files with node:fs —
// public/assets/shared/country-names.json sits outside tsconfig.app.json's "src" rootDir, and
// scripts/ isn't part of the `tsc -b` program, so that's fine here but would break `pnpm build`
// if done from a file under src/.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { addDays, dayIndex } from "../../src/lib/daily";
import { LAUNCH_DATE, SCHEDULE_DAYS } from "../../src/config";
import { buildSummary, isWon, type FlagleState } from "../../src/games/flagle/logic";

// Vitest's cwd is always the repo root, however `pnpm test`/`pnpm vitest` is invoked.
const ROOT = process.cwd();

const countryNames = JSON.parse(
  readFileSync(resolve(ROOT, "public/assets/shared/country-names.json"), "utf8"),
) as Record<string, { name: string; aliases: string[] }>;

const centroids = JSON.parse(
  readFileSync(resolve(ROOT, "public/assets/flagle/centroids.json"), "utf8"),
) as Record<string, [number, number]>;

const POOL_CODES = Object.keys(centroids);

describe("buildSummary never leaks the answer, for every generated pool country", () => {
  it("never contains the target's ISO code or name", () => {
    expect(POOL_CODES.length).toBeGreaterThan(0);
    for (const code of POOL_CODES) {
      const other = POOL_CODES.find((c) => c !== code)!;
      const state: FlagleState = { guesses: [other, code] };
      const summary = buildSummary(state, code, 42);
      expect(summary).not.toContain(code);
      expect(summary).not.toContain(countryNames[code].name);
      for (const alias of countryNames[code].aliases) expect(summary).not.toContain(alias);
    }
  });
});

describe("generated content/puzzles/flagle/*.json", () => {
  const dir = resolve(ROOT, "content/puzzles/flagle");
  const files = existsSync(dir) ? readdirSync(dir).sort() : [];

  it("has exactly SCHEDULE_DAYS files, one per scheduled day", () => {
    expect(files.length).toBe(SCHEDULE_DAYS);
    const expectedDates = new Set(
      Array.from({ length: SCHEDULE_DAYS }, (_, i) => `${addDays(LAUNCH_DATE, i)}.json`),
    );
    for (const file of files) expect(expectedDates.has(file)).toBe(true);
  });

  it("every day's payload code is a real, guessable pool country, and reserve is null", () => {
    for (const file of files) {
      const body = JSON.parse(readFileSync(resolve(dir, file), "utf8")) as {
        payload: { code: string };
        reserve: unknown;
      };
      expect(POOL_CODES).toContain(body.payload.code);
      expect(countryNames[body.payload.code]).toBeTruthy();
      expect(body.reserve).toBeNull();
    }
  });

  it("never repeats the same country on two consecutive days", () => {
    const codes = files.map((file) => {
      const body = JSON.parse(readFileSync(resolve(dir, file), "utf8")) as {
        payload: { code: string };
      };
      return body.payload.code;
    });
    for (let i = 1; i < codes.length; i++) expect(codes[i]).not.toBe(codes[i - 1]);
  });

  it("dayIndex round-trips every filename back to its position", () => {
    files.forEach((file, i) => {
      const date = file.replace(/\.json$/, "");
      expect(dayIndex(date)).toBe(i);
    });
  });
});
