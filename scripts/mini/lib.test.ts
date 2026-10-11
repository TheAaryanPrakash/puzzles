import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/lib/daily";
import {
  assignMains,
  findIsolatedCells,
  isSaturday,
  isUsableClue,
  numberGrid,
  parseArchiveGrid,
  parseCsv,
  pickClue,
  rankClues,
  reserveFor,
  toMiniClue,
  type RawArchivePuzzle,
} from "./lib";

describe("parseCsv", () => {
  it("parses plain rows", () => {
    expect(parseCsv("id,clue,answer\n0,Feline,cat\n")).toEqual([
      ["id", "clue", "answer"],
      ["0", "Feline", "cat"],
    ]);
  });

  it("handles a quoted field containing a comma", () => {
    expect(parseCsv('1,"Pea, e.g",cribbage marker\n')).toEqual([["1", "Pea, e.g", "cribbage marker"]]);
  });

  it("handles doubled quotes as an escaped quote", () => {
    expect(parseCsv('30,"""Dick Tracy"" character Trueheart",tess\n')).toEqual([
      ["30", '"Dick Tracy" character Trueheart', "tess"],
    ]);
  });

  it("handles a file with no trailing newline", () => {
    expect(parseCsv("a,b")).toEqual([["a", "b"]]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\nc,d\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("parseArchiveGrid", () => {
  it("parses a square grid of letters and blanks", () => {
    const raw: RawArchivePuzzle = {
      print_date: "2020-01-01",
      puzzle_id: 1,
      board: {
        cells: [
          { guess: "C" }, { guess: "A" }, { guess: "T" },
          { guess: "A" }, { blank: true }, { blank: true },
          { guess: "R" }, { blank: true }, { blank: true },
        ],
      },
    };
    const grid = parseArchiveGrid(raw);
    expect(grid).toEqual({
      date: "2020-01-01",
      size: 3,
      letters: ["C", "A", "T", "A", null, null, "R", null, null],
    });
  });

  it("rejects a non-square cell count", () => {
    const raw: RawArchivePuzzle = { print_date: "x", puzzle_id: 1, board: { cells: [{ guess: "A" }, { guess: "B" }] } };
    expect(parseArchiveGrid(raw)).toBeNull();
  });

  it("rejects a cell whose guess isn't a single letter (rebus square)", () => {
    const raw: RawArchivePuzzle = {
      print_date: "x",
      puzzle_id: 1,
      board: { cells: [{ guess: "A" }, { guess: "-" }, { guess: "B" }, { blank: true }] },
    };
    expect(parseArchiveGrid(raw)).toBeNull();
  });

  it("normalizes guesses to uppercase", () => {
    const raw: RawArchivePuzzle = {
      print_date: "x",
      puzzle_id: 1,
      board: { cells: [{ guess: "a" }, { guess: "b" }, { guess: "c" }, { guess: "d" }] },
    };
    expect(parseArchiveGrid(raw)?.letters).toEqual(["A", "B", "C", "D"]);
  });
});

describe("numberGrid", () => {
  it("numbers a 3x3 grid per the standard crossword rule", () => {
    // C A T
    // A # #
    // R # #
    const letters = ["C", "A", "T", "A", null, null, "R", null, null];
    const grid = numberGrid(3, letters);
    expect(grid.across).toEqual([{ number: 1, row: 0, col: 0, length: 3, answer: "CAT" }]);
    expect(grid.down).toEqual([{ number: 1, row: 0, col: 0, length: 3, answer: "CAR" }]);
    expect(grid.cells[0]).toEqual({ answer: "C", number: 1 });
    expect(grid.cells[1]).toEqual({ answer: "A" }); // no number: not the start of any ≥2 entry
  });

  it("assigns separate numbers to across-only and down-only starts", () => {
    // A B
    // C #
    const letters = ["A", "B", "C", null];
    const grid = numberGrid(2, letters);
    // (0,0) starts both across "AB" and down "AC" -> number 1
    // (0,1) starts nothing new (down run there is length 1)
    expect(grid.across).toEqual([{ number: 1, row: 0, col: 0, length: 2, answer: "AB" }]);
    expect(grid.down).toEqual([{ number: 1, row: 0, col: 0, length: 2, answer: "AC" }]);
  });

  it("numbers sequentially left-to-right, top-to-bottom", () => {
    // A B
    // C D
    const letters = ["A", "B", "C", "D"];
    const grid = numberGrid(2, letters);
    const numbers = grid.cells.map((c) => c?.number).filter((n) => n !== undefined);
    expect(numbers).toEqual([1, 2, 3]); // (0,0), (0,1) down-start, (1,0) down-start
  });
});

describe("findIsolatedCells", () => {
  it("is empty for a fully-covered grid", () => {
    const letters = ["C", "A", "T", "A", null, null, "R", null, null];
    const grid = numberGrid(3, letters);
    expect(findIsolatedCells(3, grid)).toEqual([]);
  });

  it("flags a white cell with no ≥2-length entry in either direction", () => {
    // A # A
    // # # #
    // A # A
    const letters = ["A", null, "A", null, null, null, "A", null, "A"];
    const grid = numberGrid(3, letters);
    expect(findIsolatedCells(3, grid)).toEqual([0, 2, 6, 8]);
  });
});

describe("isUsableClue", () => {
  it("rejects wordplay, cross-references and years", () => {
    expect(isUsableClue("Cat, maybe?")).toBe(false);
    expect(isUsableClue("See 5-Across")).toBe(false);
    expect(isUsableClue("With 11-Down, a vehicle")).toBe(false);
    expect(isUsableClue("Big event of 1969")).toBe(false);
    expect(isUsableClue("Film from 2020")).toBe(false);
  });

  it("accepts a plain factual clue", () => {
    expect(isUsableClue("Feline pet")).toBe(true);
  });

  it("rejects empty or whitespace-only clues", () => {
    expect(isUsableClue("   ")).toBe(false);
  });
});

describe("rankClues", () => {
  it("prefers recurring clues, then shorter ones", () => {
    const ranked = rankClues(["Feline", "House pet", "Feline", "Pet that purrs", "Feline"]);
    expect(ranked[0]).toBe("Feline");
  });

  it("drops empty entries and dedupes exact text", () => {
    expect(rankClues(["Feline", "", "  ", "Feline"])).toEqual(["Feline"]);
  });
});

describe("pickClue", () => {
  it("picks deterministically from the ranked pool given a seeded rng", () => {
    const rng = mulberry32(1);
    const picked = pickClue(["Feline", "House pet", "Pet that purrs"], undefined, rng);
    expect(picked.source).toBe("dataset");
    expect(["Feline", "House pet", "Pet that purrs"]).toContain(picked.clue);
  });

  it("varies the pick across calls with a continuing rng stream", () => {
    const rng = mulberry32(7);
    const pool = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const picks = Array.from({ length: 20 }, () => pickClue(pool, undefined, rng).clue);
    expect(new Set(picks).size).toBeGreaterThan(1);
  });

  it("falls back to the written clue when there are no dataset candidates", () => {
    const rng = mulberry32(1);
    const picked = pickClue([], "A hand-written clue", rng);
    expect(picked).toEqual({ clue: "A hand-written clue", source: "written" });
  });

  it("throws when neither a dataset candidate nor a written clue exists", () => {
    const rng = mulberry32(1);
    expect(() => pickClue([], undefined, rng)).toThrow();
  });
});

describe("toMiniClue", () => {
  it("merges the grid entry with the picked clue", () => {
    const entry = { number: 1, row: 0, col: 0, length: 3, answer: "CAT" };
    expect(toMiniClue(entry, { clue: "Feline", source: "written" })).toEqual({
      number: 1,
      row: 0,
      col: 0,
      length: 3,
      answer: "CAT",
      clue: "Feline",
      source: "written",
    });
  });
});

describe("isSaturday", () => {
  it("identifies Saturdays correctly", () => {
    expect(isSaturday("2026-10-17")).toBe(true); // Sat
    expect(isSaturday("2026-10-18")).toBe(false); // Sun
    expect(isSaturday("2026-10-24")).toBe(true); // next Sat
  });
});

describe("assignMains", () => {
  const days = ["2026-10-12", "2026-10-13", "2026-10-17", "2026-10-14"]; // Mon, Tue, Sat, Wed

  it("gives Saturdays a 7x7 and other days a 5x5, leaving the rest as leftovers", () => {
    const fives = ["5a", "5b", "5c"];
    const sevens = ["7a", "7b"];
    const { mains, leftover } = assignMains(fives, sevens, days);
    expect(mains.get("2026-10-17")).toBe("7a");
    expect(mains.get("2026-10-12")).toBe("5a");
    expect(mains.get("2026-10-13")).toBe("5b");
    expect(mains.get("2026-10-14")).toBe("5c");
    expect(leftover).toEqual(["7b"]);
  });

  it("throws when a pool runs out", () => {
    expect(() => assignMains(["5a"], ["7a"], days)).toThrow(/5x5/);
    expect(() => assignMains(["5a", "5b", "5c"], [], days)).toThrow(/7x7/);
  });
});

describe("reserveFor", () => {
  it("cycles through the pool by day number", () => {
    const pool = ["x", "y", "z"];
    expect(reserveFor(pool, 0)).toBe("x");
    expect(reserveFor(pool, 1)).toBe("y");
    expect(reserveFor(pool, 3)).toBe("x");
    expect(reserveFor(pool, 4)).toBe("y");
  });

  it("throws on an empty pool", () => {
    expect(() => reserveFor([], 0)).toThrow();
  });
});
