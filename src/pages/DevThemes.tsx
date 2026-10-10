import { allGameMetas } from "../routes";

// Load every game's theme.css so the swatches below reflect real values, not brand defaults.
import.meta.glob("../games/*/theme.css", { eager: true });

export function DevThemes() {
  return (
    <div className="grid gap-6 bg-brand-bg p-6 sm:grid-cols-2">
      {allGameMetas.map((meta) => (
        <div
          key={meta.id}
          data-game={meta.id}
          className="rounded-brand-lg border border-game-border bg-game-surface p-4"
        >
          <h2 className="font-game text-lg font-semibold text-game-fg">{meta.title}</h2>
          <div className="mt-3 flex gap-2">
            <Swatch className="bg-game-bg" label="bg" />
            <Swatch className="bg-game-surface" label="surface" />
            <Swatch className="bg-game-accent" label="accent" />
            <Swatch className="bg-tile-correct" label="correct" />
            <Swatch className="bg-tile-present" label="present" />
            <Swatch className="bg-tile-absent" label="absent" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <div className="text-center text-[10px] text-game-muted">
      <div className={`h-10 w-10 rounded-brand-sm border border-game-border ${className}`} />
      {label}
    </div>
  );
}
