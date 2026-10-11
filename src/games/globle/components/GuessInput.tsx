import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../../../components/Button";
import type { CountryNameEntry } from "../worldData";

export interface GuessInputProps {
  codes: string[];
  names: Record<string, CountryNameEntry>;
  guessedCodes: ReadonlySet<string>;
  onGuess: (code: string) => void;
  disabled?: boolean;
}

interface Suggestion {
  code: string;
  label: string;
}

const MAX_SUGGESTIONS = 8;

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Accessible combobox: type a country name (or alias), arrow through suggestions, Enter to
 * guess. Already-guessed countries are filtered out entirely — there's nothing useful to guess
 * them again for, and it keeps the list focused on what's left.
 */
export function GuessInput({ codes, names, guessedCodes, onGuess, disabled }: GuessInputProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = normalize(query);
    if (!q) return [];
    const matches: Suggestion[] = [];
    for (const code of codes) {
      if (guessedCodes.has(code)) continue;
      const entry = names[code];
      if (!entry) continue;
      const candidates = [entry.name, ...entry.aliases];
      if (candidates.some((c) => normalize(c).includes(q))) {
        matches.push({ code, label: entry.name });
      }
      if (matches.length >= MAX_SUGGESTIONS * 3) break; // cap scan cost before final sort/slice
    }
    // Prefix matches first, then alphabetical, so typing "fr" surfaces France before "Burkina Faso".
    matches.sort((a, b) => {
      const aPrefix = normalize(a.label).startsWith(q) ? 0 : 1;
      const bPrefix = normalize(b.label).startsWith(q) ? 0 : 1;
      return aPrefix - bPrefix || a.label.localeCompare(b.label);
    });
    return matches.slice(0, MAX_SUGGESTIONS);
  }, [query, codes, names, guessedCodes]);

  function commit(code: string) {
    onGuess(code);
    setQuery("");
    setActiveIndex(-1);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter" && suggestions.length === 1) commit(suggestions[0].code);
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        break;
      case "Enter": {
        e.preventDefault();
        const pick = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
        if (pick) commit(pick.code);
        break;
      }
      case "Escape":
        setOpen(false);
        setActiveIndex(-1);
        break;
      default:
        break;
    }
  }

  const activeId =
    activeIndex >= 0 && suggestions[activeIndex] ? `${listboxId}-${suggestions[activeIndex].code}` : undefined;

  return (
    <div className="relative w-full max-w-sm">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={activeId}
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
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 100)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-brand-sm border border-game-border bg-game-surface px-3 py-2 text-game-fg outline-none focus-visible:ring-2 focus-visible:ring-game-accent disabled:opacity-50"
        />
        <Button
          onClick={() => suggestions[0] && commit(suggestions[0].code)}
          disabled={disabled || suggestions.length === 0}
        >
          Guess
        </Button>
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Country suggestions"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-brand-sm border border-game-border bg-game-surface shadow-xl"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.code}
              id={`${listboxId}-${s.code}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s.code);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === activeIndex ? "bg-game-accent text-game-accent-fg" : "text-game-fg"
              }`}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
