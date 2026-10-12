import { useEffect, useRef, useState } from "react";
import "./theme.css";
import { GameLayout } from "../../components/GameLayout";
import { HowToPlayModal, useAutoOpenHowToPlay } from "../../components/HowToPlayModal";
import { useAuth } from "../../lib/auth";
import { ResultModal } from "../../components/ResultModal";
import { NoPuzzleToday } from "../../components/NoPuzzleToday";
import { AlreadyPlayed } from "../../components/AlreadyPlayed";
import { Button } from "../../components/Button";
import { usePuzzle, usePlay } from "../../lib/hooks";
import { dayIndex, shuffle, todayKey } from "../../lib/daily";
import { Hive } from "./components/Hive";
import { RankBar } from "./components/RankBar";
import { FoundWords } from "./components/FoundWords";
import { meta } from "./meta";
import {
  DEFAULT_STATE,
  buildSummary,
  initialOuterOrder,
  isPangram,
  isQueenBee,
  rankFor,
  reachedGenius,
  totalScore,
  validateWord,
  type BeePuzzle,
  type BeeState,
  type InvalidReason,
} from "./logic";

const REASON_MESSAGE: Record<InvalidReason, string> = {
  "too-short": "Too short",
  "invalid-letter": "Invalid letter",
  "missing-center": "Missing center letter",
  "not-in-word-list": "Not in word list",
  "already-found": "Already found",
};

function successMessageFor(word: string, puzzle: BeePuzzle): string {
  if (isPangram(word, puzzle)) return "Pangram! 🎉";
  if (word.length >= 8) return "Amazing!";
  if (word.length >= 7) return "Excellent!";
  if (word.length >= 6) return "Great!";
  if (word.length >= 5) return "Good!";
  return "Nice!";
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE_TAGS.has(target.tagName)) return true;
  return target.isContentEditable;
}

