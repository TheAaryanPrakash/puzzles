import { useState } from "react";
import { shareResult } from "../lib/share";
import { Button } from "./Button";
import type { ShareButtonProps } from "./types";

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
    <Button onClick={handleClick} className={className}>
      {copied ? `✓ ${sharedLabel}` : label}
    </Button>
  );
}
