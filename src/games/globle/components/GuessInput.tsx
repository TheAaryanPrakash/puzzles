import { useMemo } from "react";
import { GlideCombobox, type GlideComboboxOption } from "../../../components/fx/GlideCombobox";
import { buildCountryNameIndex, resolveCountryGuess } from "../logic";
import type { CountryNameEntry } from "../worldData";

export interface GuessInputProps {
  codes: string[];
  names: Record<string, CountryNameEntry>;
  guessedCodes: ReadonlySet<string>;
  onGuess: (code: string) => void;
  disabled?: boolean;
}

/**
 * Type a country name, arrow through suggestions, Enter (or click) to guess — now
 * `GlideCombobox` (see its own doc comment and `logic.ts`'s `buildCountryNameIndex`/
 * `resolveCountryGuess` for how typed aliases like "UAE" or "Holland" still resolve on Enter even
 * though they won't appear in the live dropdown, which only filters by each option's own label).
 * Already-guessed countries are excluded entirely — there's nothing useful to guess again.
 */
export function GuessInput({ codes, names, guessedCodes, onGuess, disabled }: GuessInputProps) {
  const options = useMemo<GlideComboboxOption[]>(
    () => codes.map((code) => ({ value: code, label: names[code]?.name ?? code })),
    [codes, names],
  );
  const nameIndex = useMemo(() => buildCountryNameIndex(codes, names), [codes, names]);

  return (
    <GlideCombobox
      options={options}
      excludeValues={guessedCodes}
      disabled={disabled}
      placeholder="Type a country…"
      ariaLabel="Guess a country"
      onSubmit={(code) => onGuess(code)}
      resolveFreeText={(query) => {
        const code = resolveCountryGuess(query, nameIndex);
        return code && !guessedCodes.has(code) ? code : null;
      }}
      accentColor="var(--game-accent)"
      surfaceColor="var(--game-surface-2)"
      highlightColor="var(--game-accent)"
      textColor="var(--game-fg)"
    />
  );
}
