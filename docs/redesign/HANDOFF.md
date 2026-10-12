# Redesign — Checkpoint 1 handoff

What was researched and built on the way to Checkpoint 1, what deviates from the brief, and what
the human needs to decide or revisit before the Build phase starts.

## React Bits files copied

All 7 live under `src/components/fx/__preview__/` — **throwaway**, built only to prove the
components work with our tokens for Checkpoint 1 (see the comment at the top of
`DevRedesignPreview.tsx`). The real adapted versions get built fresh at `src/components/fx/`
(no `__preview__`) in the Build phase, with full keyboard/ARIA/touch/reduced-motion/cleanup
wrappers per the gaps noted in `RESEARCH.md`.

| File | Source |
|---|---|
| `FluxLines.tsx` | reactbits.dev/backgrounds/flux-lines |
| `JellyRadio.tsx` | reactbits.dev/micro/jelly-radio |
| `FlipCard.tsx` | reactbits.dev/micro/flip-card |
| `CodeSlots.tsx` | reactbits.dev/micro/code-slots |
| `GlideSelect.tsx` | reactbits.dev/micro/glide-select |
| `SpecularButton.tsx` | reactbits.dev/components/specular-button |
| `MagicBento.tsx` | reactbits.dev/components/magic-bento |

**Licence**: React Bits — MIT + Commons Clause License Condition v1.0, Copyright (c) 2026 David
Haz (`github.com/DavidHDev/react-bits/LICENSE.md`). Pre-approved exception to CLAUDE.md's licence
rule for this redesign only. Permits use "as part of an application, website, or product"; the
Commons Clause forbids selling, sublicensing or redistributing the components themselves (alone,
bundled, or ported) — not a concern for an invite-only friends site. Each file above carries a
2-line header comment with the source URL and licence name; the full text is quoted in
`docs/redesign/HANDOFF.md` (this file, above) rather than duplicated 7 times.

**Dropped dependency**: 3 of the 7 (`CodeSlots`, `GlideSelect`, `MagicBento`) imported
`@hugeicons/react` + `@hugeicons/core-free-icons` for a checkmark/chevron/demo-card glyphs. Not
installed — CLAUDE.md's icon rule for this redesign is SVG Repo Dazzle Line only, so those spots
use inline `✓`/chevron markup or our own icon set instead (see `RESEARCH.md` per-component notes).

## Packages added

| Package | Why |
|---|---|
| `@fontsource/baloo-2` | 3rd font candidate for Checkpoint 1 |

No `gsap`, no `ogl`/`three` — none of the 7 components import a WebGL helper library; two
(`FluxLines`, `SpecularButton`) hand-write their own WebGL2 shaders with zero dependency, and
`MagicBento`'s particle layer is plain Canvas 2D. See `RESEARCH.md`'s headline finding.

## Icons — SVG Repo "Dazzle Line": blocked, hand-drawn placeholders used instead

**svgrepo.com is unreachable from browser automation.** Both the original research session and a
fresh verification just now (`playwright-cli goto https://www.svgrepo.com/collection/dazzle-line-icons/`,
headed Chromium) hit the same wall: Vercel's bot-protection checkpoint, HTTP 429, "Vercel Security
Checkpoint" interstitial. Not a one-off — confirmed twice, independently.

**What's shipped instead**: all 34 icons (15 games + share, stats, help, prev, next, menu,
settings, profile, leaderboard, groups, archive, close, check, undo, hint, clock, trophy, flame,
copy) are hand-drawn to match Dazzle Line's general look — 24px grid, rounded line strokes, 1.75px
weight, round caps/joins — stored as `currentColor` React components under
`src/components/icons/`. Each file has a one-line comment flagging it as a placeholder. No licence
attribution needed for these (original work), but they are a stand-in, not the real asset.

**Before the Build phase** (or whenever svgrepo.com is reachable — try from a normal signed-in
browser session, not automation, since the block appears to target bot traffic specifically):
pull the real Dazzle Line SVGs and swap them in one-for-one, keeping the same file names and
`currentColor` + 24px-viewBox shape so nothing else needs to change. This is flagged here instead
of silently shipping placeholders as final.

## A real bug this round found and fixed: WebGL silently fails in headless Chromium

