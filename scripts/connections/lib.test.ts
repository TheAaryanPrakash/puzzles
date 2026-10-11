import { describe, expect, it } from "vitest";
import {
  parseCsv,
  parseCsvRows,
  groupRowsByPuzzle,
  validatePuzzle,
  schedulePuzzles,
  type ConnectionsPuzzle,
  type RawPuzzle,
} from "./lib";

describe("parseCsv", () => {
  it("parses plain comma-separated rows", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles a quoted field containing a comma", () => {
    expect(parseCsv('1,2023-09-11,"20,000",NUMBERS,3,3,2\n')).toEqual([
      ["1", "2023-09-11", "20,000", "NUMBERS", "3", "3", "2"],
    ]);
  });

  it("handles a quoted field containing an escaped quote", () => {
    expect(parseCsv('1,"say ""hi""",2\n')).toEqual([["1", 'say "hi"', "2"]]);
  });

  it("handles a file with no trailing newline", () => {
    expect(parseCsv("a,b")).toEqual([["a", "b"]]);
  });
});

describe("parseCsvRows", () => {
  it("maps the header row into named fields and drops the header itself", () => {
    const csv =
      "Game ID,Puzzle Date,Word,Group Name,Group Level,Starting Row,Starting Column\n" +
      "1,2023-06-12,SNOW,WET WEATHER,0,1,1\n";
    expect(parseCsvRows(csv)).toEqual([
      {
        gameId: "1",
        puzzleDate: "2023-06-12",
        word: "SNOW",
        groupName: "WET WEATHER",
        groupLevel: "0",
        startingRow: "1",
        startingColumn: "1",
      },
    ]);
  });
});

describe("groupRowsByPuzzle", () => {
  it("groups rows by Game ID, preserving row order within a puzzle", () => {
    const rows = parseCsvRows(
      "Game ID,Puzzle Date,Word,Group Name,Group Level,Starting Row,Starting Column\n" +
        "1,2023-06-12,A,G1,0,1,1\n" +
        "2,2023-06-13,X,G2,0,1,1\n" +
        "1,2023-06-12,B,G1,0,1,2\n",
    );
    const puzzles = groupRowsByPuzzle(rows);
    expect(puzzles).toHaveLength(2);
    expect(puzzles[0].gameId).toBe("1");
    expect(puzzles[0].rows.map((r) => r.word)).toEqual(["A", "B"]);
    expect(puzzles[1].gameId).toBe("2");
  });
});

function makeValidPuzzleCsv(gameId: string, date: string): string {
  const groups = [
    { name: "WET WEATHER", level: 0, words: ["SNOW", "RAIN", "SLEET", "HAIL"] },
    { name: "KEYBOARD KEYS", level: 1, words: ["SHIFT", "TAB", "ENTER", "SPACE"] },
    { name: "PALINDROMES", level: 2, words: ["LEVEL", "RACECAR", "KAYAK", "CIVIC"] },
    { name: "BOXING TERMS", level: 3, words: ["JAB", "HOOK", "RING", "BELL"] },
  ];
  const lines: string[] = [];
  let row = 1;
  for (const g of groups) {
    g.words.forEach((w, col) => {
      lines.push(`${gameId},${date},${w},${g.name.includes(",") ? `"${g.name}"` : g.name},${g.level},${row},${col + 1}`);
    });
    row++;
  }
  return lines.join("\n") + "\n";
}

function parseOneRawPuzzle(csvBody: string): RawPuzzle {
  const header = "Game ID,Puzzle Date,Word,Group Name,Group Level,Starting Row,Starting Column\n";
  const rows = parseCsvRows(header + csvBody);
  return groupRowsByPuzzle(rows)[0];
}

