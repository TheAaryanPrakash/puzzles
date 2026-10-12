# Connections — import samples

## Pool stats

- Raw puzzles found in CSV: 628 (date range 2023-06-12 .. 2025-02-28)
- Rejected: 0
- Valid (before ARCHIVE_CUTOFF 2025-04-01): 628
- Scheduled as daily mains: 365 (LAUNCH_DATE 2026-10-12 .. 2027-10-11)
- Reserve pool size: 263
- Seed: 31

## Rejected puzzles

None — every puzzle in the archive validated cleanly.

## 5 sample days

### Day 1 — 2026-10-12

**Main:**
  - **Yellow** — ORGANIZATION: CLUB, GROUP, PARTY, TEAM
  - **Green** — SHARPNESS, AS OF AN IMAGE: DETAIL, RESOLUTION, DEFINITION, CLARITY
  - **Blue** — PLACES IN FRANCE: NICE, CHAMPAGNE, TOURS, DIJON
  - **Purple** — HAPPY NEW YEAR!: COUNTDOWN, KISS, BALL, FIREWORKS

**Reserve:**
  - **Yellow** — BEANS: LIMA, PINTO, KIDNEY, FAVA
  - **Green** — CITIES BEGINNING WITH “L”: LIMERICK, LINCOLN, LAGOS, LUXOR
  - **Blue** — POETRY TERMS: LINE, VERSE, RHYME, METER
  - **Purple** — “THE(E) ___” RAPPERS: CREATOR, RAPPER, STALLION, DUDE

### Day 91 — 2027-01-10

**Main:**
  - **Yellow** — METAL ELEMENTS: LEAD, MERCURY, GOLD, TIN
  - **Green** — MATTRESS SIZES: FULL, KING, QUEEN, TWIN
  - **Blue** — SLANG FOR TOILET: HEAD, THRONE, JOHN, CAN
  - **Purple** — KINDS OF KNIVES: BOWIE, BUTTER, BUTTERFLY, BUTCHER

**Reserve:**
  - **Yellow** — DIVULGE, AS PRIVATE INFORMATION: TALK, DISH, TELL, SPILL
  - **Green** — DIVIDE: FORK, PART, SPLIT, BRANCH
  - **Blue** — SILENT “K”: UNKNOWN, DOORKNOB, KNIFE, TOPKNOT
  - **Purple** — KEY TO SUCCESS, SO TO SPEAK: FORMULA, RECIPE, SECRET, TICKET

### Day 181 — 2027-04-10

**Main:**
  - **Yellow** — RELIGIOUS FIGURES: CARDINAL, PASTOR, LAMA, MONK
  - **Green** — PRIMATES: GORILLA, GIBBON, BABOON, BONOBO
  - **Blue** — CHUTNEY VARIETIES: MINT, TOMATO, MANGO, TAMARIND
  - **Purple** — IMITATE: MIRROR, PARROT, APE, MIME

**Reserve:**
  - **Yellow** — STATES OF MATTER: GAS, LIQUID, SOLID, PLASMA
  - **Green** — ENERGY: JUICE, STEAM, SPIRIT, VIGOR
  - **Blue** — CLASSICAL ELEMENTS: WATER, EARTH, FIRE, AIR
  - **Purple** — THINGS WITH RINGS: TREE, CIRCUS, SATURN, WEDDING

### Day 271 — 2027-07-09

**Main:**
  - **Yellow** — HEARTWARMING: MOVING, TENDER, TOUCHING, SWEET
  - **Green** — SNEAKING SUSPICION: SENSE, FEELING, HUNCH, IMPRESSION
  - **Blue** — LEGAL SESSION: HEARING, PROCEEDING, INQUIRY, TRIAL
  - **Purple** — EASY ___: STREET, MONEY, LISTENING, CHAIR

**Reserve:**
  - **Yellow** — DANCE STYLES: MODERN, SWING, TAP, JAZZ
  - **Green** — STEAL: PALM, POCKET, SWIPE, LIFT
  - **Blue** — PERFORM WELL ON: ROCK, NAIL, ACE, CRUSH
  - **Purple** — ___BALL PITCHES: FAST, SCREW, KNUCKLE, CURVE

### Day 365 — 2027-10-11

**Main:**
  - **Yellow** — PLACES FOR WORSHIP: TEMPLE, ALTAR, RELIQUARY, SHRINE
  - **Green** — CARTOON CATS: TOM, SYLVESTER, GARFIELD, FELIX
  - **Blue** — PRESIDENTIAL FIRST NAMES: HARRY, GROVER, CALVIN, CHESTER
  - **Purple** — ___ ROAD: ROCKY, HIGH, SILK, ABBEY

**Reserve:**
  - **Yellow** — MARK ONLINE FOR LATER: SAVE, LIKE, FAVORITE, BOOKMARK
  - **Green** — BEHALF: SAKE, ADVANTAGE, INTEREST, BENEFIT
  - **Blue** — NBA LEGENDS, FAMILIARLY: CURRY, BIRD, MAGIC, KOBE
  - **Purple** — ENDING WITH GREEK LETTERS: PEPSI, MOCHI, FETA, BIOTA

## Anything suspicious?

Nothing found. The "no split numbers" structural check (16 rows, 7 columns, integer 0-3 group
level) rejected 0 puzzles, matching the data agent's own README note that this CSV is already
clean (every field with an embedded comma is correctly quoted, verified directly against the raw
file). Rejections above (if any) are from the ARCHIVE_CUTOFF filter only, which is expected since
the dataset runs through 2025-02-28 and ARCHIVE_CUTOFF is 2025-04-01.
