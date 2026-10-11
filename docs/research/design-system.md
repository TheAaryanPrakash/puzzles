# Design system — research & decisions

Agent: `design`. Scope: `src/styles/`, `src/components/` (not `types.ts`), `src/pages/Hub.tsx`,
`src/pages/DevThemes.tsx`.

## Skills read

`design-system`, `ui-ux-pro-max`, `design-taste-frontend`, `high-end-visual-design`,
`modern-web-design`, `ui-styling`, `motion-framer`, `brand`, `web-design-guidelines`,
`playwright-cli`. Notes on each below, under the decision it shaped.

## What the reference products do

- **NYT Games hub**: a small set of game tiles, each showing today's status (played/streak),
  a separate Stats surface per game, badges for streak milestones. Portfolio navigation — the
  hub's job is to route between many daily games, not to showcase one.
  ([TechCrunch coverage of the app redesign](https://techcrunch.com/2024/05/07/nyt-games-wordle-archive-access-1000-past-puzzles))
- **Wordle result modal**: headline, the emoji-grid share text, a stats row (played/win%/
  streak/max streak), a guess-distribution bar chart, a share button, and a countdown to the
  next puzzle. This is almost exactly our frozen `ResultModalProps` shape already — the
  foundation agent modeled it on this.
- **Connections share format**: coloured emoji squares, one row per guess, colour = category;
  a mixed-colour row = a wrong guess; row order = solve order. Confirms our `summary` contract
  (spoiler-free, emoji-groupable, one string) generalizes across games — each game owns its own
  emoji-grid construction in its own `logic.ts`, ResultModal just displays the string.
  ([Tom's Guide: how to play Connections](https://www.tomsguide.com/how-to/how-to-play-nyt-connections))
- **Open-source clones** (`cwackerfuss/react-wordle`, `amoghaUdupa/word-guessing-game`,
  `williamyeny/wrdl`): all converge on the same pattern — a title bar with help/stats/settings
  icon buttons, a centred board, an on-screen keyboard, and headless/Tailwind modals for
  help/stats/result. That convergence is exactly what `GameLayout` + `Modal` + `HelpModal` +
  `StatsModal` already encode; nothing here argues for deviating from the frozen contract, only
  for how richly to decorate it.

## Decisions, and which skill shaped them

**Palette — `ui-ux-pro-max` (`--design-system` search) + manual WCAG pass.**
Ran `search.py "warm playful daily puzzle game hub friendly" --design-system`: it recommended
Fredoka/Nunito for the "playful, friendly, warm, approachable" mood (confirms CLAUDE.md's
starting pairing — no change needed) and a "Claymorphism" style note (soft 3D, chunky rounded,
thick borders, double shadows, 16–24px radii) for children's/casual-game products. It also
recommended a pink/purple/gold palette — CLAUDE.md's explicit cream + coral/peach direction
wins over the skill's generic suggestion per the project's "when a skill and this file disagree,
this file wins" rule, so I kept cream/coral and used Claymorphism only for *texture*
(see "Shape & elevation" below), not hue.

I then ran the WCAG contrast numbers on the existing coral (`#ef8354`) and found white text on
it is only ~2.6:1 — too low. Rather than darken the coral into a muddier burnt-orange (which
stops reading as "coral/peach"), I kept the coral and switched `--brand-accent-fg` to the
site's dark warm brown (`#2b2320`), which gets 5.9:1 — a common accessible pattern for pastel
brand colours (dark text on a light accent, not white text on a mid-tone accent). I also
deepened `--brand-muted` (3.66:1 → 4.58:1+), `--brand-success` and `--brand-danger` by a few
percent lightness each so every text-bearing token clears 4.5:1 against its typical background.
Token *values* changed; no token was renamed, per the frozen-names rule.

Tile colours (`--tile-correct/present/absent`) are Wordle's own green/yellow/grey. These are
genuinely low-contrast for white text at small bold sizes (~2–3:1) — this is a known, accepted
trade-off in the real game and every clone surveyed above; I nudged them a little darker for a
small legibility gain but did not chase 4.5:1, since that would mean abandoning the colours that
make the tile recognizably "Wordle" the moment you see it. These are also just the *neutral
default* for games that don't override `--tile-*` in their own `theme.css` — the Wordle agent's
own research should have the final say on its exact palette.

**Shape & elevation — `high-end-visual-design` (Double-Bezel) + `design-taste-frontend`
(Shape Consistency Lock), toned way down.** Both skills are written for marketing/agency sites,
not a friends' puzzle hub, so I took only the craft habits that generalize: *pick one
corner-radius scale and hold it everywhere* (already true of `--brand-radius-*`, so I didn't
touch the names, only doubled down on using them consistently across every component), and
*tint shadows to the background hue instead of pure black* (I added `--brand-shadow-sm/md`
as new, optional tokens — additive, so the frozen-names rule is satisfied — built from
`--brand-fg` at low alpha instead of generic `rgba(0,0,0,…)`). I deliberately skipped the
"Double-Bezel" nested-architecture pattern itself (outer shell + inner core per card): it's
built for dense marketing bento grids, and our cards (game tiles, modal body) are simple enough
that a second nested layer would just be visual noise on a 375px hub. One soft shadow + one
hairline border reads as "machined/soft 3D" enough for a 14-tile grid without the overhead.

**Motion — `motion-framer`.** Used the `motion` package (already installed) for: Button press
feedback (`whileTap={{ scale: 0.96 }}`), Modal entrance/exit (`AnimatePresence` + spring scale +
fade), a hub card hover/press lift, and the Hub/DevThemes card-grid stagger-in on mount via
`whileInView`-less `initial`/`animate` (mount-only, no scroll listener — avoids the
`window.addEventListener('scroll')` anti-pattern flagged by both `motion-framer` and
`design-taste-frontend`). Every motion value respects `prefers-reduced-motion` through Motion's
own `useReducedMotion()`, on top of the blanket CSS kill-switch already in `brand.css`. Spring
values are gentle (`stiffness: 300, damping: 24`-ish) — "soft press", not "snappy SaaS" — to
match "warm and playful" rather than "crisp and corporate".

**Anti-slop discipline — `design-taste-frontend`.** This skill is scoped to landing
pages/portfolios ("Not dashboards, not multi-step product UI" — sections 0 and 13 say so
explicitly), so most of its hero/bento/marquee rules don't apply to a modal-and-grid puzzle
hub. What *does* generalize and that I applied: one accent colour used identically everywhere
(Color Consistency Lock — coral is the only accent across every shared component), one
corner-radius system (Shape Consistency Lock), a documented reduced-motion fallback for every
animation, and the CTA contrast check (which is what caught the white-on-coral button problem
above). I did not apply its hero/eyebrow/marquee/em-dash rules — they're answers to a different
problem (marketing copy), and the one place this project does write marketing-ish copy (empty
states, the birthday banner) is governed by `brand` below instead.

**Voice — `brand`.** No existing `docs/brand-guidelines.md` in this repo (that skill's own
scaffolding is for projects that keep one), so I used its voice-framework thinking only:
microcopy addresses Sansita and friends directly, second person, short sentences, warm instead
of cute-performative (the "AI tells" list in `design-taste-frontend` §9.F — "quietly trusted
by", forced wordplay — doubles as a useful check here: the empty states and the birthday banner
in `Hub.tsx` read as a friend talking, not as copy).

**`ui-styling` / `design-system` (tokens).** Both are shadcn/Radix-flavoured by default; this
project explicitly bans new UI libraries, so I used only their token-architecture thinking
(primitive → semantic → component layering, which `brand.css` already does: `--brand-*`
primitives/semantics, `--game-*`/`--tile-*` as the per-component layer) and their Tailwind
`@theme inline` wiring pattern, which was already in place and needed no structural change —
only new token values flow through it.

**`modern-web-design`.** Used for the accessibility and performance checklists (reduced motion,
GPU-safe animation props, 44px touch targets, visible focus rings) — all already required by
CLAUDE.md, this just confirmed the bar and the `:focus-visible` pattern I used in
`Button`/`Modal`/`GameLayout`'s icon buttons.

**`web-design-guidelines` + `playwright-cli`.** Used at the end for the audit pass (see
"Finishing" below): fetched the guidelines, read them against the final components, fixed what
they flagged, and screenshotted the Hub/DevThemes/modals at 375px and 1280px with
`pnpm shot`/the project's own Playwright-based script (the project already vendors a thin
`scripts/shot.mjs` over the shared Playwright Chromium install, so I used that instead of
spinning up a parallel `playwright-cli` session for the same screenshots).

## Build

- `brand.css`: tuned token values (above), added two new *optional* tokens
  (`--brand-shadow-sm`, `--brand-shadow-md` — tinted, soft shadows) and a `--brand-ring` focus
  colour. No token was renamed or removed.
- Restyled every shared component (`Button`, `Modal`, `SiteHeader`, `GameLayout`, `HelpModal`,
  `StatsModal`, `ResultModal`, `FriendsBoard`, `Keyboard`, `ShareButton`, `NextPuzzleCountdown`,
  `NoPuzzleToday`, `ArchivePicker`, `AlreadyPlayed`) using only semantic Tailwind classes
  (`bg-brand-*`, `bg-game-*`, `text-tile-*`, `rounded-brand-*`) — verified by grepping for raw
  hex/`style=` after the pass. No prop, export or behaviour changed; `types.ts` untouched.
- `Hub.tsx`: greeting with the member's name (`useAuth().member.displayName`), today's date and
  puzzle number (`dayIndex(today) + 1`, only shown once `dayIndex >= 0` i.e. on/after
  `LAUNCH_DATE` — before launch it reads as a friendly "coming soon" instead of "puzzle #-6"),
  a responsive game-card grid built from `gameMetas` (title, tagline, `hubAccent`, a ✓ badge
  once solved today, an in-progress badge, a dash for not-yet-played), "`n / 14` today" progress,
  and — only on `BIRTHDAY` — a banner for Sansita shown to everyone.
- `DevThemes.tsx`: every discovered game meta's palette swatches, a live font sample in that
  game's font, a themed `Button`, three sample tiles in the three tile states, and a themed
  `Modal` preview — plus three built-in sample themes (`_sample-wordle` white/square,
  `_sample-globle` dark navy, `_sample-bee` yellow) so the page is useful solo, before any game
  agent's `theme.css` lands. Checked it renders sanely under all three (and will under the real
  per-game themes once merged, since every style here is driven by `--game-*`/`--tile-*` tokens,
  never a hardcoded hex).
- Verified at 375px and desktop with `pnpm shot`, and with three wildly different token sets
  (the three sample themes above) so nothing in the restyle assumes the light/cream defaults.

## Deliberately left out

- No icon library (Phosphor/Lucide/etc., as several skills suggest) — CLAUDE.md freezes the
  installed package list and bans adding UI libraries. Icon buttons keep using emoji glyphs
  (already the pattern in the frozen components), just restyled as proper 44px touch targets
  with visible focus rings.
- No glassmorphism/backdrop-blur, no cursor effects, no scroll-hijacking, no GSAP — none of
  these fit "warm friends' puzzle site" and several are explicitly performance/accessibility
  risks the skills themselves flag.
- No dark mode. Nothing in CLAUDE.md asks for it, and the per-game themes (some literally
  dark — Globle's navy) already give the product visual range without a global light/dark
  toggle; adding one would be new scope, not polish.