describe("validatePuzzle", () => {
  it("accepts a well-formed puzzle and normalises groups ordered by level", () => {
    const raw = parseOneRawPuzzle(makeValidPuzzleCsv("1", "2023-06-12"));
    const result = validatePuzzle(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.puzzle.groups.map((g) => g.level)).toEqual([0, 1, 2, 3]);
    expect(result.puzzle.groups[0].label).toBe("WET WEATHER");
    expect(result.puzzle.groups[0].words).toEqual(["SNOW", "RAIN", "SLEET", "HAIL"]);
  });

  it("rejects a puzzle without exactly 16 rows", () => {
    const raw = parseOneRawPuzzle(makeValidPuzzleCsv("1", "2023-06-12") + "1,2023-06-12,EXTRA,WET WEATHER,0,5,1\n");
    const result = validatePuzzle(raw);
    expect(result.ok).toBe(false);
  });

  it("rejects a puzzle with a duplicate word", () => {
    const csv = makeValidPuzzleCsv("1", "2023-06-12").replace("HAIL", "SNOW");
    const raw = parseOneRawPuzzle(csv);
    const result = validatePuzzle(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/duplicate word/);
  });

  it("rejects a group that doesn't have exactly 4 words", () => {
    const lines = makeValidPuzzleCsv("1", "2023-06-12").trim().split("\n");
    // Reassign the last row's group to a group that already has 4, leaving one group with 3.
    lines[15] = lines[15].replace("BOXING TERMS", "WET WEATHER").replace(",3,", ",0,");
    const raw = parseOneRawPuzzle(lines.join("\n") + "\n");
    const result = validatePuzzle(raw);
    expect(result.ok).toBe(false);
  });

  it("rejects a group level outside 0-3 (simulates a split-number corruption)", () => {
    // Replace all 4 rows' level consistently, so this hits the integer-range check rather than
    // the "inconsistent levels within one group" check.
    const csv = makeValidPuzzleCsv("1", "2023-06-12").replaceAll(",BOXING TERMS,3,", ",BOXING TERMS,x,");
    const raw = parseOneRawPuzzle(csv);
    const result = validatePuzzle(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/not an integer 0-3/);
  });

  it("rejects levels that don't cover 0-3 exactly once each", () => {
    const csv = makeValidPuzzleCsv("1", "2023-06-12").replace(/,3,(\d),(\d)\n/g, ",2,$1,$2\n");
    const raw = parseOneRawPuzzle(csv);
    const result = validatePuzzle(raw);
    expect(result.ok).toBe(false);
  });
});

describe("schedulePuzzles", () => {
  function fakePuzzle(id: number): ConnectionsPuzzle {
    return { groups: [{ label: `g${id}`, level: 0, words: [`${id}a`, `${id}b`, `${id}c`, `${id}d`] }] };
  }

  it("splits into non-repeating mains and a disjoint reserve pool", () => {
    const pool = Array.from({ length: 20 }, (_, i) => fakePuzzle(i));
    const { mains, reservePool } = schedulePuzzles(pool, 31, 12);
    expect(mains).toHaveLength(12);
    expect(reservePool).toHaveLength(8);
    const mainLabels = new Set(mains.map((p) => p.groups[0].label));
    expect(mainLabels.size).toBe(12); // no repeats among mains
    for (const r of reservePool) {
      expect(mainLabels.has(r.groups[0].label)).toBe(false); // never also a main
    }
  });

  it("is deterministic for a given seed", () => {
    const pool = Array.from({ length: 20 }, (_, i) => fakePuzzle(i));
    const a = schedulePuzzles(pool, 31, 12);
    const b = schedulePuzzles(pool, 31, 12);
    expect(a.mains.map((p) => p.groups[0].label)).toEqual(b.mains.map((p) => p.groups[0].label));
    expect(a.reservePool.map((p) => p.groups[0].label)).toEqual(b.reservePool.map((p) => p.groups[0].label));
  });

  it("throws if there aren't enough valid puzzles for every day", () => {
    const pool = Array.from({ length: 5 }, (_, i) => fakePuzzle(i));
    expect(() => schedulePuzzles(pool, 31, 12)).toThrow();
  });

  it("throws if nothing is left over for the reserve pool", () => {
    const pool = Array.from({ length: 12 }, (_, i) => fakePuzzle(i));
    expect(() => schedulePuzzles(pool, 31, 12)).toThrow();
  });
});
