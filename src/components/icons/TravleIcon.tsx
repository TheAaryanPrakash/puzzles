import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function TravleIcon(props: SVGProps<SVGSVGElement>) {
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

      <path d="M3.5 18.5c3-6 5-2 8-8s5.5-6 9-3.5" strokeDasharray="0.5 3.6"/>
      <circle cx="3.5" cy="18.5" r="1.6" fill="currentColor" stroke="none"/>
      <path d="M20.5 7l-3-.6.6-3z"/>
    </svg>
  );
}
