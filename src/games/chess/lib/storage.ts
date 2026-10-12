// Device-local only — chess never touches src/lib/data or Supabase (see RESEARCH.md). Namespaced
// like the rest of the site's own non-DataSource local state (src/lib/groups.ts's
// `sansitas-puzzles:active-group:<userId>`), keyed per signed-in user so a shared device doesn't
// mix accounts. Every read/write is wrapped in try/catch: a storage failure just means the choice
// or game doesn't persist, never a crash.
import { serializeGame, deserializeGame, DEFAULT_SETTINGS, type ChessSettings, type Difficulty, type GameState } from "../logic";

const GAME_KEY_PREFIX = "sansitas-puzzles:chess:game:";
const SETTINGS_KEY_PREFIX = "sansitas-puzzles:chess:settings:";
const RECORD_KEY_PREFIX = "sansitas-puzzles:chess:record:";

export interface DifficultyRecord {
  wins: number;
  losses: number;
  draws: number;
}

export type PersonalRecord = Record<Difficulty, DifficultyRecord> & {
  assisted: Record<Difficulty, DifficultyRecord>;
};

function emptyDifficultyRecord(): DifficultyRecord {
  return { wins: 0, losses: 0, draws: 0 };
}

export function emptyRecord(): PersonalRecord {
  return {
    easy: emptyDifficultyRecord(),
    medium: emptyDifficultyRecord(),
    hard: emptyDifficultyRecord(),
    assisted: { easy: emptyDifficultyRecord(), medium: emptyDifficultyRecord(), hard: emptyDifficultyRecord() },
  };
}

export function loadGame(userId: string): GameState | null {
  try {
    return deserializeGame(localStorage.getItem(GAME_KEY_PREFIX + userId));
  } catch {
    return null;
  }
}

export function saveGame(userId: string, state: GameState): void {
  try {
    localStorage.setItem(GAME_KEY_PREFIX + userId, serializeGame(state));
  } catch {
    // Unavailable (private browsing, disabled storage) — the game just won't persist.
  }
}

export function clearGame(userId: string): void {
  try {
    localStorage.removeItem(GAME_KEY_PREFIX + userId);
  } catch {
    // Nothing to do — if it couldn't be written, it isn't there to remove either.
  }
}

export function loadSettings(userId: string): ChessSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY_PREFIX + userId);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ChessSettings>;
    if (
      (parsed.difficulty === "easy" || parsed.difficulty === "medium" || parsed.difficulty === "hard") &&
      (parsed.side === "white" || parsed.side === "black" || parsed.side === "random") &&
      (parsed.clockPreset === "off" || parsed.clockPreset === "3+2" || parsed.clockPreset === "5+0" || parsed.clockPreset === "10+0")
    ) {
      return parsed as ChessSettings;
    }
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(userId: string, settings: ChessSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY_PREFIX + userId, JSON.stringify(settings));
  } catch {
    // The next game just starts from DEFAULT_SETTINGS again.
  }
}

function isDifficultyRecord(v: unknown): v is DifficultyRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.wins === "number" && typeof r.losses === "number" && typeof r.draws === "number";
}

function isPersonalRecord(v: unknown): v is PersonalRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  const tiers: Difficulty[] = ["easy", "medium", "hard"];
  if (!tiers.every((t) => isDifficultyRecord(r[t]))) return false;
  const assisted = r.assisted as Record<string, unknown> | undefined;
  return Boolean(assisted) && tiers.every((t) => isDifficultyRecord(assisted![t]));
}

export function loadRecord(userId: string): PersonalRecord {
  try {
    const raw = localStorage.getItem(RECORD_KEY_PREFIX + userId);
    if (!raw) return emptyRecord();
    const parsed = JSON.parse(raw);
    return isPersonalRecord(parsed) ? parsed : emptyRecord();
  } catch {
    return emptyRecord();
  }
}

function saveRecord(userId: string, record: PersonalRecord): void {
  try {
    localStorage.setItem(RECORD_KEY_PREFIX + userId, JSON.stringify(record));
  } catch {
    // The tally just won't remember this result.
  }
}

/** Reads the current record, applies one result, writes it back, and returns the new record. */
export function recordResult(
  userId: string,
  difficulty: Difficulty,
  outcome: "won" | "lost" | "drawn",
  assisted: boolean,
): PersonalRecord {
  const record = loadRecord(userId);
  const bucket = assisted ? record.assisted[difficulty] : record[difficulty];
  const field = outcome === "won" ? "wins" : outcome === "lost" ? "losses" : "draws";
  bucket[field] += 1;
  saveRecord(userId, record);
  return record;
}
