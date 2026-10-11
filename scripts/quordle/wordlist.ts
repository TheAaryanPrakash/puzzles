// Pure word-pool building, kept separate from file I/O so it's trivially testable.
// Per CLAUDE.md "Word data": valid guesses = ENABLE1 5-letter words; fair answers =
// ENABLE1 ∩ common.txt, 5-letter, minus blocklist.txt entries.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const FIVE_LETTER_WORD = /^[a-z]{5}$/;

function parseWords(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => FIVE_LETTER_WORD.test(line));
}

export interface WordPools {
  /** All ENABLE1 5-letter words, uppercase — the valid-guess list shipped to the client. */
  validGuesses: string[];
  /** ENABLE1 ∩ common, minus blocklist, uppercase — candidates for daily answers. */
  fairAnswers: string[];
}

/** Builds both pools from the three raw wordlist file contents (pure — no file I/O). */
export function buildWordPools(enable1Raw: string, commonRaw: string, blocklistRaw: string): WordPools {
  const enable1 = new Set(parseWords(enable1Raw));
  const common = new Set(parseWords(commonRaw));
  const blocklist = new Set(parseWords(blocklistRaw));

  const validGuesses = [...enable1].sort();
  const fairAnswers = validGuesses.filter((w) => common.has(w) && !blocklist.has(w));

  return {
    validGuesses: validGuesses.map((w) => w.toUpperCase()),
    fairAnswers: fairAnswers.map((w) => w.toUpperCase()),
  };
}

/** Reads the three wordlist files from `wordlists/` (repo root) and builds the pools. */
export async function loadWordPools(repoRoot: string): Promise<WordPools> {
  const [enable1Raw, commonRaw, blocklistRaw] = await Promise.all([
    readFile(resolve(repoRoot, "wordlists/enable1.txt"), "utf8"),
    readFile(resolve(repoRoot, "wordlists/common.txt"), "utf8"),
    readFile(resolve(repoRoot, "wordlists/blocklist.txt"), "utf8"),
  ]);
  return buildWordPools(enable1Raw, commonRaw, blocklistRaw);
}
