import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function StatesIcon(props: SVGProps<SVGSVGElement>) {
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

      <path d="M3 6l4.5-1.5L12 6l4.5-1.5L21 6v12l-4.5 1.5L12 18l-4.5 1.5L3 18z"/>
      <path d="M7.5 4.5v13.5M16.5 4.5v13.5" strokeWidth="1.1" opacity="0.6"/>
    </svg>
  );
}
