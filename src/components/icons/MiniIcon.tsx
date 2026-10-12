import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function MiniIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M2.5 9.5h7v7h-7zM13 6h8.5M13 11h8.5" strokeWidth="1.1"/>
    </svg>
  );
}
