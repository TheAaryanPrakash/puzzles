import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { Join } from "./Join";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const joinWithInvite = vi.fn();
vi.mock("../lib/auth", () => ({
  useAuth: () => ({ joinWithInvite }),
}));

let container: HTMLDivElement;
let root: Root;

function Landing() {
  const location = useLocation();
  return <div data-testid="landing">{location.pathname}</div>;
}

async function renderJoin(initialEntries: Array<{ pathname: string; state?: unknown }>) {
  await act(async () => {
    root = createRoot(container);
    root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/join" element={<Join />} />
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
});
