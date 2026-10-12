import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "../../../components/Button";
import type { CountryOption } from "../useFlagleAssets";

export interface CountryAutocompleteProps {
  options: CountryOption[];
  /** Codes to leave out of suggestions (already guessed). */
  excludeCodes: string[];
  onGuess: (code: string) => void;
  disabled?: boolean;
}

const MAX_SUGGESTIONS = 8;

function matches(option: CountryOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return false;
  if (option.code.toLowerCase() === q) return true;
  if (option.name.toLowerCase().includes(q)) return true;
  return option.aliases.some((a) => a.toLowerCase().includes(q));
}

/** Accessible combobox: type a country name, alias or ISO code; arrow keys + Enter + Escape. */
export function CountryAutocomplete({
  options,
  excludeCodes,
  onGuess,
  disabled,
}: CountryAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const shouldReduceMotion = useReducedMotion();

  const excluded = useMemo(() => new Set(excludeCodes), [excludeCodes]);
  const suggestions = useMemo(() => {
    if (query.trim().length === 0) return [];
    return options.filter((o) => !excluded.has(o.code) && matches(o, query)).slice(0, MAX_SUGGESTIONS);
  }, [options, excluded, query]);

  const open = suggestions.length > 0 && activeIndex !== -2;

  function reset() {
    setQuery("");
    setActiveIndex(-1);
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }

  function selectOption(option: CountryOption) {
    onGuess(option.code);
    reset();
  }

  function handleSubmit() {
    const pick =
      activeIndex >= 0 && activeIndex < suggestions.length ? suggestions[activeIndex] : suggestions[0];
    if (pick) {
      selectOption(pick);
    } else {
      triggerShake();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length > 0) setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length > 0) setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setActiveIndex(-2);
    }
  }

  const activeOptionId =
    activeIndex >= 0 && activeIndex < suggestions.length
      ? `${listboxId}-opt-${suggestions[activeIndex].code}`
      : undefined;

  return (
    <motion.div
      className="relative w-full"
      animate={shake && !shouldReduceMotion ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <label htmlFor={`${listboxId}-input`} className="sr-only">
        Guess a country
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          placeholder="Type a country…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 rounded-brand-sm border border-game-border bg-game-surface p-3 text-base text-game-fg outline-none focus:border-game-accent focus:ring-2 focus:ring-game-accent disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button onClick={handleSubmit} disabled={disabled} aria-label="Submit guess">
          Guess
        </Button>
      </div>
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-brand-sm border border-game-border bg-game-surface shadow-lg"
        >
          {suggestions.map((option, i) => (
            <li
              key={option.code}
              id={`${listboxId}-opt-${option.code}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(option);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === activeIndex ? "bg-game-accent text-game-accent-fg" : "text-game-fg"
              }`}
            >
              {option.name}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
