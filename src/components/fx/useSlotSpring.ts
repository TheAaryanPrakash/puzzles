// Spring motion extracted from React Bits' Code Slots (https://reactbits.dev/micro/code-slots,
// MIT + Commons Clause License Condition v1.0, Copyright (c) 2026 David Haz — see
// docs/redesign/HANDOFF.md) — NOT a copy of that component. Code Slots owns a single hidden
// `<input>` and drives its own visual slots from it; this hook owns nothing. It only answers "what
// should slot i's transform/opacity be, given whether it's filled right now", so Wordle/Quordle can
// apply the same "the letter springs up into its tile" motion to tiles driven by their own on-screen
// + physical-keyboard input, flip-reveal and shake — none of which this hook knows about or touches.
'use client';

import { useEffect, useMemo, useRef } from 'react';
import { animate, motionValue, useReducedMotion, type MotionValue } from 'motion/react';

export interface UseSlotSpringOptions {
  /** How far (px) the character rises in from below as it springs into place. Default 10. */
  rise?: number;
  /** Spring bounce, 0–1. Default 0.3 (a light overshoot, matching Code Slots' own default feel). */
  bounce?: number;
  /** Spring settle duration in seconds. Default 0.3. */
  duration?: number;
}

export interface SlotSpring {
  /** The slot's fill progress as a motion value, 0 (empty) → 1 (filled) — e.g. for scaling an
   *  accent wash behind the character, independently of the transform/opacity below. */
  fill: MotionValue<number>;
  /** Spread directly into a `motion.span`'s `style`: rises the character in and fades it in as the
   *  slot fills, and reverses on clear. Plain MotionValues, not derived via `useTransform` — safe
   *  to produce for a variable-length, dynamically-sized slot array (seeC the file header). */
  style: { transform: MotionValue<string>; opacity: MotionValue<number> };
}

const outputsFor = (t: number, rise: number) => ({
  transform: `translateY(${(1 - Math.max(t, 0)) * rise}px)`,
  opacity: Math.min(1, Math.max(t, 0))
});

/**
 * `filled`: one boolean per slot, in order — true once that slot has a character to show. Flip an
 * entry from false→true (a letter was typed) or true→false (backspace/clear) and the matching slot
 * springs in or resets; every other slot is untouched. Length changes (e.g. switching word length)
 * are handled by growing/shrinking the internal motion-value array, not by resetting existing ones.
 */
export function useSlotSpring(filled: boolean[], options: UseSlotSpringOptions = {}): SlotSpring[] {
  const { rise = 10, bounce = 0.3, duration = 0.3 } = options;
  const reduce = useReducedMotion();
  const optionsRef = useRef({ rise, bounce, duration, reduce });
  optionsRef.current = { rise, bounce, duration, reduce };

  // One (fill, transform, opacity) motion-value triple per slot, created lazily and kept across
  // renders — never recreated just because `filled` changed, only when the slot count itself
  // grows or shrinks. `transform`/`opacity` are plain motionValues kept in sync imperatively from
  // `fill` below (via animate()'s onUpdate, or directly on a reduced-motion jump), NOT produced
  // with useTransform — calling a hook once per slot inside a variable-length array isn't safe.
  const slots = useMemo(
    () =>
      Array.from({ length: filled.length }, (_, i) => {
        const initial = filled[i] ? 1 : 0;
        const out = outputsFor(initial, optionsRef.current.rise);
        return {
          fill: motionValue(initial),
          transform: motionValue(out.transform),
          opacity: motionValue(out.opacity)
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filled.length]
  );
  const prevRef = useRef<boolean[]>([]);

  useEffect(() => {
    const prev = prevRef.current;
    const O = optionsRef.current;
    filled.forEach((isFilled, i) => {
      const slot = slots[i];
      if (!slot) return;
      const was = prev[i] ?? false;
      if (was === isFilled) return;
      const target = isFilled ? 1 : 0;
      const apply = (t: number) => {
        const out = outputsFor(t, O.rise);
        slot.transform.set(out.transform);
        slot.opacity.set(out.opacity);
      };
      if (O.reduce) {
        slot.fill.jump(target);
        apply(target);
        return;
      }
      if (isFilled && slot.fill.get() > 0) slot.fill.jump(0);
      animate(slot.fill, target, {
        type: 'spring',
        duration: O.duration,
        bounce: O.bounce,
        onUpdate: apply
      });
    });
    prevRef.current = filled;
  }, [filled, slots]);

  return slots.map(({ fill, transform, opacity }) => ({ fill, style: { transform, opacity } }));
}
