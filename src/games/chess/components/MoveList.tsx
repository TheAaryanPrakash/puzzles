export interface MoveListProps {
  sanMoves: string[];
}

/** A two-column scoresheet: one numbered row per full move, White's SAN on the left. */
export function MoveList({ sanMoves }: MoveListProps) {
  const rows: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < sanMoves.length; i += 2) {
    rows.push({ num: i / 2 + 1, white: sanMoves[i], black: sanMoves[i + 1] });
  }

  if (rows.length === 0) {
    return <p className="rounded-brand-md border border-game-border bg-game-surface px-3 py-4 text-center text-sm text-game-muted">No moves yet.</p>;
  }

  return (
    <ol className="max-h-40 overflow-y-auto rounded-brand-md border border-game-border bg-game-surface text-sm" aria-label="Move list">
      {rows.map((row) => (
        <li
          key={row.num}
          className="grid grid-cols-[2.25rem_1fr_1fr] gap-2 border-b border-game-border px-2 py-1 last:border-b-0"
          style={{ fontFamily: "var(--chess-mono-font)" }}
        >
          <span className="text-game-muted">{row.num}.</span>
          <span className="text-game-fg">{row.white}</span>
          <span className="text-game-fg">{row.black ?? ""}</span>
        </li>
      ))}
    </ol>
  );
}
