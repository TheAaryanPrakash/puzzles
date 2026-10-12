// Thin wrapper around the Stockfish Worker — UCI over postMessage/onmessage only. No Stockfish
// file is ever imported into src/; this just talks to the unmodified GPLv3 engine file in
// public/assets/chess/engine/ as a separate process via message passing (see RESEARCH.md's
// "Chosen design" for why that boundary matters). Not unit-testable under jsdom (no real
// Worker/WASM) — exercised by scripts/chess/*.mjs against a real browser instead.
import type { EngineCandidate } from "../logic";

export const ENGINE_SCRIPT_URL = "/assets/chess/engine/stockfish-19-lite-single.js";

export interface EngineSetOptions {
  skillLevel: number;
  limitStrength: boolean;
  elo?: number;
}

export interface GoParams {
  fen: string;
  movetimeMs: number;
  multipv: number;
}

const INFO_CP_RE = /^info .*\bmultipv (\d+) .*\bscore cp (-?\d+) .*\bpv (\S+)/;
const INFO_MATE_RE = /^info .*\bmultipv (\d+) .*\bscore mate (-?\d+) .*\bpv (\S+)/;
// A mate score always ranks above/below any realistic centipawn score, however far away the mate
// is — 100000 is comfortably outside any real search's cp range.
const MATE_SCORE_BASE = 100_000;

export class ChessEngine {
  private worker: Worker;
  private readyPromise: Promise<void>;

  constructor(scriptUrl: string = ENGINE_SCRIPT_URL) {
    this.worker = new Worker(scriptUrl);
    this.readyPromise = this.handshake();
  }

  private send(command: string): void {
    this.worker.postMessage(command);
  }

  private waitFor(predicate: (line: string) => boolean): Promise<string> {
    return new Promise((resolve) => {
      const handler = (event: MessageEvent<string>) => {
        if (predicate(event.data)) {
          this.worker.removeEventListener("message", handler);
          resolve(event.data);
        }
      };
      this.worker.addEventListener("message", handler);
    });
  }

  private async handshake(): Promise<void> {
    this.send("uci");
    await this.waitFor((line) => line === "uciok");
    await this.ping();
  }

  private async ping(): Promise<void> {
    this.send("isready");
    await this.waitFor((line) => line === "readyok");
  }

  /** Resolves once the initial UCI handshake has completed. */
  ready(): Promise<void> {
    return this.readyPromise;
  }

  async setOptions(options: EngineSetOptions): Promise<void> {
    await this.ready();
    this.send(`setoption name Skill Level value ${options.skillLevel}`);
    this.send(`setoption name UCI_LimitStrength value ${options.limitStrength}`);
    if (options.elo !== undefined) this.send(`setoption name UCI_Elo value ${options.elo}`);
    this.send("ucinewgame");
    await this.ping();
  }

  /** Runs one search and resolves with every MultiPV line reached before `bestmove` — the last
   *  (deepest) line seen per PV index, per RESEARCH.md §5. Always returns at least one candidate:
   *  if, for any reason, no `info ... pv ...` line was parsed, it falls back to the bare
   *  `bestmove` itself at cp 0 rather than returning nothing. */
  async go(params: GoParams): Promise<EngineCandidate[]> {
    await this.ready();
    this.send(`setoption name MultiPV value ${params.multipv}`);
    this.send(`position fen ${params.fen}`);

    return new Promise((resolve) => {
      const candidates = new Map<number, EngineCandidate>();
      const handler = (event: MessageEvent<string>) => {
        const line = event.data;
        const cpMatch = line.match(INFO_CP_RE);
        if (cpMatch) {
          candidates.set(Number(cpMatch[1]), { move: cpMatch[3], cp: Number(cpMatch[2]) });
          return;
        }
        const mateMatch = line.match(INFO_MATE_RE);
        if (mateMatch) {
          const mateIn = Number(mateMatch[2]);
          const cp = mateIn > 0 ? MATE_SCORE_BASE - mateIn : -MATE_SCORE_BASE - mateIn;
          candidates.set(Number(mateMatch[1]), { move: mateMatch[3], cp });
          return;
        }
        if (line.startsWith("bestmove")) {
          this.worker.removeEventListener("message", handler);
          const parsed = [...candidates.values()];
          if (parsed.length > 0) {
            resolve(parsed);
            return;
          }
          const bestmove = line.split(" ")[1];
          resolve(bestmove ? [{ move: bestmove, cp: 0 }] : []);
        }
      };
      this.worker.addEventListener("message", handler);
      this.send(`go movetime ${params.movetimeMs}`);
    });
  }

  terminate(): void {
    this.worker.terminate();
  }
}
