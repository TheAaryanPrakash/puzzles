import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function ShareIcon(props: SVGProps<SVGSVGElement>) {
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

      <circle cx="18" cy="5" r="2.6"/>
      <circle cx="6" cy="12" r="2.6"/>
      <circle cx="18" cy="19" r="2.6"/>
      <path d="M8.3 10.7l7.4-4.4M8.3 13.3l7.4 4.4"/>
    </svg>
  );
}
