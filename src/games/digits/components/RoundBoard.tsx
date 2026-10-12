import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "../../../components/Button";
import { NumberCircle } from "./NumberCircle";
import { noSwipeProps } from "../../../lib/noSwipe";
import {
  deriveTiles,
  evalOp,
  scoreRound,
  OPERATORS,
  type DigitsRound,
  type RoundState,
  type Operator,
  type Step,
} from "../logic";

const OP_GLYPH: Record<Operator, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };
const OP_NAME: Record<Operator, string> = {
  "+": "add",
  "-": "subtract",
  "*": "multiply",
  "/": "divide",
};

export interface RoundBoardProps {
  round: DigitsRound;
  roundIndex: number;
  state: RoundState;
  readOnly: boolean;
  onApplyStep: (step: Step) => void;
  onUndo: () => void;
  onReset: () => void;
  onSubmit: () => void;
}

/** One round's interactive board: tap a number, an operator, then a number to merge them. */
export function RoundBoard({
  round,
  roundIndex,
  state,
  readOnly,
  onApplyStep,
  onUndo,
  onReset,
  onSubmit,
}: RoundBoardProps) {
  const shouldReduceMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOp, setSelectedOp] = useState<Operator | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shakeToken, setShakeToken] = useState(0);

  const tiles = deriveTiles(round.numbers, state.steps);
  const score = scoreRound(round, state);
  const locked = readOnly;

  function flashError(message: string) {
    setError(message);
    setShakeToken((k) => k + 1);
    window.setTimeout(() => setError(null), 1600);
  }

  function handleTileClick(id: string, value: number) {
    if (locked) return;
    if (selectedId === id) {
      setSelectedId(null);
      setSelectedOp(null);
      return;
    }
    if (selectedId === null) {
      setSelectedId(id);
      return;
    }
    if (selectedOp === null) {
      // No operator chosen yet: tapping a different number re-targets the first operand.
      setSelectedId(id);
      return;
    }
    const a = tiles.find((t) => t.id === selectedId)?.value;
    if (a === undefined) {
      setSelectedId(null);
      setSelectedOp(null);
      return;
    }
    const result = evalOp(a, value, selectedOp);
    if (result === undefined) {
      flashError(`Can't ${OP_NAME[selectedOp]} ${value} from ${a} that way — try the other order.`);
      return;
    }
    onApplyStep({ a, b: value, op: selectedOp, result });
    setSelectedId(null);
    setSelectedOp(null);
  }

  function handleOpClick(op: Operator) {
    if (locked || selectedId === null) return;
    setSelectedOp((prev) => (prev === op ? null : op));
  }

  const selectedValue = tiles.find((t) => t.id === selectedId)?.value;

  return (
    <div data-round={roundIndex + 1} className="flex flex-col items-center gap-5">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-game-muted">Target</p>
        <p className="font-game text-4xl font-bold text-game-fg">{round.target}</p>
      </div>

      <motion.div
        key={shakeToken}
        initial={{ x: 0 }}
        animate={shouldReduceMotion || shakeToken === 0 ? { x: 0 } : { x: [0, -8, 8, -6, 6, 0] }}
        transition={{ duration: 0.4 }}
        className="flex w-full flex-wrap items-center justify-center gap-3"
        {...noSwipeProps}
      >
        <AnimatePresence mode="popLayout">
          {tiles.map((tile) => (
            <NumberCircle
              key={tile.id}
              value={tile.value}
              selected={selectedId === tile.id}
              disabled={locked}
              highlight={locked && tile.value === score.closest}
              onClick={() => handleTileClick(tile.id, tile.value)}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      <div aria-live="polite" className="min-h-[1.5rem] text-center text-sm text-brand-danger">
        {error}
      </div>

      {!locked && (
        <div className="flex flex-col items-center gap-3">
          <div role="group" aria-label="Operator" className="flex gap-2">
            {OPERATORS.map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => handleOpClick(op)}
                disabled={selectedId === null}
                data-selected={selectedOp === op ? "true" : "false"}
                aria-pressed={selectedOp === op}
                aria-label={OP_NAME[op]}
                className="digits-op flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold transition-colors duration-brand-fast disabled:cursor-not-allowed"
              >
                {OP_GLYPH[op]}
              </button>
            ))}
          </div>
          <p className="h-5 text-sm text-game-muted">
            {selectedValue !== undefined && selectedOp && `${selectedValue} ${OP_GLYPH[selectedOp]} ?`}
            {selectedValue !== undefined && !selectedOp && `${selectedValue} — pick an operator`}
          </p>
        </div>
      )}

      {locked ? (
        <p className="text-center text-sm text-game-muted">
          Closest: <span className="font-semibold text-game-fg">{score.closest}</span> ·{" "}
          {score.stars > 0 ? "⭐".repeat(score.stars) : "No stars"}
        </p>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onUndo} disabled={state.steps.length === 0}>
            Undo
          </Button>
          <Button variant="secondary" size="sm" onClick={onReset} disabled={state.steps.length === 0}>
            Reset round
          </Button>
          <Button variant="primary" size="sm" onClick={onSubmit}>
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}