`FluxLines` and `SpecularButton` (both hand-written WebGL2 shaders) rendered as **blank white
boxes** in the first checkpoint-1 screenshot pass — looked like a shader or context-creation bug.
It wasn't: headless Chromium (the default for `playwright-cli open`/`goto` with no flag) often has
no WebGL2 support, so `canvas.getContext('webgl2', ...)` silently returns `null` and the component's
effect returns early (by design — see `FluxLines.tsx`'s own `if (!container || !canvas || !gl) return
undefined;`), leaving an empty transparent canvas. Confirmed by re-running the exact same page with
`playwright-cli open --headed`: both components rendered correctly, no shader compile errors in the
console either time.

**Takeaway for every future screenshot in this redesign that touches `FluxLines` or
`SpecularButton`** (checkpoint 2, phase 2 per-game screenshots, etc.): use `playwright-cli open
--headed` (or `--browser chrome`), not the headless default, or the WebGL layer will silently not
render and the screenshot will look broken when the code is fine. Worth a one-line note in
whichever skill/doc future agents read before taking redesign screenshots.

## Two demo-wiring bugs also fixed (not React Bits bugs — our own demo props)

`CodeSlots` and `GlideSelect` looked broken (empty / completely unstyled) in the first pass for two
unrelated, mundane reasons, both now fixed in `DevRedesignPreview.tsx`:
- `CodeSlots` is a **numeric-only** OTP input (`digitsOf()` strips everything but `0-9` via regex)
  — the demo passed `defaultValue="PINK"`, which has zero digits, so every slot was empty. Changed
  to a real numeric value (`"4821"` of length 5, showing one empty trailing slot).
- Both `CodeSlots`' `slotColor` and `GlideSelect`'s `surfaceColor` were passed the same hex as the
  demo `Card` wrapper's own background (`SURFACE`), so the control's background was styled
  correctly (verified via computed styles) but **identical to the card behind it** — invisible, not
  unstyled. Introduced a distinct `CHIP` colour (`#3c2530`) for both.

Neither of these is a signal about the real Build-phase integration — there we'll be using actual
brand tokens (`--brand-surface`, `--brand-surface-2`, etc.), which are already distinct from each
other by design (see `brand.css`).

## Deviations already flagged in RESEARCH.md (repeated here for visibility)

- No `gsap`/`ogl`/`three` added — not needed by this specific set of 7 components.
- `GlideSelect` has no text input or filter logic — `GlideCombobox` (phase 2, for
  Worldle/Flagle/Globle/Travle/States) needs real new engineering on top of it, not just styling;
  flagged before phase-2 prompts are written.

## Skills used

`design-system`, `ui-ux-pro-max`, `web-design-guidelines` (per `RESEARCH.md`'s own note).
`design-taste-frontend`, `high-end-visual-design`, `modern-web-design`, `ui-styling`,
`motion-framer`, `brand` are Build-phase skills, not yet used.

## State at Checkpoint 1

`pnpm test` and `pnpm build` both pass (see below). All work is committed on `main` in small
steps, nothing pushed. Checkpoint-1 screenshots are final (regenerated after the headless-WebGL
and demo-prop fixes above) at `docs/redesign/checkpoint-1/`:
- `fonts.png` — Baloo 2 / Quicksand / Nunito on hub mock, Wordle row, Sudoku grid.
- `colors.png` — full pink-on-black scale, WCAG AA contrast table, per-game semantic colours in
  normal vision and simulated deuteranopia.
- `icon-sheet.png` — all 34 hand-drawn placeholder icons (see "Icons" above).
- `components-demo.png` — all 7 React Bits components live on our pink/black tokens.

Waiting on the human's choices (font, exact colour tuning, icon approach) before the Build phase
starts.

## Build phase — multi-group leaderboard check (item 8)

Font (Quicksand) and colours approved; Build phase started 2026-10-12. This section covers one
parallel chunk of it: "seed a local user in 3 groups with overlapping members... verify the
site-wide board counts each person ONCE... add PGlite tests for site-wide no-double-counting and
group isolation."

**Production SQL (`0004_groups.sql`'s `leaderboard()`): no bug found.** Its `member_scope` CTE
selects distinct rows straight from `profiles` for `scope='global'` rather than joining
`group_members` — structurally incapable of fanning a member's points out across their several
group memberships. Added 6 new PGlite assertions to `supabase/tests/schema.test.mjs` proving this
for a member (E) in 3 overlapping groups: her own board in each of the 3 groups, and the global
board, all show her one real win as 1 point/1 win/1 played — not 3× — plus isolation for a member
who *left* a group (not just one who never joined, which was already covered). **Verified these
tests actually catch the bug class**: temporarily patched `member_scope` to join `group_members`
(the fan-out shape these tests exist to rule out), reran `pnpm test:db`, watched the new "sums
once" assertion fail (100 passed, 1 failed), then reverted the migration file — `git status` confirms
zero diff on it now.

**Local dev adapter (`local.ts`): one real bug found and fixed.** Its global leaderboard deduped
members by `displayName`, not `userId` — harmless today only because the local fixture's one
simulated identity always uses the same constant display name, but a real latent bug: two
*different* people sharing a display name would have wrongly collapsed into one leaderboard row.
Fixed by deduping on `userId` instead (keeping the first `displayName` seen per id). The public
`DataSource` API has no way to add a *third party* to an existing local group (only the one
simulated user can join/create), so testing genuine overlap needed direct seeding — exported
`writeGroups`/`writeMembers` from `local.ts` (parallel to the already-exported `readGroups`/
`readMembers`) for `local.test.ts` to use. Two new tests: a member in 3 overlapping groups appears
once on the global board; a group's board never includes someone who only shares a *different*
group. **Verified these catch a regression** the same way — reverted the dedup fix locally, reran,
watched `expected 3 to be 1`, restored the fix.

`pnpm test`: 836 passing (was 834). `pnpm test:db`: 101 passing (was 95).
