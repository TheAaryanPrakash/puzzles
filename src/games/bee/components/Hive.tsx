import { motion, useReducedMotion } from "motion/react";

export interface HiveProps {
  center: string;
  outer: string[];
  onLetterTap: (letter: string) => void;
  disabled?: boolean;
  /** Changes on every rejected submission to retrigger the shake animation. */
  shakeNonce: number;
  /** Changes on every accepted submission to retrigger the center hex's pop animation. */
  popNonce: number;
}

// Classic hive "flower": one outer hex per 60°, starting straight up, clockwise — matches the
// real game's layout (a center hex touched by a ring of six).
const ANGLES = [-90, -30, 30, 90, 150, 210];
const RADIUS_PCT = 92; // of hex width — tuned so the ring sits snugly around the center hex

export function Hive({ center, outer, onLetterTap, disabled, shakeNonce, popNonce }: HiveProps) {
  const reduceMotion = useReducedMotion();

  const outerHexes = outer.map((letter, i) => {
    const angle = (ANGLES[i % ANGLES.length] * Math.PI) / 180;
    const x = Math.cos(angle) * RADIUS_PCT;
    const y = Math.sin(angle) * RADIUS_PCT;
    return (
      <button
        key={letter}
        type="button"
        onClick={() => onLetterTap(letter)}
        disabled={disabled}
        aria-label={`Letter ${letter}`}
        className="bee-hex bee-hex-outer absolute left-1/2 top-1/2"
        style={{ translate: `calc(-50% + ${x}%) calc(-50% + ${y}%)` }}
      >
        {letter}
      </button>
    );
  });

  const centerHex = reduceMotion || popNonce === 0 ? (
    <button
      type="button"
      onClick={() => onLetterTap(center)}
      disabled={disabled}
      aria-label={`Letter ${center} (center, required in every word)`}
      className="bee-hex bee-hex-center absolute left-1/2 top-1/2"
      style={{ translate: "-50% -50%" }}
    >
      {center}
    </button>
  ) : (
    <motion.button
      key={popNonce}
      type="button"
      onClick={() => onLetterTap(center)}
      disabled={disabled}
      aria-label={`Letter ${center} (center, required in every word)`}
      className="bee-hex bee-hex-center absolute left-1/2 top-1/2"
      style={{ translate: "-50% -50%" }}
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 0.3 }}
    >
      {center}
    </motion.button>
  );

  const frame = (
    <>
      {centerHex}
      {outerHexes}
    </>
  );

  return (
    <div
      role="group"
      aria-label="Letter hive"
      className="relative mx-auto"
      style={{
        width: "calc(var(--bee-hex-size) * 3.2)",
        height: "calc(var(--bee-hex-size) * 3.6)",
      }}
    >
      {reduceMotion || shakeNonce === 0 ? (
        frame
      ) : (
        <motion.div
          key={shakeNonce}
          className="absolute inset-0"
          initial={{ x: 0 }}
          animate={{ x: [0, -8, 8, -6, 6, 0] }}
          transition={{ duration: 0.35 }}
        >
          {frame}
        </motion.div>
      )}
    </div>
  );
}
