import { describe, it, expect } from "vitest";
import { isPlural, isPastTense, buildGuessList, buildAnswerPool, WORD_LENGTH } from "./words";

describe("isPlural", () => {
  const enable = new Set(["card", "cross", "bonus"]);

  it("filters a word whose 's'-stripped stem is a real word", () => {
    expect(isPlural("cards", enable)).toBe(true);
  });

  it("keeps a word that merely ends in 's' with no valid stem", () => {
    expect(isPlural("cross", enable)).toBe(false);
    expect(isPlural("bonus", enable)).toBe(false);
  });

  it("keeps a word not ending in 's'", () => {
    expect(isPlural("card", enable)).toBe(false);
  });
});

describe("isPastTense", () => {
  const enable = new Set(["act", "speed"]);

  it("filters a word whose 'ed'-stripped stem is a real word", () => {
    expect(isPastTense("acted", enable)).toBe(true);
  });

  it("keeps a word ending in 'ed' with no valid stem", () => {
    expect(isPastTense("speed", enable)).toBe(false);
  });

  it("keeps a word not ending in 'ed'", () => {
    expect(isPastTense("act", enable)).toBe(false);
  });
});

describe("buildGuessList", () => {
  it("keeps only 5-letter alphabetic words, sorted", () => {
    const enable = new Set(["crane", "hi", "aahed", "don't", "zebra"]);
    expect(buildGuessList(enable)).toEqual(["aahed", "crane", "zebra"]);
  });
});

describe("buildAnswerPool", () => {
  it("intersects ENABLE with the ranked common list, within the rank cutoff", () => {
    const enable = new Set(["crane", "about", "zonal"]);
    const commonByRank = ["about", "zonal", "crane"]; // rank order
    const pool = buildAnswerPool({ enable, commonByRank, blocklist: new Set() });
    expect(pool).toEqual(["about", "zonal", "crane"]);
  });

  it("drops words past the rank cutoff", () => {
    const enable = new Set(["crane"]);
    const commonByRank = Array.from({ length: 20000 }, (_, i) => (i === 19999 ? "crane" : `x${i}`));
    const pool = buildAnswerPool({ enable, commonByRank, blocklist: new Set() });
    expect(pool).not.toContain("crane");
  });

  it("drops blocklisted words even if otherwise eligible", () => {
    const enable = new Set(["crude"]);
    const pool = buildAnswerPool({
      enable,
      commonByRank: ["crude"],
      blocklist: new Set(["crude"]),
    });
    expect(pool).toEqual([]);
  });

  it("drops plurals and past tenses", () => {
    const enable = new Set(["cross", "card", "acted", "act", "crane"]);
    const pool = buildAnswerPool({
      enable,
      commonByRank: ["cross", "cards", "acted", "crane"],
      blocklist: new Set(),
    });
    // "cards" has stem "card" (real word) -> plural, dropped. "acted" has stem "act" -> past tense, dropped.
    // "cross" has no valid 4-letter stem -> kept. "crane" is plain -> kept.
    expect(pool).toEqual(["cross", "crane"]);
  });

  it("never returns a word of the wrong length", () => {
    const enable = new Set(["ab", "crane", "abcdefg"]);
    const pool = buildAnswerPool({
      enable,
      commonByRank: ["ab", "crane", "abcdefg"],
      blocklist: new Set(),
    });
    expect(pool).toEqual(["crane"]);
    expect(pool.every((w) => w.length === WORD_LENGTH)).toBe(true);
  });

  it("de-duplicates repeated entries in the common list", () => {
    const enable = new Set(["crane"]);
    const pool = buildAnswerPool({
      enable,
      commonByRank: ["crane", "crane"],
      blocklist: new Set(),
    });
    expect(pool).toEqual(["crane"]);
  });
});
