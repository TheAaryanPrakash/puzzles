export interface RoundTabInfo {
  submitted: boolean;
  stars: number;
}

export interface RoundTabsProps {
  active: number;
  rounds: RoundTabInfo[];
  onSelect: (index: number) => void;
}

const STAR_DOT: Record<number, string> = { 0: "⬛", 1: "⭐", 2: "⭐⭐", 3: "⭐⭐⭐" };

/** The 5 round pips at the top of the board — always navigable, so a player can hop between
 * rounds freely; a submitted round just renders read-only when selected. */
export function RoundTabs({ active, rounds, onSelect }: RoundTabsProps) {
  return (
    <div role="tablist" aria-label="Rounds" className="flex items-center justify-center gap-2">
      {rounds.map((r, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={active === i}
          aria-label={`Round ${i + 1}${r.submitted ? `, ${r.stars} of 3 stars` : ", not finished"}`}
          onClick={() => onSelect(i)}
          className={`flex h-12 w-12 flex-col items-center justify-center rounded-2xl border text-sm font-bold leading-tight transition-colors duration-brand-fast ${
            active === i
              ? "border-game-accent bg-game-accent text-game-accent-fg"
              : "border-game-border bg-game-surface text-game-fg hover:bg-game-surface-2"
          }`}
        >
          <span>{i + 1}</span>
          <span className="text-[0.55rem] leading-none" aria-hidden>
            {r.submitted ? STAR_DOT[r.stars] : "·"}
          </span>
        </button>
      ))}
    </div>
  );
}
