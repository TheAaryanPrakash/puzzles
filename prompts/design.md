# Agent `design`: the site-wide design system

Read CLAUDE.md. Dev server port: **5101**. Scope check: `node scripts/check-scope.mjs design`.
You may edit `src/styles/`, `src/components/` (but **not** `src/components/types.ts`),
`src/pages/Hub.tsx`, `src/pages/DevThemes.tsx` and `docs/research/design-system.md`.

You run at the same time as 13 game agents who use the shared components *right now*, in their plain
foundation styling. Restyle them so the games pick up the new look automatically when everything
is merged. That means:
- **Never change a component's props, exports or behaviour.** They're frozen in `types.ts`.
- **Never rename or remove a token in `brand.css`.** Change values; add new tokens only if optional.
- Everything you style must look right under any game's `[data-game]` overrides: test with several
  wildly different token sets in DevThemes (e.g. Wordle's white/square, Globle's dark navy, Spelling
  Bee's yellow).

Work without waiting for approval.

## 1. Research → `docs/research/design-system.md`
Read the SKILL.md of every skill CLAUDE.md maps to you before designing anything: `design-system`,
`ui-ux-pro-max`, `design-taste-frontend`, `high-end-visual-design`, `modern-web-design`,
`ui-styling`, `motion-framer`, `brand`, `web-design-guidelines`, `playwright-cli`.
Then look at how the original daily-games sites structure their hub, result and stats modals and
share flows, plus 2–3 well-built open-source clones. Write down findings, the direction you chose
(with the skills' reasoning), and which skill shaped which decision.

## 2. Build
Feel: warm and playful. Starting point: cream background, coral/peach accent, rounded corners, soft
shadows, gentle bouncy motion (with `motion`) that respects reduced motion, Fredoka headings and
Nunito UI text. You may refine this using the skills (e.g. a better font pairing from the installed
fonts, a calibrated palette from `ui-ux-pro-max`), as long as it stays warm and playful. Microcopy
(greetings, empty states, the birthday banner) in a warm voice, following `brand`.
- `brand.css`: real values for every site-tier token and sensible game-tier defaults.
- Restyle every shared component. SiteHeader is identical on every page, using brand tokens only.
  Modals use brand structure, tinted by game tokens.
- Hub: greeting with the member's name, today's date and puzzle number, game cards from metas (title,
  tagline, accent, ✓ when done today, an in-progress badge), "n / 14 today". On BIRTHDAY, a birthday
  banner for Sansita, shown to everyone.
- DevThemes: every game meta's palette, font sample, Button, sample tiles and a Modal preview. Include
  3 built-in sample themes so it's useful before the games are merged.
- Works at 375px and on desktop.

## 3. Finish
Screenshot the hub, DevThemes and every modal at 375px and 1280px (`pnpm shot`), audit them with
`web-design-guidelines`, and fix what it finds. Save the final screenshots in `docs/research/shots/`.
`pnpm test` and `pnpm build` pass, scope check passes, commit, and reply with a summary.
