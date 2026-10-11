import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../../../components/Button";
import type { CountryNames } from "../useCountryGeo";

export interface CountryComboboxProps {
  countryNames: CountryNames;
  /** Codes that should never be suggested again (already guessed, or the start/end themselves). */
  excludeCodes: Set<string>;
  onSubmit: (code: string) => void;
  disabled?: boolean;
}

const MAX_SUGGESTIONS = 8;

function matches(query: string, name: string, aliases: string[]): boolean {
  const needle = query.toLowerCase();
  return name.toLowerCase().includes(needle) || aliases.some((a) => a.toLowerCase().includes(needle));
}

/**
 * An ARIA combobox (role="combobox" + listbox, per ui-ux-pro-max's "show predictions as user
 * types" + accessible-name guidance): fully usable with only the physical keyboard (arrows to
 * move, Enter to pick, Escape to close), and by name or any alias from country-names.json.
 */
export function CountryCombobox({
  countryNames,
  excludeCodes,
  onSubmit,
  disabled,
}: CountryComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const getOptionId = (code: string) => `travle-option-${code}`;

  const suggestions =
    query.trim().length === 0
      ? []
      : Object.entries(countryNames)
          .filter(([code, entry]) => !excludeCodes.has(code) && matches(query, entry.name, entry.aliases))
          .slice(0, MAX_SUGGESTIONS);

  function reset() {
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  }

  function pick(code: string) {
    onSubmit(code);
    reset();
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length > 0) setActiveIndex((i) => (i + 1) % suggestions.length);
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length > 0) setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
      setOpen(true);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        pick(suggestions[activeIndex][0]);
      } else if (suggestions.length === 1) {
        pick(suggestions[0][0]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const activeOption = activeIndex >= 0 ? suggestions[activeIndex] : undefined;

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={activeOption ? getOptionId(activeOption[0]) : undefined}
          aria-autocomplete="list"
          aria-label="Guess a country"
          placeholder="Type a country…"
          autoComplete="off"
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 100)}
          className="w-full rounded-brand-sm border border-game-border bg-game-surface px-3 py-2 text-base text-game-fg outline-none focus-visible:ring-2 focus-visible:ring-game-accent"
        />
        <Button
          type="button"
          disabled={disabled || !(activeOption || suggestions.length === 1)}
          onClick={() => pick((activeOption ?? suggestions[0])[0])}
        >
          Guess
        </Button>
      </div>
      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-brand-sm border border-game-border bg-game-surface shadow-lg"
        >
          {suggestions.map(([code, entry], i) => (
            <li
              key={code}
              id={getOptionId(code)}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(code)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === activeIndex ? "bg-game-accent text-game-accent-fg" : "hover:bg-game-surface-2"
              }`}
            >
              {entry.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
