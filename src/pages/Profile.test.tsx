import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { Profile } from "./Profile";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { memberRef, updateDisplayName, signOut } = vi.hoisted(() => ({
  memberRef: { current: { userId: "u1", displayName: "Sansita" } },
  updateDisplayName: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  useAuth: () => ({ member: memberRef.current, signOut, updateDisplayName }),
}));

vi.mock("../lib/hooks", () => ({
  useStats: () => ({ stats: {}, loading: false }),
}));

vi.mock("../routes", () => ({ allGameMetas: [] }));

let container: HTMLDivElement;
let root: Root;

async function renderProfile() {
  await act(async () => {
    root = createRoot(container);
    root.render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function findButton(text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === text,
  );
  if (!button) throw new Error(`test bug: no button with text "${text}"`);
  return button;
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  memberRef.current = { userId: "u1", displayName: "Sansita" };
  updateDisplayName.mockReset();
  signOut.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("Profile", () => {
  it("shows whatever name the auth context holds after saving — the server's value, not just the typed one", async () => {
    // updateDisplayName resolving doesn't, by itself, change what useAuth() returns here — a real
    // AuthProvider only updates `member` once it re-reads the canonical row from the database
    // (see src/lib/auth.tsx's fetchProfile). Simulate that by having the mock flip memberRef to a
    // server-canonical value that differs from what was typed, once the "request" resolves.
    updateDisplayName.mockImplementation(async (name: string) => {
      void name;
      memberRef.current = { userId: "u1", displayName: "Sansita (verified)" };
    });
    await renderProfile();

    await act(async () => {
      findButton("Edit name").click();
    });
    const input = container.querySelector<HTMLInputElement>("#profile-name")!;
    await act(async () => {
      setInputValue(input, "Totally Different Name");
    });
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await flush();
    });

    expect(updateDisplayName).toHaveBeenCalledWith("Totally Different Name");
    expect(container.querySelector("h1")?.textContent).toBe("Sansita (verified)");
  });

  it("shows a friendly error and stays in edit mode when saving fails", async () => {
    updateDisplayName.mockRejectedValue(new Error("Name must be between 1 and 30 characters."));
    await renderProfile();

    await act(async () => {
      findButton("Edit name").click();
    });
    const input = container.querySelector<HTMLInputElement>("#profile-name")!;
    await act(async () => {
      setInputValue(input, "");
      setInputValue(input, "X".repeat(40));
    });
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await flush();
    });

    expect(container.querySelector("[role=alert]")?.textContent).toBe(
      "Name must be between 1 and 30 characters.",
    );
    expect(container.querySelector("#profile-name")).not.toBeNull();
  });
});
