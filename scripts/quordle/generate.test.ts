import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assignDailyAnswers } from "./schedule";
import { buildExclusionMap, readExcludedAnswer } from "./generate";

const tempDirs: string[] = [];

async function makeFakeWordleDir(filesByDate: Record<string, unknown>): Promise<string> {
  const dir = await mkdtemp(resolve(tmpdir(), "quordle-fake-wordle-"));
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  for (const [date, payload] of Object.entries(filesByDate)) {
    await writeFile(resolve(dir, `${date}.json`), JSON.stringify({ payload, reserve: null }), "utf8");
  }
  return dir;
}

afterEach(async () => {
  while (tempDirs.length) await rm(tempDirs.pop()!, { recursive: true, force: true });
});

describe("readExcludedAnswer", () => {
  it("reads a { answer } payload, uppercased", async () => {
    const dir = await makeFakeWordleDir({ "2026-10-17": { answer: "crane" } });
    expect(await readExcludedAnswer(dir, "2026-10-17")).toBe("CRANE");
  });

  it("reads a bare string payload", async () => {
    const dir = await makeFakeWordleDir({ "2026-10-17": "crane" });
    expect(await readExcludedAnswer(dir, "2026-10-17")).toBe("CRANE");
  });

  it("returns undefined when the day file doesn't exist", async () => {
    const dir = await makeFakeWordleDir({});
    expect(await readExcludedAnswer(dir, "2026-10-17")).toBeUndefined();
  });
});

describe("--exclude <dir> end to end against a fake Wordle folder", () => {
  const days = ["2026-10-17", "2026-10-18", "2026-10-19"];

  it("keeps every Quordle answer different from that day's Wordle answer", async () => {
    const pool = Array.from({ length: 30 }, (_, i) => `WORD${i.toString().padStart(2, "0")}`);
    const baseline = assignDailyAnswers({ seed: 2, days, pool });
    // Make the fake Wordle folder collide with day 1's actual first assigned Quordle answer.
    const collidingAnswer = baseline.get(days[1])![0];

    const dir = await makeFakeWordleDir({
      [days[0]]: { answer: "zzzzz" }, // no collision
      [days[1]]: { answer: collidingAnswer.toLowerCase() },
      // days[2] has no Wordle file at all -> no exclusion for it.
    });

    const excludedByDate = await buildExclusionMap(days, dir);
    const result = assignDailyAnswers({ seed: 2, days, pool, excludedByDate });

    expect(result.get(days[1])).not.toContain(collidingAnswer);
    for (const date of days) expect(result.get(date)).toHaveLength(4);
  });
});
