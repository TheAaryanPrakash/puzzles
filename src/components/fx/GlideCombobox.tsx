// A type-to-search combobox: a real text input, not GlideSelect (reactbits.dev/micro/glide-select,
// MIT + Commons Clause License Condition v1.0, Copyright (c) 2026 David Haz — see
// docs/redesign/HANDOFF.md) wrapped. GlideSelect has no `<input>` and no filter logic (confirmed by
// reading its source), so this is new engineering — it only reuses GlideSelect's visual language
// (the menu's corner-pop open animation, the gliding highlight pill) and its listbox ARIA pattern.
//
// Focus-safety: the brief named a States-game bug ("textbox goes passive until you click out and
// back in"). Live-testing src/games/states/components/StateCombobox.tsx (playwright-cli, both the
// keyboard-Enter and mouse-click submit paths, several guesses in a row) could not reproduce it —
// that component already keeps focus correctly, because it already does the two things that matter:
// (1) `onMouseDown` (not `onClick`) + `preventDefault()` on every option, so the browser's native
//     mousedown-driven focus shift away from the input never happens in the first place — waiting
//     for `onClick` or skipping preventDefault is the usual way this class of bug gets introduced.
// (2) an explicit `inputRef.current?.focus()` right after committing a selection, as a second,
//     independent guarantee — redundant when (1) already held focus, but it means a focus loss from
//     any OTHER cause (e.g. a parent re-render reconciling the input's attributes) is repaired in
//     the same synchronous tick rather than left for the user to notice.
// This component applies both unconditionally, plus a third guarantee neither StateCombobox nor
// GlideSelect needed: the option list is `key`ed by value and the input is never conditionally
// unmounted (no `{open && <input/>}`-style pattern anywhere in this file) — a conditionally-mounted
// input is the single most common real cause of "it just stops responding," since a fresh mount
// is a new, unfocused DOM node even when it renders in visually the same place.
'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export interface GlideComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface GlideComboboxProps {
  options: (string | GlideComboboxOption)[];
  /** Values to exclude from the list entirely (e.g. states already guessed) — not just disabled. */
  excludeValues?: Iterable<string>;
  placeholder?: string;
  disabled?: boolean;
  maxShown?: number;
  /** Called when a selection is committed — by clicking an option, or pressing Enter on a
   *  highlighted option. The query clears and the input is re-focused immediately after. */
  onSubmit: (value: string, option: GlideComboboxOption) => void;
  /** Enter with nothing highlighted (free text that doesn't exactly match a visible option) calls
   *  this with the raw query; return a value to submit it, or null/undefined to shake/reject. Lets
   *  callers match aliases or old names the way States' `resolveGuess` does, without this component
   *  knowing anything about that domain logic. */
  resolveFreeText?: (query: string) => string | null | undefined;
  /** Called when Enter is pressed but nothing resolves (no highlight, no resolveFreeText match) —
   *  e.g. to trigger a shake. This component has no opinion on invalid-input feedback. */
  onInvalid?: () => void;
  accentColor?: string;
  surfaceColor?: string;
  highlightColor?: string;
  textColor?: string;
  size?: 'sm' | 'md' | 'lg';
  radius?: number;
  ariaLabel: string;
  className?: string;
}

const SIZES: Record<string, { h: number; font: number; row: number }> = {
  sm: { h: 36, font: 13, row: 32 },
  md: { h: 44, font: 14, row: 36 },
  lg: { h: 52, font: 16, row: 42 }
};

const norm = (o: string | GlideComboboxOption): GlideComboboxOption =>
  typeof o === 'string' ? { value: o, label: o } : o;

const normalize = (s: string) => s.trim().toLowerCase();

