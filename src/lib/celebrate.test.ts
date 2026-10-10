import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

import confetti from "canvas-confetti";
import { celebrate } from "./celebrate";

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
}

describe("celebrate", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fires confetti when motion is not reduced", () => {
    setReducedMotion(false);
    celebrate();
    expect(confetti).toHaveBeenCalledTimes(1);
  });

  it("does nothing when prefers-reduced-motion is set", () => {
    setReducedMotion(true);
    celebrate();
    expect(confetti).not.toHaveBeenCalled();
  });
});
