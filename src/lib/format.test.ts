import { describe, it, expect } from "vitest";
import { formatGuesses } from "./format";

describe("formatGuesses", () => {
  it("singularizes exactly 1 guess", () => {
    expect(formatGuesses(1)).toBe("1 guess");
  });

  it("pluralizes everything else, including 0", () => {
    expect(formatGuesses(0)).toBe("0 guesses");
    expect(formatGuesses(2)).toBe("2 guesses");
    expect(formatGuesses(6)).toBe("6 guesses");
  });
});
