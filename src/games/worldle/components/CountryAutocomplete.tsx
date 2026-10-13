import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import GlideCombobox, { type GlideComboboxOption } from "../../../components/fx/GlideCombobox";
import { nameFor, type CountryNames } from "../logic";

interface CountryAutocompleteProps {
  names: CountryNames;
  excludeCodes: string[];
  onSelect: (code: string, name: string) => void;
  disabled?: boolean;
  label: string;
}

/**
 * GlideCombobox wrapper. A guess is only ever submitted by *selecting* a suggestion (click, or
 * Enter while one is highlighted) — there's no free-text parser (no `resolveFreeText`), so what
 * gets guessed is always an unambiguous country code, same contract as before this swap.
 *
 * GlideCombobox filters its option list by a single `label` per option, with no per-option
 * keyword list — but this game's `howTo` promises alias matching ("nicknames and common aliases
 * work too, e.g. 'UAE', 'America'"), and `logic.ts`'s `searchCountries` is tested on exactly that.
 * To keep that promise without a custom filter hook (GlideCombobox has none), every alias from
 * `country-names.json` gets its own option alongside the canonical name, each `value` encoding its
 * 2-letter ISO code (`"AE"`, or `"AE#0"` for its first alias) so a pick always maps back to a real
 * code — see `codeFromValue` below. Canonical names are listed first so an empty-query focus (the
 * list GlideCombobox shows before any typing) browses real country names, not alias spellings.
 */
export function CountryAutocomplete({
  names,
  excludeCodes,
  onSelect,
  disabled,
  label,
}: CountryAutocompleteProps) {
  const [shake, setShake] = useState(false);
  const reduceMotion = useReducedMotion();

  const options = useMemo<GlideComboboxOption[]>(() => {
    const canonical: GlideComboboxOption[] = [];
    const aliasRows: GlideComboboxOption[] = [];
    for (const [code, entry] of Object.entries(names)) {
      canonical.push({ value: code, label: entry.name });
      entry.aliases.forEach((alias, i) => {
        if (alias.toLowerCase() === entry.name.toLowerCase()) return;
        aliasRows.push({ value: `${code}#${i}`, label: alias });
      });
    }
    return [...canonical, ...aliasRows];
  }, [names]);

  const excludeValues = useMemo(() => {
    const excluded = new Set(excludeCodes);
    const values = new Set<string>();
    for (const option of options) {
      if (excluded.has(codeFromValue(option.value))) values.add(option.value);
    }
    return values;
  }, [options, excludeCodes]);

  function handleSubmit(value: string) {
    const code = codeFromValue(value);
    onSelect(code, nameFor(code, names));
  }

  function handleInvalid() {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }

  return (
    <motion.div
      className="w-full max-w-sm"
      animate={shake && !reduceMotion ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <GlideCombobox
        options={options}
        excludeValues={excludeValues}
        onSubmit={handleSubmit}
        onInvalid={handleInvalid}
        disabled={disabled}
        placeholder="Type a country…"
        ariaLabel={label}
        accentColor="var(--game-accent)"
        surfaceColor="var(--game-surface)"
        highlightColor="var(--game-surface-2)"
        textColor="var(--game-fg)"
      />
    </motion.div>
  );
}

/** Every option's `value` starts with its 2-letter ISO code (`"AE"` or alias-suffixed `"AE#0"`). */
function codeFromValue(value: string): string {
  return value.slice(0, 2);
}
