import { describe, it, expect, vi, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Keyboard } from "./Keyboard";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(onKey: (key: string) => void, extraProps: Record<string, unknown> = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(createElement(Keyboard, { onKey, ...extraProps }));
  });
}

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
  container?.remove();
  container = null;
});

describe("Keyboard physical key handling", () => {
  it("calls onKey for a plain letter", () => {
    const onKey = vi.fn();
    mount(onKey);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    });
    expect(onKey).toHaveBeenCalledWith("A");
  });

  it("ignores metaKey, ctrlKey and altKey combinations", () => {
    const onKey = vi.fn();
    mount(onKey);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", metaKey: true, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", altKey: true, bubbles: true }));
    });
    expect(onKey).not.toHaveBeenCalled();
  });

  it("ignores keys typed into an input, textarea or select", () => {
    const onKey = vi.fn();
    mount(onKey);
    for (const tag of ["input", "textarea", "select"]) {
      const el = document.createElement(tag);
      document.body.appendChild(el);
      act(() => {
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
      });
      el.remove();
    }
    expect(onKey).not.toHaveBeenCalled();
  });

  it("ignores keys typed into a contenteditable element", () => {
    const onKey = vi.fn();
    mount(onKey);
    const el = document.createElement("div");
    el.setAttribute("contenteditable", "true");
    document.body.appendChild(el);
    act(() => {
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    });
    expect(onKey).not.toHaveBeenCalled();
    el.remove();
  });

  it("ignores an event that already had preventDefault() called", () => {
    const onKey = vi.fn();
    mount(onKey);
    act(() => {
      const evt = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
      evt.preventDefault();
      window.dispatchEvent(evt);
    });
    expect(onKey).not.toHaveBeenCalled();
  });

  it("attaches no physical listener at all when physicalKeys is false", () => {
    const onKey = vi.fn();
    mount(onKey, { physicalKeys: false });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    });
    expect(onKey).not.toHaveBeenCalled();
  });

  it("still works by clicking an on-screen key when physicalKeys is false", () => {
    const onKey = vi.fn();
    mount(onKey, { physicalKeys: false });
    const button = container!.querySelector('button[aria-label="A"]') as HTMLButtonElement;
    act(() => {
      button.click();
    });
    expect(onKey).toHaveBeenCalledWith("A");
  });
});
