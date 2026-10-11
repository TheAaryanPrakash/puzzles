import { describe, expect, it } from "vitest";
import {
  appendGuess,
  buildSummary,
  closestSoFar,
  colorForGuess,
  DEFAULT_STATE,
  isOver,
  isWon,
  proximityColor,
  proximityForGuess,
  SOLVED_COLOR,
  type GlobleState,
} from "./logic";

const ALL_CODES = [
  "FR", "DE", "ES", "IT", "GB", "US", "CA", "IN", "PK", "CN", "JP", "AU", "BR", "AR", "ZA",
  "EG", "NG", "RU", "MX", "ET",
];

describe("hasGuessed / isWon / isOver", () => {
  it("is not won before the secret is guessed", () => {
    const state: GlobleState = { guesses: [{ code: "DE", km: 0 }] };
    expect(isWon(state, "FR")).toBe(false);
    expect(isOver(state, "FR")).toBe(false);
  });

  it("is won the moment the secret is guessed", () => {
    const state: GlobleState = { guesses: [{ code: "DE", km: 0 }, { code: "FR", km: 0 }] };
    expect(isWon(state, "FR")).toBe(true);
    expect(isOver(state, "FR")).toBe(true);
  });

  it("has no loss condition — unlimited guesses never end the game on their own", () => {
    const manyGuesses: GlobleState = {
      guesses: ALL_CODES.filter((c) => c !== "FR").map((code) => ({ code, km: 500 })),
    };
    expect(isOver(manyGuesses, "FR")).toBe(false);
  });
});

describe("appendGuess", () => {
  it("adds a new guess", () => {
    const next = appendGuess(DEFAULT_STATE, { code: "FR", km: 300 });
    expect(next.guesses).toEqual([{ code: "FR", km: 300 }]);
  });

  it("is a no-op for a country already guessed (no duplicates, no re-score)", () => {
    const state: GlobleState = { guesses: [{ code: "FR", km: 300 }] };
    const next = appendGuess(state, { code: "FR", km: 999 });
    expect(next).toBe(state); // same reference: truly a no-op
    expect(next.guesses).toHaveLength(1);
  });

  it("guessing the secret directly wins in one guess", () => {
    const next = appendGuess(DEFAULT_STATE, { code: "FR", km: 0 });
    expect(isWon(next, "FR")).toBe(true);
  });
});

describe("proximityForGuess / proximityColor", () => {
  it("0 km (neighbour or exact match) is 100% proximity", () => {
    expect(proximityForGuess({ code: "DE", km: 0 })).toBe(100);
  });

  it("proximity is monotonic: a smaller distance never scores lower", () => {
    const near = proximityForGuess({ code: "DE", km: 100 });
    const far = proximityForGuess({ code: "AU", km: 15000 });
    expect(near).toBeGreaterThan(far);
  });

  it("proximityColor is defined and clamped at both extremes", () => {
    expect(proximityColor(0)).toMatch(/^rgb\(/);
    expect(proximityColor(100)).toMatch(/^rgb\(/);
    expect(proximityColor(-10)).toBe(proximityColor(0));
    expect(proximityColor(150)).toBe(proximityColor(100));
  });

  it("desaturates toward deep red (green and blue fall) as proximity rises", () => {
    const channels = (s: string) => s.match(/\d+/g)!.map(Number);
    const [, g0, b0] = channels(proximityColor(0));
    const [, g25, b25] = channels(proximityColor(25));
    const [, g75, b75] = channels(proximityColor(75));
    const [, g100, b100] = channels(proximityColor(100));
    expect(g25).toBeLessThanOrEqual(g0);
    expect(g75).toBeLessThanOrEqual(g25);
    expect(g100).toBeLessThanOrEqual(g75);
    expect(b25).toBeLessThanOrEqual(b0);
    expect(b75).toBeLessThanOrEqual(b25);
    expect(b100).toBeLessThanOrEqual(b75);
  });
});

describe("colorForGuess", () => {
  it("the correct guess always gets the distinct solved color, even at 0 km", () => {
    expect(colorForGuess({ code: "FR", km: 0 }, "FR")).toBe(SOLVED_COLOR);
  });

  it("a wrong guess at 0 km (a neighbour) gets the warm scale's hottest color, not solved", () => {
    const neighbourColor = colorForGuess({ code: "DE", km: 0 }, "FR");
    expect(neighbourColor).not.toBe(SOLVED_COLOR);
    expect(neighbourColor).toBe(proximityColor(100));
  });
});

describe("closestSoFar", () => {
  it("sorts guesses by distance ascending", () => {
    const state: GlobleState = {
      guesses: [
        { code: "AU", km: 15000 },
        { code: "DE", km: 50 },
        { code: "IN", km: 3000 },
      ],
    };
    expect(closestSoFar(state).map((g) => g.code)).toEqual(["DE", "IN", "AU"]);
  });

  it("breaks ties by guess order", () => {
    const state: GlobleState = {
      guesses: [
        { code: "DE", km: 100 },
        { code: "ES", km: 100 },
      ],
    };
    expect(closestSoFar(state).map((g) => g.code)).toEqual(["DE", "ES"]);
  });

  it("is empty for no guesses", () => {
    expect(closestSoFar(DEFAULT_STATE)).toEqual([]);
  });
});

describe("buildSummary — spoiler safety", () => {
  it("never contains the secret's code or name, win or lose, for the whole answer pool", () => {
    for (const secret of ALL_CODES) {
      const guesses: GlobleState["guesses"] = ALL_CODES.filter((c) => c !== secret)
        .slice(0, 4)
        .map((code) => ({ code, km: 1234 }));
      const unsolved = buildSummary({ guesses }, secret, 7);
      expect(unsolved).not.toContain(secret);

      const solved: GlobleState = { guesses: [...guesses, { code: secret, km: 0 }] };
      const summary = buildSummary(solved, secret, 7);
      expect(summary).not.toContain(secret);
      expect(summary).toContain("✅");
    }
  });

  it("includes the puzzle number and guess count", () => {
    const state: GlobleState = { guesses: [{ code: "DE", km: 50 }, { code: "FR", km: 0 }] };
    const summary = buildSummary(state, "FR", 42);
    expect(summary).toContain("#42");
    expect(summary).toContain("2 guesses");
  });

  it("marks an unsolved game distinctly from a solved one", () => {
    const state: GlobleState = { guesses: [{ code: "DE", km: 50 }] };
    expect(buildSummary(state, "FR", 1)).toContain("unsolved");
  });
});

describe("state round-trips through JSON unchanged", () => {
  it("serialises and restores an identical game", () => {
    const state: GlobleState = {
      guesses: [
        { code: "DE", km: 50 },
        { code: "IN", km: 3000 },
      ],
    };
    const restored = JSON.parse(JSON.stringify(state)) as GlobleState;
    expect(restored).toEqual(state);
    expect(closestSoFar(restored)).toEqual(closestSoFar(state));
  });

  it("survives the brief {} state right after start()", () => {
    const fresh = { ...DEFAULT_STATE, ...({} as Partial<GlobleState>) };
    expect(fresh.guesses).toEqual([]);
    expect(() => isOver(fresh, "FR")).not.toThrow();
  });
});
