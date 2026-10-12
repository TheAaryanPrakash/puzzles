import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function GroupsIcon(props: SVGProps<SVGSVGElement>) {
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

      <circle cx="8.5" cy="9" r="3.1"/>
      <circle cx="17" cy="10" r="2.5" opacity="0.75"/>
      <path d="M2.8 20c1-3.3 3.1-5 5.7-5s4.7 1.7 5.7 5"/>
      <path d="M15 15.3c2.2.2 3.8 1.8 4.6 4.7" opacity="0.75"/>
    </svg>
  );
}
