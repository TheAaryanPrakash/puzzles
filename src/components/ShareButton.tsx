import { useState } from "react";
import { shareResult } from "../lib/share";
import SpecularButton from "./fx/SpecularButton";
import type { ShareButtonProps } from "./types";

// SpecularButton's colour props resolve through an off-document canvas probe (see its own
// source), which can't read CSS custom properties — literal hex only, matching the approved
// site-tier swatches in docs/redesign/checkpoint-1/colors.png (same reason Quordle/Globle/Zip's
// logic.ts constants are literal hex instead of var() lookups).
const TINT = "#df497b";
const LINE = "#f47ba3";
const BASE = "#1c1215";
const TEXT = "#f5eaee";

export function ShareButton({
  text,
  label = "Share",
  sharedLabel = "Copied!",
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const method = await shareResult(text);
    if (method === "clipboard") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <SpecularButton
      size="sm"
      tint={TINT}
      tintOpacity={0.14}
      lineColor={LINE}
      baseColor={BASE}
      textColor={TEXT}
      onClick={handleClick}
      className={className}
    >
      {copied ? `✓ ${sharedLabel}` : label}
    </SpecularButton>
  );
}
