import { useMemo } from "react";
import { GlideCombobox, type GlideComboboxOption } from "../../../components/fx/GlideCombobox";
import { resolveCountryName } from "../logic";
import type { CountryNames } from "../useCountryGeo";

export interface CountryComboboxProps {
  countryNames: CountryNames;
  /** Codes that should never be suggested again (already guessed, or the start/end themselves). */
  excludeCodes: Set<string>;
  onSubmit: (code: string) => void;
  /** Enter resolved to no country at all — neither a highlighted suggestion nor a known name/alias. */
  onInvalid?: () => void;
  disabled?: boolean;
}

/**
 * Redesign (2026-10): wired to the shared `GlideCombobox` fx component (type-to-search, ARIA
 * combobox/listbox, focus-safe commit) instead of a hand-rolled listbox. The dropdown still
 * narrows by canonical name only — same tradeoff `StateCombobox` already makes — but a typed
 * alias (e.g. "UK") that doesn't appear in the filtered list resolves through `resolveCountryName`
 * via `resolveFreeText`, same pattern as States' `resolveGuess`.
 */
export function CountryCombobox({ countryNames, excludeCodes, onSubmit, onInvalid, disabled }: CountryComboboxProps) {
  const options = useMemo<GlideComboboxOption[]>(
    () => Object.entries(countryNames).map(([code, entry]) => ({ value: code, label: entry.name })),
    [countryNames],
  );

  return (
    <GlideCombobox
      options={options}
      excludeValues={excludeCodes}
      onSubmit={(code) => onSubmit(code)}
      resolveFreeText={(query) => resolveCountryName(query, countryNames) ?? undefined}
      onInvalid={onInvalid}
      disabled={disabled}
      placeholder="Type a country…"
      ariaLabel="Guess a country"
      accentColor="var(--brand-accent)"
      surfaceColor="var(--game-surface-2)"
      highlightColor="var(--brand-accent)"
      textColor="var(--game-fg)"
    />
  );
}