export default function BeeGame() {
  const { date, puzzle, status } = usePuzzle<BeePuzzle>(meta.id);
  const { play, loading, start, save, finish } = usePlay<BeeState>(meta.id, date);
  const [buffer, setBuffer] = useState("");
  const [outerOrder, setOuterOrder] = useState<string[]>([]);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [shakeNonce, setShakeNonce] = useState(0);
  const [popNonce, setPopNonce] = useState(0);
  const { member } = useAuth();
  const [helpOpen, openHelp, closeHelp] = useAutoOpenHowToPlay(meta.id, member?.userId);
  const [resultOpen, setResultOpen] = useState(false);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishingRef = useRef(false);
  // Which date's "was this already in progress from a prior session" check has run — a `save()`
  // during this session updates `play` optimistically, which must NOT retrigger the check below.
  const autoFinishCheckedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (puzzle) setOuterOrder(initialOuterOrder(puzzle, date));
  }, [puzzle, date]);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  function flashMessage(text: string, tone: "error" | "success") {
    setMessage({ text, tone });
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageTimerRef.current = setTimeout(() => setMessage(null), 1600);
  }

  const over = !!play && play.status !== "in_progress";
  const state: BeeState = { ...DEFAULT_STATE, ...play?.state };
  const puzzleNumber = dayIndex(date) + 1;

  async function doFinish(found: string[], activePuzzle: BeePuzzle) {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const score = totalScore(found, activePuzzle);
    await finish({
      won: reachedGenius(score, activePuzzle),
      state: { found },
      summary: buildSummary(found, activePuzzle, puzzleNumber),
      score,
    });
    setResultOpen(true);
  }

  // An earlier day's puzzle left in progress auto-finishes the moment it's reopened, so one
  // calendar day never bleeds indefinitely into the next (see RESEARCH.md "Completion"). Runs
  // exactly once per date, right after that date's play has finished loading — NOT on every
  // `play` update, since `save()` below updates `play` optimistically while actively playing an
  // archive day in this same session, and that must never retrigger this check.
  // `todayKey()` here only detects "is this a past day" — never which puzzle to show, which
  // always comes from `usePuzzle`'s own `date`.
  useEffect(() => {
    if (status !== "ready" || !puzzle || loading) return;
    if (autoFinishCheckedForRef.current === date) return;
    autoFinishCheckedForRef.current = date;
    if (play && play.status === "in_progress" && date < todayKey()) {
      void doFinish((play.state as Partial<BeeState> | undefined)?.found ?? [], puzzle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, puzzle, loading, date, play]);

  useEffect(() => {
    function onPhysicalKey(e: KeyboardEvent) {
      if (over || !puzzle) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setBuffer((b) => b.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const letter = e.key.toUpperCase();
        if (letter === puzzle.center || puzzle.outer.includes(letter)) {
          e.preventDefault();
          setBuffer((b) => b + letter);
        }
      }
    }
    window.addEventListener("keydown", onPhysicalKey);
    return () => window.removeEventListener("keydown", onPhysicalKey);
    // handleSubmit reads live state via closures below; re-registering per render keeps it current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  if (status === "loading" || loading) return null;

  if (status === "missing" || !puzzle) {
    return (
      <GameLayout game={meta.id} title={meta.title} onHelp={openHelp}>
        <NoPuzzleToday gameTitle={meta.title} />
        <HowToPlayModal game={meta} open={helpOpen} onClose={closeHelp} />
      </GameLayout>
    );
  }

  const activePuzzle = puzzle;
  const score = totalScore(state.found, activePuzzle);
  const { index: rankIndex } = rankFor(score, activePuzzle);

  function handleLetterTap(letter: string) {
    if (over) return;
    setBuffer((b) => b + letter);
  }

  async function handleSubmit() {
    if (over || buffer.length === 0) return;
    const result = validateWord(buffer, activePuzzle, state.found);
    setBuffer("");
    if (!result.ok) {
      setShakeNonce((n) => n + 1);
      flashMessage(REASON_MESSAGE[result.reason], "error");
      return;
    }

    const nextFound = [...state.found, result.word];
    setPopNonce((n) => n + 1);
    flashMessage(successMessageFor(result.word, activePuzzle), "success");

    if (!play) await start();
    save({ state: { found: nextFound } });

    if (isQueenBee(nextFound, activePuzzle)) {
      await doFinish(nextFound, activePuzzle);
    }
  }

  function handleDelete() {
    if (over) return;
    setBuffer((b) => b.slice(0, -1));
  }

  function handleShuffle() {
    setOuterOrder((order) => shuffle(order, Math.random));
  }

  async function handleFinishForToday() {
    await doFinish(state.found, activePuzzle);
  }

  return (
    <GameLayout game={meta.id} title={meta.title} onHelp={openHelp}>
      {play && over && !resultOpen && <AlreadyPlayed status={play.status} />}

      <div className="flex flex-col items-center gap-5">
        <div className="w-full max-w-sm">
          <RankBar score={score} puzzle={activePuzzle} rankIndex={rankIndex} />
        </div>

        <div
          className="flex h-7 items-center justify-center text-sm font-semibold"
          role="status"
          aria-live="polite"
        >
          {message?.text ?? " "}
        </div>

        <div className="flex min-h-10 items-center justify-center gap-1 font-brand text-2xl font-bold uppercase tracking-wide text-game-fg">
          {buffer.split("").map((ch, i) => (
            <span key={i} className={ch === activePuzzle.center ? "text-game-accent" : undefined}>
              {ch}
            </span>
          ))}
          {buffer.length === 0 && <span className="text-game-muted">&nbsp;</span>}
        </div>

        <Hive
          center={activePuzzle.center}
          outer={outerOrder.length ? outerOrder : activePuzzle.outer}
          onLetterTap={handleLetterTap}
          disabled={over}
          shakeNonce={shakeNonce}
          popNonce={popNonce}
        />

        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleDelete} disabled={over || buffer.length === 0}>
            Delete
          </Button>
          <Button variant="ghost" onClick={handleShuffle} disabled={over} aria-label="Shuffle letters">
            🔀 Shuffle
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={over || buffer.length === 0}>
            Enter
          </Button>
        </div>

        {!over && (
          <Button variant="secondary" size="sm" onClick={() => void handleFinishForToday()}>
            Finish for today
          </Button>
        )}

        {over && (
          <Button onClick={() => setResultOpen(true)}>
            {play?.status === "won" ? "Nice! 🎉" : "See result"}
          </Button>
        )}

        <FoundWords found={state.found} puzzle={activePuzzle} />
      </div>

      <HowToPlayModal game={meta} open={helpOpen} onClose={closeHelp} />

      {over && (
        <ResultModal
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          gameId={meta.id}
          date={date}
          won={play?.status === "won"}
          summary={play?.summary ?? buildSummary(state.found, activePuzzle, puzzleNumber)}
          score={score}
          puzzleNumber={puzzleNumber}
          extraContent={
            <div className="space-y-3">
              <RankBar score={score} puzzle={activePuzzle} rankIndex={rankIndex} />
              <FoundWords found={state.found} puzzle={activePuzzle} />
            </div>
          }
        />
      )}
    </GameLayout>
  );
}

