import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadGame,
  saveGame,
  clearGame,
  loadSettings,
  saveSettings,
  loadRecord,
  recordResult,
  emptyRecord,
} from "./storage";
import { createFreshGame, DEFAULT_SETTINGS } from "../logic";

const USER = "test-user";

beforeEach(() => {
  localStorage.clear();
});

describe("game storage", () => {
  it("round-trips a saved game", () => {
    const game = createFreshGame(DEFAULT_SETTINGS, () => 0);
    saveGame(USER, game);
    expect(loadGame(USER)).toEqual(game);
  });

  it("returns null when nothing is saved", () => {
    expect(loadGame(USER)).toBeNull();
  });

  it("clearGame removes it", () => {
    saveGame(USER, createFreshGame(DEFAULT_SETTINGS));
    clearGame(USER);
    expect(loadGame(USER)).toBeNull();
  });

  it("corrupt storage falls back to null instead of throwing", () => {
    localStorage.setItem("sansitas-puzzles:chess:game:" + USER, "{not json");
    expect(() => loadGame(USER)).not.toThrow();
    expect(loadGame(USER)).toBeNull();
  });

  it("two users don't see each other's games", () => {
    const gameA = createFreshGame({ ...DEFAULT_SETTINGS, difficulty: "easy" });
    const gameB = createFreshGame({ ...DEFAULT_SETTINGS, difficulty: "hard" });
    saveGame("user-a", gameA);
    saveGame("user-b", gameB);
    expect(loadGame("user-a")?.settings.difficulty).toBe("easy");
    expect(loadGame("user-b")?.settings.difficulty).toBe("hard");
  });

  it("a storage failure on save never throws", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => saveGame(USER, createFreshGame(DEFAULT_SETTINGS))).not.toThrow();
    spy.mockRestore();
  });

  it("a storage failure on load never throws and falls back to null", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadGame(USER)).toBeNull();
    spy.mockRestore();
  });
});

describe("settings storage", () => {
  it("defaults when nothing is saved", () => {
    expect(loadSettings(USER)).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips a saved choice", () => {
    const settings = { difficulty: "hard" as const, side: "black" as const, clockPreset: "5+0" as const };
    saveSettings(USER, settings);
    expect(loadSettings(USER)).toEqual(settings);
  });

  it("falls back to defaults on a malformed value", () => {
    localStorage.setItem("sansitas-puzzles:chess:settings:" + USER, JSON.stringify({ difficulty: "impossible" }));
    expect(loadSettings(USER)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("personal record", () => {
  it("starts empty", () => {
    expect(loadRecord(USER)).toEqual(emptyRecord());
  });

  it("tallies a result under the right difficulty", () => {
    recordResult(USER, "easy", "won", false);
    const record = loadRecord(USER);
    expect(record.easy).toEqual({ wins: 1, losses: 0, draws: 0 });
    expect(record.medium).toEqual({ wins: 0, losses: 0, draws: 0 });
  });

  it("keeps assisted results in a separate bucket from unassisted ones", () => {
    recordResult(USER, "hard", "lost", false);
    recordResult(USER, "hard", "lost", true);
    const record = loadRecord(USER);
    expect(record.hard).toEqual({ wins: 0, losses: 1, draws: 0 });
    expect(record.assisted.hard).toEqual({ wins: 0, losses: 1, draws: 0 });
  });

  it("accumulates across multiple results", () => {
    recordResult(USER, "medium", "won", false);
    recordResult(USER, "medium", "won", false);
    recordResult(USER, "medium", "drawn", false);
    expect(loadRecord(USER).medium).toEqual({ wins: 2, losses: 0, draws: 1 });
  });

  it("corrupt record storage falls back to empty instead of throwing", () => {
    localStorage.setItem("sansitas-puzzles:chess:record:" + USER, "nonsense");
    expect(loadRecord(USER)).toEqual(emptyRecord());
  });
});
