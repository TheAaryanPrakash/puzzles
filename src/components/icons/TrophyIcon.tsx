import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function TrophyIcon(props: SVGProps<SVGSVGElement>) {
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

      <path d="M7 4.5h10v5.2a5 5 0 01-10 0z"/>
      <path d="M7 6H4a3 3 0 003 5.5M17 6h3a3 3 0 01-3 5.5"/>
      <path d="M12 15v3.2M8.5 21.5h7l-1-3.3h-5z"/>
    </svg>
  );
}
