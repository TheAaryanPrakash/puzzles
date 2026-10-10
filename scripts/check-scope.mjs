#!/usr/bin/env node
// Fails if this branch changed files outside the agent's allowed paths.
// Usage: node scripts/check-scope.mjs <agent> [base-branch=main]
// Checks committed changes since branching from base, plus uncommitted and untracked files.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const game = (...ids) =>
  ids.flatMap((id) => [
    `src/games/${id}/`,
    `scripts/${id}/`,
    `scripts/out/${id}-`,
    `content/puzzles/${id}/`,
    `data/${id}/`,
    `public/assets/${id}/`,
  ]);

// Each entry is a path prefix. Directories end in "/".
export const SCOPES = {
  data: ["wordlists/", "data/", "public/assets/shared/", "scripts/_data/"],
  design: [
    "src/styles/",
    "src/components/",
    "src/pages/Hub.tsx",
    "src/pages/DevThemes.tsx",
    "docs/research/design-system.md",
    "docs/research/shots/",
  ],
  backend: [
    "supabase/",
    "src/lib/data/supabase.ts",
    "src/lib/data/supabase.test.ts",
    "src/lib/auth.tsx",
    "src/pages/SignIn.tsx",
    "src/pages/Join.tsx",
    "src/pages/Profile.tsx",
    "scripts/upload-puzzles.ts",
    ".env.example",
    "docs/research/backend.md",
  ],
  wordle: game("wordle"),
  quordle: game("quordle"),
  bee: game("bee"),
  sudoku: game("sudoku", "mini-sudoku"),
  digits: game("digits"),
  connections: game("connections"),
  mini: game("mini"),
  zip: game("zip"),
  worldle: game("worldle"),
  flagle: game("flagle"),
  globle: game("globle"),
  travle: game("travle"),
  states: game("states"),
};

// Frozen interfaces: no parallel agent may change these, whatever its scope.
export const FROZEN = [
  "src/components/types.ts",
  "src/lib/data/types.ts",
  "package.json",
  "pnpm-lock.yaml",
  "CLAUDE.md",
];

export function outOfScope(agent, files) {
  const allowed = SCOPES[agent];
  if (!allowed) throw new Error(`Unknown agent "${agent}". Known: ${Object.keys(SCOPES).join(", ")}`);
  return files.filter(
    (f) => FROZEN.includes(f) || !allowed.some((prefix) => f.startsWith(prefix)),
  );
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);
}

function changedFiles(base) {
  const committed = git("diff", "--name-only", `${base}...HEAD`);
  const working = git("status", "--porcelain", "--untracked-files=all").map((line) => {
    const path = line.slice(3);
    return path.includes(" -> ") ? path.split(" -> ")[1] : path;
  });
  return [...new Set([...committed, ...working].map((p) => p.replace(/^"|"$/g, "")))].sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [agent, base = "main"] = process.argv.slice(2);
  if (!agent || !SCOPES[agent]) {
    console.error("Usage: node scripts/check-scope.mjs <agent> [base-branch]");
    console.error(`Agents: ${Object.keys(SCOPES).join(", ")}`);
    process.exit(2);
  }
  const files = changedFiles(base);
  const bad = outOfScope(agent, files);
  if (bad.length) {
    console.error(`✗ ${agent}: ${bad.length} file(s) outside your scope:`);
    for (const f of bad) console.error(`    ${f}`);
    console.error("Move these changes into your own folders, or revert them and describe the");
    console.error("shared change you need in your HANDOFF.md.");
    process.exit(1);
  }
  console.log(`✓ ${agent}: ${files.length} changed file(s), all in scope.`);
}
