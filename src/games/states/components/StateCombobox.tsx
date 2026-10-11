import { useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { normalizeStateName, resolveGuess } from "../logic";

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

const MAX_SHOWN = 8;

/** A small accessible combobox (APG combobox pattern, simplified): type to filter, arrow keys to
 *  move through the list, Enter to submit the highlighted option — or, with nothing highlighted,
 *  whatever the typed text itself resolves to via alias/name matching, so a confident fast typist
 *  never has to touch the mouse or wait for the dropdown. */
export function StateCombobox({ options, nameIndex, disabledCodes, onSubmit, disabled }: StateComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const reduceMotion = useReducedMotion();

  const filtered = useMemo(() => {
    const q = normalizeStateName(query);
    const pool = options.filter((o) => !disabledCodes.has(o.code));
    if (!q) return pool.slice(0, MAX_SHOWN);
    const starts = pool.filter((o) => normalizeStateName(o.name).startsWith(q));
    const contains = pool.filter(
      (o) => !normalizeStateName(o.name).startsWith(q) && normalizeStateName(o.name).includes(q),
    );
    return [...starts, ...contains].slice(0, MAX_SHOWN);
  }, [query, options, disabledCodes]);

  function reset() {
    setQuery("");
    setOpen(false);
    setHighlight(0);
  }

  function submitCode(code: string) {
    if (disabledCodes.has(code)) return;
    onSubmit(code);
    reset();
    inputRef.current?.focus();
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), reduceMotion ? 0 : 320);
  }

  function handleSubmitFromInput() {
    const highlighted = filtered[highlight];
    if (open && highlighted) {
      submitCode(highlighted.code);
      return;
    }
    const resolved = resolveGuess(query, nameIndex);
    if (resolved && !disabledCodes.has(resolved)) {
      submitCode(resolved);
    } else {
      triggerShake();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSubmitFromInput();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative w-full max-w-sm">
      <motion.input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open && filtered.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[highlight] ? `${listboxId}-${filtered[highlight].code}` : undefined}
        aria-label="Guess a state or union territory"
        placeholder="Type a state or UT…"
        value={query}
        disabled={disabled}
        animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.32 }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="w-full rounded-brand-md border border-game-border bg-game-surface px-4 py-2.5 text-base text-game-fg outline-none focus-visible:ring-2 focus-visible:ring-game-accent disabled:cursor-not-allowed disabled:opacity-50"
      />
      <AnimatePresence>
        {open && filtered.length > 0 && (
          <motion.ul
            id={listboxId}
            role="listbox"
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-10 mt-1 w-full overflow-hidden rounded-brand-md border border-game-border bg-game-surface shadow-lg"
          >
            {filtered.map((option, i) => (
              <li
                key={option.code}
                id={`${listboxId}-${option.code}`}
                role="option"
                aria-selected={i === highlight}
                // onMouseDown (not onClick) fires before the input's onBlur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  submitCode(option.code);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`cursor-pointer px-4 py-2 text-sm ${
                  i === highlight ? "bg-game-accent text-game-accent-fg" : "text-game-fg hover:bg-game-surface-2"
                }`}
              >
                {option.name}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
