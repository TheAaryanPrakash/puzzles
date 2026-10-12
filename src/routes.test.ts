import { describe, it, expect } from "vitest";
import { allGameMetas, gameMetas, scoredGameMetas } from "./routes";

describe("scoredGameMetas", () => {
  it("is exactly the 14 daily puzzle games", () => {
    expect(scoredGameMetas).toHaveLength(14);
  });

  it("excludes chess", () => {
    expect(scoredGameMetas.some((m) => m.id === "chess")).toBe(false);
  });

  it("excludes dev-only scaffolding ids", () => {
    expect(scoredGameMetas.some((m) => m.id.startsWith("_"))).toBe(false);
  });

  it("is stable regardless of import.meta.env.PROD (unlike gameMetas)", () => {
    // allGameMetas/gameMetas may differ from each other depending on PROD, but scoredGameMetas
    // doesn't depend on that at all — it's derived straight from allGameMetas.
    expect(scoredGameMetas.every((m) => allGameMetas.includes(m))).toBe(true);
    expect(scoredGameMetas).toHaveLength(14);
  });
});

describe("chess in the registry", () => {
  it("is discovered and marked unscored", () => {
    const chess = allGameMetas.find((m) => m.id === "chess");
    expect(chess).toBeDefined();
    expect(chess?.scored).toBe(false);
  });

  it("still shows up in gameMetas (the Hub's card list)", () => {
    expect(gameMetas.some((m) => m.id === "chess")).toBe(true);
  });

  it("sits last in order", () => {
    const chess = allGameMetas.find((m) => m.id === "chess")!;
    const others = allGameMetas.filter((m) => m.id !== "chess" && !m.id.startsWith("_"));
    expect(others.every((m) => m.order < chess.order)).toBe(true);
  });
});
