export type ShareMethod = "share" | "clipboard";

/**
 * Shares spoiler-free result text via the Web Share API where available, falling back to
 * copying it to the clipboard. Resolves with which method succeeded; throws only if both are
 * unavailable or the clipboard write itself fails (a user-cancelled share is not an error).
 */
export async function shareResult(text: string): Promise<ShareMethod> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return "share";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "share";
      // Any other failure (e.g. share target error) falls through to the clipboard.
    }
  }
  await navigator.clipboard.writeText(text);
  return "clipboard";
}
