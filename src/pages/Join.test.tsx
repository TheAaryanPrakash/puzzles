import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import type { AuthStatus } from "../lib/auth";
import { Join } from "./Join";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { statusRef, joinWithInvite } = vi.hoisted(() => ({
  statusRef: { current: "signed-in-not-member" as AuthStatus },
  joinWithInvite: vi.fn(),
}));

// Real saveInviteCode/readInviteCode/clearInviteCode (they only touch localStorage) stay intact;
// only useAuth's status is driven per-test via statusRef.
vi.mock("../lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth")>();
  return {
    ...actual,
    useAuth: () => ({ status: statusRef.current, joinWithInvite }),
  };
});

let container: HTMLDivElement;
let root: Root;

function Landing() {
  const location = useLocation();
  return <div data-testid="landing">{location.pathname}</div>;
}

function SignInStub() {
  const location = useLocation();
  const state = location.state as { message?: string; code?: string } | null;
  return (
    <div data-testid="signin">
      <span data-testid="signin-message">{state?.message}</span>
      <span data-testid="signin-code">{state?.code}</span>
    </div>
  );
}

async function renderJoin(
  initialEntries: Array<string | { pathname: string; state?: unknown }>,
) {
  await act(async () => {
    root = createRoot(container);
    root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/join" element={<Join />} />
          <Route path="/signin" element={<SignInStub />} />
          <Route path="/wordle" element={<Landing />} />
          <Route path="/" element={<Landing />} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

/** Sets a controlled input's value the way a real keystroke would, so React's onChange fires. */
function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function fillForm(name: string, code: string) {
  await act(async () => {
    setInputValue(container.querySelector<HTMLInputElement>("#join-name")!, name);
    setInputValue(container.querySelector<HTMLInputElement>("#join-code")!, code);
  });
}

// Awaited fully: this only waits for the synchronous dispatch to flush into the DOM, not for
// handleSubmit's own `await joinWithInvite(...)` to settle, so the loading state is still
// observable afterwards when joinWithInvite's mock hasn't resolved yet.
async function submitForm() {
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  joinWithInvite.mockReset();
  statusRef.current = "signed-in-not-member";
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

describe("Join", () => {
  it("pre-fills the invite code from the URL when signed in but not a member", async () => {
    await renderJoin(["/join?code=sunflower-23"]);

    const codeInput = container.querySelector<HTMLInputElement>("#join-code")!;
    expect(codeInput.value).toBe("sunflower-23");
  });

  it("shows a loading state on the button while joining", async () => {
    let resolveJoin!: () => void;
    joinWithInvite.mockImplementation(() => new Promise<void>((resolve) => (resolveJoin = resolve)));
    await renderJoin([{ pathname: "/join" }]);
    await fillForm("Sansita", "sunflower-23");

    await submitForm();
    const button = container.querySelector("button[type=submit]")!;
    expect(button.textContent).toBe("Joining…");
    expect(button.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      resolveJoin();
      await flush();
    });
  });

  it("redirects to the hub after joining when no page was originally requested", async () => {
    joinWithInvite.mockResolvedValue(undefined);
    await renderJoin([{ pathname: "/join" }]);
    await fillForm("Sansita", "sunflower-23");

    await submitForm();
    await act(async () => {
      await flush();
    });

    expect(joinWithInvite).toHaveBeenCalledWith("sunflower-23", "Sansita");
    expect(container.querySelector("[data-testid=landing]")?.textContent).toBe("/");
  });

  it("redirects back to the originally-requested page after joining", async () => {
    joinWithInvite.mockResolvedValue(undefined);
    await renderJoin([
      { pathname: "/join", state: { from: { pathname: "/wordle", search: "", hash: "" } } },
    ]);
    await fillForm("Sansita", "sunflower-23");

    await submitForm();
    await act(async () => {
      await flush();
    });

    expect(container.querySelector("[data-testid=landing]")?.textContent).toBe("/wordle");
  });

  it("clears the saved invite code once joining succeeds", async () => {
    joinWithInvite.mockResolvedValue(undefined);
    localStorage.setItem("sansitas-puzzles:invite-code", "sunflower-23");
    await renderJoin([{ pathname: "/join" }]);
    await fillForm("Sansita", "sunflower-23");

    await submitForm();
    await act(async () => {
      await flush();
    });

    expect(localStorage.getItem("sansitas-puzzles:invite-code")).toBeNull();
  });

  it("shows a friendly error and resets loading when joining fails", async () => {
    joinWithInvite.mockRejectedValue(new Error("That invite code isn't right."));
    await renderJoin([{ pathname: "/join" }]);
    await fillForm("Sansita", "wrong-code");

    await submitForm();
    await act(async () => {
      await flush();
    });

    expect(container.querySelector("[role=alert]")?.textContent).toBe(
      "That invite code isn't right.",
    );
    const button = container.querySelector("button[type=submit]")!;
    expect(button.textContent).toBe("Join");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("when signed out, saves the invite code and sends the user to sign in", async () => {
    statusRef.current = "signed-out";
    await renderJoin(["/join?code=sunflower-23"]);

    expect(container.querySelector("[data-testid=signin]")).not.toBeNull();
    expect(container.querySelector("[data-testid=signin-message]")?.textContent).toBe(
      "Sign in with Google to join.",
    );
    expect(container.querySelector("[data-testid=signin-code]")?.textContent).toBe(
      "sunflower-23",
    );
    // Saved defensively, in case the redirect back from Google drops the `?code=` query param.
    expect(localStorage.getItem("sansitas-puzzles:invite-code")).toBe("sunflower-23");
  });

  it("when already a member, redirects straight to the hub", async () => {
    statusRef.current = "member";
    await renderJoin(["/join?code=sunflower-23"]);

    expect(container.querySelector("[data-testid=landing]")?.textContent).toBe("/");
  });
});
