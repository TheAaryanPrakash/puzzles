import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function SudokuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >

      <rect x="2.5" y="2.5" width="19" height="19" rx="1.5"/>
      <path d="M9 2.5v19M15 2.5v19M2.5 9h19M2.5 15h19" strokeWidth="1.1"/>
    </svg>
  );
}
