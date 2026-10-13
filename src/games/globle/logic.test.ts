import { describe, expect, it } from "vitest";
import {
  appendGuess,
  buildCountryNameIndex,
  buildSummary,
  closestSoFar,
  colorForGuess,
  DEFAULT_STATE,
  isOver,
  isWon,
  proximityColor,
  proximityForGuess,
  resolveCountryGuess,
  SOLVED_COLOR,
  type GlobleState,
} from "./logic";
import type { CountryNameEntry } from "./worldData";

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

  // Redesign (2026-10): the heat scale now runs dark/muted plum (far) → bright coral (hot) —
  // the approved Checkpoint-1 direction (docs/redesign/checkpoint-1/colors.png) — rather than the
  // old pale-gold → deep-red desaturation. All three channels brighten monotonically with
  // proximity now, instead of green/blue falling.
  it("brightens toward hot coral (all channels rise) as proximity rises", () => {
    const channels = (s: string) => s.match(/\d+/g)!.map(Number);
    const [r0, g0, b0] = channels(proximityColor(0));
    const [r25, g25, b25] = channels(proximityColor(25));
    const [r75, g75, b75] = channels(proximityColor(75));
    const [r100, g100, b100] = channels(proximityColor(100));
    expect(r25).toBeGreaterThanOrEqual(r0);
    expect(r75).toBeGreaterThanOrEqual(r25);
    expect(r100).toBeGreaterThanOrEqual(r75);
    expect(g25).toBeGreaterThanOrEqual(g0);
    expect(g75).toBeGreaterThanOrEqual(g25);
    expect(g100).toBeGreaterThanOrEqual(g75);
    expect(b25).toBeGreaterThanOrEqual(b0);
    expect(b75).toBeGreaterThanOrEqual(b25);
    expect(b100).toBeGreaterThanOrEqual(b75);
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

describe("buildCountryNameIndex / resolveCountryGuess", () => {
  const codes = ["US", "GB", "FR"];
  const names: Record<string, CountryNameEntry> = {
    US: { name: "United States", aliases: ["USA", "United States of America", "America"] },
    GB: { name: "United Kingdom", aliases: ["UK", "Britain", "Great Britain"] },
    FR: { name: "France", aliases: [] },
  };
  const index = buildCountryNameIndex(codes, names);

  it("resolves a country's canonical name", () => {
    expect(resolveCountryGuess("France", index)).toBe("FR");
  });

  it("resolves an alias GlideCombobox's own label-only filter can't match live", () => {
    expect(resolveCountryGuess("USA", index)).toBe("US");
    expect(resolveCountryGuess("UK", index)).toBe("GB");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(resolveCountryGuess("  uSa  ", index)).toBe("US");
    expect(resolveCountryGuess("great britain", index)).toBe("GB");
  });

  it("returns null for no match", () => {
    expect(resolveCountryGuess("Narnia", index)).toBeNull();
  });

  it("skips a code missing from the names table instead of throwing", () => {
    const sparse = buildCountryNameIndex(["US", "ZZ"], names);
    expect(resolveCountryGuess("United States", sparse)).toBe("US");
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
