import { useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { ExtendedFeatureCollection } from "d3-geo";
import type { GuessCategory, TravlePuzzle } from "../logic";
import type { CountryFeature } from "../useCountryGeo";
import { noSwipeProps } from "../../../lib/noSwipe";

const WIDTH = 960;
const HEIGHT = 500;

export interface MapProps {
  puzzle: TravlePuzzle;
  features: CountryFeature[];
  categories: Record<string, GuessCategory>;
}

function colorFor(code: string, puzzle: TravlePuzzle, categories: Record<string, GuessCategory>): string {
  if (code === puzzle.start) return "var(--travle-start)";
  if (code === puzzle.end) return "var(--travle-end)";
  switch (categories[code]) {
    case "on-path":
      return "var(--tile-correct)";
    case "adjacent":
      return "var(--tile-present)";
    case "unconnected":
      return "var(--tile-absent)";
    default:
      return "var(--travle-land)";
  }
}

/**
 * A decorative world map: purely a visual echo of the guess list below it (which is the real,
 * screen-reader-accessible record of guesses and their categories), so the whole SVG is
 * `aria-hidden`. Colours transition via a plain CSS `transition` (zeroed globally under
 * `prefers-reduced-motion` by brand.css), not Framer Motion — 236 independently-animating paths
 * would be wasteful for a purely cosmetic fill-colour change.
 */
export function Map({ puzzle, features, categories }: MapProps) {
  const pathGenerator = useMemo(() => {
    if (features.length === 0) return null;
    const collection: ExtendedFeatureCollection<CountryFeature> = {
      type: "FeatureCollection",
      features,
    };
    const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], collection);
    return geoPath(projection);
  }, [features]);

  if (!pathGenerator) {
    return (
      <div
        className="flex aspect-[960/500] w-full items-center justify-center rounded-brand-md bg-game-surface-2 text-sm text-game-muted"
        aria-hidden
      >
        Loading map…
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full rounded-brand-md"
      aria-hidden="true"
      role="presentation"
      {...noSwipeProps}
    >
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="var(--travle-sea)" />
      <g>
        {features.map((f) => (
          <path
            key={f.properties.iso_a2}
            d={pathGenerator(f) ?? undefined}
            fill={colorFor(f.properties.iso_a2, puzzle, categories)}
            stroke="var(--travle-land-border)"
            strokeWidth={0.5}
            style={{ transition: "fill var(--brand-duration-base) var(--brand-ease)" }}
          />
        ))}
      </g>
    </svg>
  );
}
