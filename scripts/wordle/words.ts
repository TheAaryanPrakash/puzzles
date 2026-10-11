// Pure word-list filtering logic for the Wordle generator — kept separate from generate.ts (which
// touches the filesystem) so it can be unit tested directly. See CLAUDE.md "Word data" and
// prompts/wordle.md "Generator" for the exact rules this implements.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const WORD_LENGTH = 5;
export const COMMON_RANK_CUTOFF = 15000;

export interface WordLists {
  /** Full ENABLE word list (every length), lowercase — the valid-guess dictionary. */
  enable: Set<string>;
  /** common.txt in frequency-rank order, index 0 = rank 1, lowercase. */
  commonByRank: string[];
  blocklist: Set<string>;
}

function linesOf(path: string): string[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .map((w) => w.trim())
    .filter(Boolean);
}

export function loadWordLists(root: string): WordLists {
  return {
    enable: new Set(linesOf(resolve(root, "wordlists/enable1.txt"))),
    commonByRank: linesOf(resolve(root, "wordlists/common.txt")),
    blocklist: new Set(linesOf(resolve(root, "wordlists/blocklist.txt"))),
  };
}

/** Ends in "s" with an ENABLE stem — e.g. "cards" (stem "card", a real word) is filtered as a plural. */
export function isPlural(word: string, enable: ReadonlySet<string>): boolean {
  return word.endsWith("s") && enable.has(word.slice(0, -1));
}

/** Ends in "ed" with an ENABLE stem — e.g. "acted" (stem "act", a real word) is filtered as a past tense. */
export function isPastTense(word: string, enable: ReadonlySet<string>): boolean {
  return word.endsWith("ed") && enable.has(word.slice(0, -2));
}

const ALPHA_ONLY = /^[a-z]+$/;

/** Every valid 5-letter guess: the full ENABLE list, length-filtered. This is also every possible answer. */
export function buildGuessList(enable: ReadonlySet<string>): string[] {
  return [...enable].filter((w) => w.length === WORD_LENGTH && ALPHA_ONLY.test(w)).sort();
}

/**
 * Fair answers: ENABLE ∩ common (rank < COMMON_RANK_CUTOFF), minus blocklist, plurals and past
 * tenses. Order follows common.txt's frequency rank (most common first) — generate.ts shuffles it.
 */
export function buildAnswerPool(lists: WordLists): string[] {
  const { enable, commonByRank, blocklist } = lists;
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const word of commonByRank.slice(0, COMMON_RANK_CUTOFF)) {
    if (word.length !== WORD_LENGTH) continue;
    if (seen.has(word)) continue;
    if (!enable.has(word)) continue;
    if (blocklist.has(word)) continue;
    if (isPlural(word, enable)) continue;
    if (isPastTense(word, enable)) continue;
    seen.add(word);
    pool.push(word);
  }
  return pool;
}