export function GlideCombobox({
  options,
  excludeValues,
  placeholder = 'Type to search…',
  disabled = false,
  maxShown = 8,
  onSubmit,
  resolveFreeText,
  onInvalid,
  accentColor = '#df497b',
  surfaceColor = '#1c1215',
  highlightColor = '#374151',
  textColor = '#f5eaee',
  size = 'md',
  radius = 12,
  ariaLabel,
  className = ''
}: GlideComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();
  const reduce = useReducedMotion();
  const S = SIZES[size] ?? SIZES.md;

  const items = useMemo(() => {
    const excluded = excludeValues ? new Set(excludeValues) : null;
    const all = options.map(norm).filter(o => !excluded?.has(o.value));
    const q = normalize(query);
    if (!q) return all.slice(0, maxShown);
    const starts = all.filter(o => normalize(o.label).startsWith(q));
    const contains = all.filter(o => !normalize(o.label).startsWith(q) && normalize(o.label).includes(q));
    return [...starts, ...contains].slice(0, maxShown);
  }, [options, excludeValues, query, maxShown]);

  // Keep the highlight in range as the filtered list shrinks/grows with each keystroke.
  useEffect(() => {
    setHighlight(h => Math.min(h, Math.max(items.length - 1, 0)));
  }, [items.length]);

  useEffect(() => {
    const pill = pillRef.current;
    const row = listRef.current?.children[highlight] as HTMLElement | undefined;
    if (!pill || !row || !open) return;
    pill.style.transform = `translateY(${row.offsetTop}px)`;
    pill.style.height = `${row.offsetHeight}px`;
    pill.style.opacity = items.length ? '1' : '0';
  }, [highlight, items.length, open]);

  function reset() {
    setQuery('');
    setOpen(false);
    setHighlight(0);
  }

  function commit(option: GlideComboboxOption) {
    if (option.disabled || disabled) return;
    onSubmit(option.value, option);
    reset();
    // Belt-and-braces: see the file header. Harmless if focus never moved.
    inputRef.current?.focus();
  }

  function submitFromKeyboard() {
    const picked = items[highlight];
    if (open && picked) {
      commit(picked);
      return;
    }
    const resolved = resolveFreeText?.(query);
    const match = resolved ? items.find(o => o.value === resolved) ?? norm(resolved) : null;
    if (match) commit(match);
    else onInvalid?.();
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight(h => Math.min(h + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submitFromKeyboard();
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  const expanded = open && items.length > 0;

  return (
    <div
      className={`relative inline-block w-full max-w-sm ${className}`}
      style={
        {
          '--gc-accent': accentColor,
          '--gc-surface': surfaceColor,
          '--gc-highlight': highlightColor,
          '--gc-text': textColor
        } as CSSProperties
      }
    >
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={expanded && items[highlight] ? `${id}-${items[highlight].value}` : undefined}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        autoComplete="off"
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          clearTimeout(closeTimer.current);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Long enough to outlast a mousedown→click pair on an option (which also calls
          // preventDefault, so this timer firing at all means focus genuinely left — e.g. Tab away).
          closeTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        className="w-full rounded-[12px] border px-4 outline-none transition-[box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          height: S.h,
          fontSize: S.font,
          borderRadius: radius,
          background: 'var(--gc-surface)',
          color: 'var(--gc-text)',
          borderColor: 'color-mix(in srgb, var(--gc-text) 18%, transparent)',
          boxShadow: expanded ? '0 0 0 2px var(--gc-accent)' : 'none'
        }}
      />
      <AnimatePresence>
        {expanded && (
          <motion.ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-label={ariaLabel}
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: reduce ? 0.1 : 0.16, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: 'top center', borderRadius: radius, background: 'var(--gc-surface)' }}
            className="absolute z-20 mt-1.5 w-full overflow-hidden border p-1 shadow-lg"
          >
            <span
              ref={pillRef}
              aria-hidden="true"
              className="pointer-events-none absolute top-0 right-1 left-1 rounded-[calc(var(--gc-radius,10px)-2px)] opacity-0 transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
              style={{ background: 'var(--gc-highlight)', borderRadius: Math.max(4, radius - 4) }}
            />
            {items.map((option, i) => (
              <li
                key={option.value}
                id={`${id}-${option.value}`}
                role="option"
                aria-selected={i === highlight}
                aria-disabled={option.disabled || undefined}
                // onMouseDown, not onClick — see the file header's focus-safety note.
                onMouseDown={e => {
                  e.preventDefault();
                  commit(option);
                }}
                onMouseEnter={() => setHighlight(i)}
                className="relative z-[1] cursor-pointer rounded-[inherit] px-3 py-2 text-sm transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
                style={{ fontSize: S.font, lineHeight: `${S.row}px`, color: 'var(--gc-text)' }}
              >
                {option.label}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GlideCombobox;
