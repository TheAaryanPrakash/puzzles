import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { GlideCombobox, type GlideComboboxOption } from "../../../components/fx/GlideCombobox";
import type { CountryOption } from "../useFlagleAssets";

export interface CountryAutocompleteProps {
  options: CountryOption[];
  /** Codes to leave out of suggestions (already guessed). */
  excludeCodes: string[];
  onGuess: (code: string) => void;
  disabled?: boolean;
}

/** True if `query` matches this option by ISO code, name, or any alias — used both to build the
 *  visible suggestion list before the redesign, and now (via `resolveFreeText`) to keep a typed
 *  alias or code reachable even when GlideCombobox's own label-only filter wouldn't show it. */
function matches(option: CountryOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return false;
  if (option.code.toLowerCase() === q) return true;
  if (option.name.toLowerCase().includes(q)) return true;
  return option.aliases.some((a) => a.toLowerCase().includes(q));
}

/** Accessible combobox (GlideCombobox): type a country name, alias or ISO code; arrow keys + Enter
 *  + Escape, mouse/touch on the list. The visible dropdown filters by name only (GlideCombobox's
 *  own behaviour); a full alias or code that wouldn't show up there is still resolved on Enter via
 *  `resolveFreeText`, so "usa" still guesses the United States even without it ever highlighting. */
export function CountryAutocomplete({ options, excludeCodes, onGuess, disabled }: CountryAutocompleteProps) {
  const [shake, setShake] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const excluded = useMemo(() => new Set(excludeCodes), [excludeCodes]);

  const glideOptions: GlideComboboxOption[] = useMemo(
    () => options.map((o) => ({ value: o.code, label: o.name })),
    [options],
  );

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), shouldReduceMotion ? 0 : 400);
  }

  function resolveFreeText(query: string): string | null {
    const match = options.find((o) => !excluded.has(o.code) && matches(o, query));
    return match?.code ?? null;
  }

  return (
    <motion.div
      className="relative w-full"
      animate={shake && !shouldReduceMotion ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <GlideCombobox
        options={glideOptions}
        excludeValues={excludeCodes}
        disabled={disabled}
        placeholder="Type a country…"
        ariaLabel="Guess a country"
        onSubmit={(code) => onGuess(code)}
        resolveFreeText={resolveFreeText}
        onInvalid={triggerShake}
        size="lg"
        radius={8}
        accentColor="var(--game-accent)"
        surfaceColor="var(--game-surface-2)"
        highlightColor="var(--game-accent)"
        textColor="var(--game-fg)"
        className="max-w-none"
      />
    </motion.div>
  );
}
