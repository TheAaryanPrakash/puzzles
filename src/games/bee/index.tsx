import { useEffect, useRef, useState } from "react";
import "@fontsource/libre-franklin/400.css";
import "@fontsource/libre-franklin/700.css";
import "@fontsource/libre-franklin/800.css";
import "./theme.css";
import { GameLayout } from "../../components/GameLayout";
import { HelpModal } from "../../components/HelpModal";
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishingRef = useRef(false);

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
  // calendar day never bleeds indefinitely into the next (see RESEARCH.md "Completion").
  // `todayKey()` here only detects "is this a past day" — never which puzzle to show, which
  // always comes from `usePuzzle`'s own `date`.
  useEffect(() => {
    if (status !== "ready" || !puzzle || !play) return;
    if (play.status === "in_progress" && date < todayKey()) {
      void doFinish((play.state as Partial<BeeState> | undefined)?.found ?? [], puzzle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, puzzle, play, date]);

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
      <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
        <NoPuzzleToday gameTitle={meta.title} />
        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
          <HelpRulesBody />
        </HelpModal>
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
    <GameLayout game={meta.id} title={meta.title} onHelp={() => setHelpOpen(true)}>
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

        <FoundWords found={state.found} puzzle={activePuzzle} />
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)}>
        <HelpRulesBody />
      </HelpModal>

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

function HelpRulesBody() {
  return (
    <>
      <p>
        Make words of at least 4 letters using the 7 letters in the hive. Every word must include
        the center letter. Letters can repeat.
      </p>
      <p>4-letter words are worth 1 point; longer words are worth 1 point per letter.</p>
      <p>
        A <strong>pangram</strong> — a word using all 7 letters — earns a +7 point bonus.
      </p>
      <p>Reach Genius to win the day. Find every word to become Queen Bee.</p>
    </>
  );
}
