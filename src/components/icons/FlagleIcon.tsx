import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function FlagleIcon(props: SVGProps<SVGSVGElement>) {
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

      <path d="M5 2.5v19"/>
      <path d="M5 3.5c3-1.4 5 1.4 8 0s5 1.4 8 0v9c-3 1.4-5-1.4-8 0s-5-1.4-8 0z"/>
    </svg>
  );
}
