import { describe, it, expect } from "vitest";
import { scoreGuess } from "./wordle-score";

describe("scoreGuess", () => {
  it("LLAMA / HELLO — repeated guess letter, answer has fewer", () => {
    expect(scoreGuess("LLAMA", "HELLO")).toEqual([
      "present",
      "present",
      "absent",
      "absent",
      "absent",
    ]);
  });

  it("ABBEY / BABES — repeated guess letter alongside a correct match", () => {
    expect(scoreGuess("ABBEY", "BABES")).toEqual([
      "present",
      "present",
      "correct",
      "correct",
      "absent",
    ]);
  });

  it("SPEED / ERASE — repeated guess letter, answer has more than used", () => {
    expect(scoreGuess("SPEED", "ERASE")).toEqual([
      "present",
      "absent",
      "present",
      "present",
      "absent",
    ]);
  });

  it("all correct", () => {
    expect(scoreGuess("CRANE", "CRANE")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });

  it("all absent", () => {
    expect(scoreGuess("ZZZZZ", "CRANE")).toEqual([
      "absent",
      "absent",
      "absent",
      "absent",
      "absent",
    ]);
  });

  it("is case-insensitive", () => {
    expect(scoreGuess("crane", "CRANE")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });
});
