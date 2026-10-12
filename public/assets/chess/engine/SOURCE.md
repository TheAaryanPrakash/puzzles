Stockfish 19 "lite, single-threaded" WASM build, shipped unmodified from the `stockfish` npm
package (v19.0.1, https://www.npmjs.com/package/stockfish, by Nathan Rugg / nmrugg/stockfish.js,
with Chess.com as a listed contributor).

- Engine: GPLv3 — see `LICENSE.txt` in this folder (copied unmodified from the package's
  `Copying.txt`).
- Wrapper/loader JS in `stockfish-19-lite-single.js`: MIT, per the package's own licensing.

No file here has been edited. Loaded only as a Web Worker script
(`new Worker("/assets/chess/engine/stockfish-19-lite-single.js")`) and spoken to over the UCI
protocol via `postMessage`/`onmessage` — nothing from this folder is imported into `src/`. See
`src/games/chess/RESEARCH.md` for why this boundary is the GPL-safe way to use it, and the site's
chess Help modal for the required "Engine: Stockfish (GPLv3), source" link.

Source: https://github.com/nmrugg/stockfish.js
