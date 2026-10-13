import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { GlideCombobox, type GlideComboboxOption } from "../../../components/fx/GlideCombobox";
import { resolveGuess } from "../logic";

export interface StateOption {
  code: string;
  name: string;
}

export interface StateComboboxProps {
  options: StateOption[];
  nameIndex: Map<string, string>;
  disabledCodes: ReadonlySet<string>;
  onSubmit: (code: string) => void;
  disabled?: boolean;
}

/** A thin wrapper around the shared `GlideCombobox`: maps state codes/names to its generic
 *  value/label shape, wires `resolveGuess` into `resolveFreeText` so a confident fast typist can
 *  hit Enter on a full, unambiguous name without ever opening the suggestion list, and adds the
 *  shake-on-invalid feedback GlideCombobox deliberately leaves to its caller (`onInvalid`). */
export function StateCombobox({ options, nameIndex, disabledCodes, onSubmit, disabled }: StateComboboxProps) {
  const [shake, setShake] = useState(false);
  const reduceMotion = useReducedMotion();

  const glideOptions: GlideComboboxOption[] = options.map((o) => ({ value: o.code, label: o.name }));

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), reduceMotion ? 0 : 320);
  }

  return (
    <motion.div
      className="w-full max-w-sm"
      animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.32 }}
    >
      <GlideCombobox
        options={glideOptions}
        excludeValues={disabledCodes}
        disabled={disabled}
        placeholder="Type a state or UT…"
        ariaLabel="Guess a state or union territory"
        onSubmit={onSubmit}
        resolveFreeText={(query) => resolveGuess(query, nameIndex)}
        onInvalid={triggerShake}
        accentColor="var(--game-accent)"
        surfaceColor="var(--game-surface)"
        highlightColor="var(--game-surface-2)"
        textColor="var(--game-fg)"
        size="lg"
        radius={14}
      />
    </motion.div>
  );
}
