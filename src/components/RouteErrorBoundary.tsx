import { useEffect } from "react";
import { useRouteError } from "react-router";
import { Button } from "./Button";

const RELOADED_FLAG = "route-error-reloaded";

/** A lazy-loaded game chunk is fetched by its exact content hash. After a new deploy replaces
 *  those files, a tab that loaded the app before the deploy still references the old hash, which
 *  404s — this message is how Vite/the browser reports that specific failure. */
function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|error loading dynamically imported module/i.test(message);
}

/**
 * Root error boundary for the router (see routes.tsx). A stale-chunk failure is fixed by
 * reloading — the fresh index.html points at the current deploy's file hashes — so that happens
 * automatically, once per tab session (sessionStorage survives the reload but not a closed tab).
 * If the *same* error recurs right after that reload, it's not staleness, so this falls through to
 * a manual-reload screen instead of looping forever. Any other error always shows that screen.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const staleChunk = isStaleChunkError(error);
  const alreadyReloaded = sessionStorage.getItem(RELOADED_FLAG) === "1";

  useEffect(() => {
    if (!staleChunk || alreadyReloaded) return;
    sessionStorage.setItem(RELOADED_FLAG, "1");
    window.location.reload();
  }, [staleChunk, alreadyReloaded]);

  if (staleChunk && !alreadyReloaded) return null; // reloading now — avoid a flash of error UI

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-bg p-6 text-center">
      <p className="text-3xl" aria-hidden>
        🧩
      </p>
      <h1 className="font-brand text-2xl font-semibold text-brand-fg">Something went wrong</h1>
      <p className="max-w-sm text-sm text-brand-muted">
        Reloading usually fixes it — sorry about that.
      </p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  );
}
