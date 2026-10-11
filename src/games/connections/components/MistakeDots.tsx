export interface MistakeDotsProps {
  mistakes: number;
  max: number;
}

export function MistakeDots({ mistakes, max }: MistakeDotsProps) {
  const remaining = max - mistakes;
  return (
    <div className="flex items-center gap-2" role="status" aria-label={`${remaining} mistakes remaining`}>
      <span className="text-xs text-game-muted">Mistakes remaining</span>
      <div className="flex gap-1.5">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={`h-3 w-3 rounded-full ${i < remaining ? "bg-game-fg" : "bg-game-border"}`}
          />
        ))}
      </div>
    </div>
  );
}
