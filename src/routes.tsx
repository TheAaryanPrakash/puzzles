import { lazy, Suspense, type ComponentType } from "react";
import type { RouteObject } from "react-router";
import type { GameMeta } from "./lib/types";
import { RequireMember } from "./lib/auth";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { Hub } from "./pages/Hub";
import { SignIn } from "./pages/SignIn";
import { Join } from "./pages/Join";
import { Profile } from "./pages/Profile";
import { Groups } from "./pages/Groups";
import { Leaderboard } from "./pages/Leaderboard";
import { Finale } from "./pages/Finale";
import { DevThemes } from "./pages/DevThemes";
import { DevRedesignPreview } from "./components/fx/__preview__/DevRedesignPreview";

// Every game opts in just by existing at src/games/<id>/{meta.ts,index.tsx} — nothing to register.
const metaModules = import.meta.glob("./games/*/meta.ts", { eager: true }) as Record<
  string,
  { meta: GameMeta }
>;
const indexModules = import.meta.glob("./games/*/index.tsx") as Record<
  string,
  () => Promise<{ default: ComponentType }>
>;

const discoveredGames = Object.entries(metaModules)
  .map(([path, mod]) => ({ dir: path.replace(/\/meta\.ts$/, ""), meta: mod.meta }))
  .sort((a, b) => a.meta.order - b.meta.order);

/** Every discovered game, for the router. */
export const allGameMetas: GameMeta[] = discoveredGames.map((g) => g.meta);

/** Games the Hub should list — ids starting with "_" (e.g. _example) are dev-only scaffolding. */
export const gameMetas: GameMeta[] = import.meta.env.PROD
  ? allGameMetas.filter((meta) => !meta.id.startsWith("_"))
  : allGameMetas;

/**
 * The daily puzzle games only — excludes dev-only scaffolding (`_example`) and anything marked
 * `scored: false` (chess). Computed off `allGameMetas` rather than `gameMetas`, so it's always the
 * same 14 regardless of `import.meta.env.PROD` — including in tests. This is what the Hub's
 * "X / 14" count, and anything else that needs "how many daily games are there," should read;
 * `gameMetas` is still what decides which cards actually render.
 */
export const scoredGameMetas: GameMeta[] = allGameMetas.filter(
  (meta) => !meta.id.startsWith("_") && meta.scored !== false,
);

function gameRoutes(): RouteObject[] {
  return discoveredGames.map(({ dir, meta }) => {
    const Component = lazy(indexModules[`${dir}/index.tsx`]);
    return {
      path: `/${meta.id}`,
      element: (
        <RequireMember>
          <Suspense fallback={null}>
            <Component />
          </Suspense>
        </RequireMember>
      ),
    };
  });
}

export const routes: RouteObject[] = [
  {
    // Pathless layout route: every page below shares this root error boundary, most importantly
    // for a stale lazy-loaded game chunk after a new deploy (see RouteErrorBoundary).
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "/", element: <RequireMember><Hub /></RequireMember> },
      { path: "/signin", element: <SignIn /> },
      { path: "/join", element: <Join /> },
      { path: "/profile", element: <RequireMember><Profile /></RequireMember> },
      { path: "/groups", element: <RequireMember><Groups /></RequireMember> },
      { path: "/leaderboard", element: <RequireMember><Leaderboard /></RequireMember> },
      { path: "/finale", element: <RequireMember><Finale /></RequireMember> },
      ...gameRoutes(),
      ...(import.meta.env.DEV ? [{ path: "/dev/themes", element: <DevThemes /> }] : []),
      ...(import.meta.env.DEV
        ? [{ path: "/dev/redesign-preview", element: <DevRedesignPreview /> }]
        : []),
    ],
  },
];
