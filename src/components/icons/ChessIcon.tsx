import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function ChessIcon(props: SVGProps<SVGSVGElement>) {
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

      <path d="M9 21.5h6M8 21.5l.8-5.5h6.4l.8 5.5"/>
      <path d="M9.2 16l-1-3.3c-.5-1.6.5-3 1.9-3.4-.5-.5-.8-1.1-.8-1.9A2.7 2.7 0 0112 4.7a2.7 2.7 0 012.7 2.7c0 .8-.3 1.4-.8 1.9 1.4.4 2.4 1.8 1.9 3.4l-1 3.3z"/>
    </svg>
  );
}
