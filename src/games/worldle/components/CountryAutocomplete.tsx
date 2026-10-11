import { useId, useRef, useState, type KeyboardEvent } from "react";
import { searchCountries, type CountryNames, type CountrySuggestion } from "../logic";

interface CountryAutocompleteProps {
  names: CountryNames;
  excludeCodes: string[];
  onSelect: (code: string, name: string) => void;
  disabled?: boolean;
  label: string;
}

/**
 * Editable combobox with list autocomplete (W3C APG pattern — see RESEARCH.md). A guess is only
 * ever submitted by *selecting* a suggestion (click, or Enter while one is highlighted) — there's
 * no free-text parser, so what gets guessed is always an unambiguous country code.
 */
export function CountryAutocomplete({
  names,
  excludeCodes,
  onSelect,
  disabled,
  label,
}: CountryAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const inputId = useId();
  const listboxId = useId();
  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  const suggestions: CountrySuggestion[] = open ? searchCountries(query, names, excludeCodes) : [];

  function commit(suggestion: CountrySuggestion) {
    onSelect(suggestion.code, suggestion.name);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
      if (chosen) commit(chosen);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="relative w-full max-w-sm">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder="Type a country…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => query && setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="w-full rounded-brand-sm border border-game-border bg-game-surface p-2.5 text-game-fg outline-none focus:border-game-accent"
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-brand-sm border border-game-border bg-game-surface shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.code}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(s)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === activeIndex ? "bg-game-accent text-game-accent-fg" : "text-game-fg"
              }`}
            >
              <span className={`fi fi-${s.code.toLowerCase()} mr-2`} aria-hidden="true" />
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
