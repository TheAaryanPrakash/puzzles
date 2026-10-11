import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router";
import { SignIn } from "./SignIn";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { signInWithGoogle } = vi.hoisted(() => ({ signInWithGoogle: vi.fn() }));

// Real saveInviteCode/readInviteCode (they only touch localStorage) stay intact; only
// signInWithGoogle is mocked.
vi.mock("../lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth")>();
  return {
    ...actual,
    useAuth: () => ({ signInWithGoogle }),
  };
});

let container: HTMLDivElement;
let root: Root;

async function renderSignIn(initialEntries: Array<string | { pathname: string; state?: unknown }>) {
  await act(async () => {
    root = createRoot(container);
    root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

function clickContinue() {
  return act(async () => {
    container.querySelector("button")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  signInWithGoogle.mockReset();
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("SignIn", () => {
  it("shows the default message and signs in with no redirect path when there's no invite code", async () => {
    signInWithGoogle.mockResolvedValue(undefined);
    await renderSignIn([{ pathname: "/signin" }]);

    expect(container.textContent).toContain("An invite-only puzzle club for friends");

    await clickContinue();
    expect(signInWithGoogle).toHaveBeenCalledWith(undefined);
  });

  it("shows the join message and signs in with a /join redirect when the invite code comes from navigation state", async () => {
    signInWithGoogle.mockResolvedValue(undefined);
    await renderSignIn([
      { pathname: "/signin", state: { message: "Sign in with Google to join.", code: "sunflower-23" } },
    ]);

    expect(container.textContent).toContain("Sign in with Google to join.");

    await clickContinue();
    expect(signInWithGoogle).toHaveBeenCalledWith("/join?code=sunflower-23");
  });

  it("falls back to the locally-saved invite code when navigation state has none", async () => {
    signInWithGoogle.mockResolvedValue(undefined);
    localStorage.setItem("sansitas-puzzles:invite-code", "sunflower-23");
    await renderSignIn([{ pathname: "/signin" }]);

    await clickContinue();
    expect(signInWithGoogle).toHaveBeenCalledWith("/join?code=sunflower-23");
  });

  it("shows a friendly error and resets loading when sign-in fails", async () => {
    signInWithGoogle.mockRejectedValue(new Error("Something went wrong. Please try again."));
    await renderSignIn([{ pathname: "/signin" }]);

    await clickContinue();
    await act(async () => {
      await flush();
    });

    expect(container.querySelector("[role=alert]")?.textContent).toBe(
      "Something went wrong. Please try again.",
    );
    const button = container.querySelector("button")!;
    expect(button.textContent).toContain("Continue with Google");
    expect(button.hasAttribute("disabled")).toBe(false);
  });
});
