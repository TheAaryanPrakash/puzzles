import { useEffect, useState } from "react";
import { allGameMetas } from "../routes";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import type { GameMeta } from "../lib/types";

// Load every game's theme.css so the swatches below reflect real values, not brand defaults.
import.meta.glob("../games/*/theme.css", { eager: true });
import "../styles/dev-sample-themes.css";

// Fonts the three built-in sample themes below reference. Real games import their own fonts in
// their own index.tsx; this page previews before any of those exist.
import "@fontsource/libre-franklin/600.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/quicksand/600.css";

// Illustrative themes so this page is useful solo, before any real game's theme.css lands.
// Ids starting with "_sample-" never collide with a real game (every real `data-game` is a
// src/games/ folder name) and are filtered out of allGameMetas's production consumers the same
// way "_example" already is.
const SAMPLE_THEMES: GameMeta[] = [
  {
    id: "_sample-wordle",
    title: "Sample: Wordle-style",
    order: -3,
    tagline: "White and square, light and high-contrast",
    hubAccent: "#538d4e",
    font: "Libre Franklin",
  },
  {
    id: "_sample-globle",
    title: "Sample: Globle-style",
    order: -2,
    tagline: "Dark navy, a full dark-mode game theme",
    hubAccent: "#5fb4ff",
    font: "Space Grotesk",
  },
  {
    id: "_sample-bee",
    title: "Sample: Spelling Bee-style",
    order: -1,
    tagline: "Sunny yellow, rounded soft pill tiles",
    hubAccent: "#f7da21",
    font: "Quicksand",
  },
];

export function DevThemes() {
  const [previewing, setPreviewing] = useState<string | null>(null);
  // Computed per render, not at module scope: routes.tsx imports DevThemes before it finishes
  // initializing its own `allGameMetas` export, so reading `allGameMetas` at module load time
  // (rather than once the component actually renders) hits it mid-initialization.
  const previewMetas = [...SAMPLE_THEMES, ...allGameMetas];
  const activeMeta = previewMetas.find((m) => m.id === previewing);

  // Modal portals to document.body, outside every [data-game] card's DOM subtree, so it must
  // pick up the previewed theme's tokens via the body element itself, not via React nesting.
  useEffect(() => {
    if (previewing) document.body.setAttribute("data-game", previewing);
    else document.body.removeAttribute("data-game");
    return () => void document.body.removeAttribute("data-game");
  }, [previewing]);

  return (
    <div className="min-h-screen bg-brand-bg p-6">
      <h1 className="font-brand text-2xl font-bold text-brand-fg">Dev: game themes</h1>
      <p className="mt-1 max-w-2xl text-sm text-brand-muted">
        Every discovered game’s palette, type, and tile states, driven entirely by{" "}
        <code className="rounded-brand-sm bg-brand-surface-2 px-1 py-0.5 text-xs">--game-*</code>{" "}
        /{" "}
        <code className="rounded-brand-sm bg-brand-surface-2 px-1 py-0.5 text-xs">--tile-*</code>{" "}
        tokens. Nothing here is a hardcoded hex. Three illustrative sample themes stand in until
        real games merge.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {previewMetas.map((meta) => (
          <div
            key={meta.id}
            data-game={meta.id}
            className="rounded-brand-lg border border-game-border bg-game-surface p-4 shadow-brand-sm"
          >
            <h2 className="font-game text-lg font-semibold text-game-fg">{meta.title}</h2>
            <p className="text-xs text-game-muted">{meta.tagline}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Swatch className="bg-game-bg" label="bg" />
              <Swatch className="bg-game-surface" label="surface" />
              <Swatch className="bg-game-surface-2" label="surface-2" />
              <Swatch className="bg-game-accent" label="accent" />
              <Swatch className="bg-tile-correct" label="correct" />
              <Swatch className="bg-tile-present" label="present" />
              <Swatch className="bg-tile-absent" label="absent" />
            </div>

            <p className="mt-4 font-game text-xl text-game-fg">{meta.title.split(":").pop()}</p>

            <div className="mt-3 flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-tile bg-tile-filled text-sm font-bold text-tile-fg">
                A
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-tile bg-tile-correct text-sm font-bold text-white">
                B
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-tile bg-tile-present text-sm font-bold text-white">
                C
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-tile bg-tile-absent text-sm font-bold text-white">
                D
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" onClick={() => setPreviewing(meta.id)}>
                Preview modal
              </Button>
              <span className="text-xs text-game-muted">{meta.font}</span>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={previewing !== null}
        onClose={() => setPreviewing(null)}
        title={activeMeta ? `${activeMeta.title}: modal preview` : undefined}
        headerExtra={<p className="text-sm text-game-muted">Puzzle #128</p>}
      >
        <div className="space-y-3 text-sm text-game-fg">
          <p>This is how HelpModal / StatsModal / ResultModal read under this theme.</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {["Played", "Win %", "Streak", "Max"].map((label, i) => (
              <div key={label} className="rounded-brand-md bg-game-surface-2 px-2 py-3">
                <div className="font-brand text-xl font-bold text-game-fg">{[42, 87, 6, 11][i]}</div>
                <div className="mt-0.5 text-xs text-game-muted">{label}</div>
              </div>
            ))}
          </div>
          <Button fullWidth onClick={() => setPreviewing(null)}>
            Close preview
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <div className="text-center text-[10px] text-game-muted">
      <div className={`h-9 w-9 rounded-brand-sm border border-game-border ${className}`} />
      {label}
    </div>
  );
}
