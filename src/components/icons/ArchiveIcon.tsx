import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function ArchiveIcon(props: SVGProps<SVGSVGElement>) {
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

      <rect x="2.5" y="4" width="19" height="4.5" rx="1.2"/>
      <path d="M4 8.5v10a1.5 1.5 0 001.5 1.5h13a1.5 1.5 0 001.5-1.5v-10"/>
      <path d="M9.8 13h4.4" strokeWidth="1.5"/>
    </svg>
  );
}
