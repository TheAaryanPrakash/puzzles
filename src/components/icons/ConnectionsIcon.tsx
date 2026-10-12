import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function ConnectionsIcon(props: SVGProps<SVGSVGElement>) {
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

      <rect x="2.5" y="3.5" width="19" height="3.6" rx="1.8"/>
      <rect x="2.5" y="10.2" width="19" height="3.6" rx="1.8" opacity="0.8"/>
      <rect x="2.5" y="16.9" width="19" height="3.6" rx="1.8" opacity="0.6"/>
    </svg>
  );
}
