import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function GlobleIcon(props: SVGProps<SVGSVGElement>) {
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

      <circle cx="12" cy="12" r="9.5"/>
      <circle cx="12" cy="12" r="6" strokeWidth="1.25" opacity="0.6"/>
      <circle cx="12" cy="12" r="2.4" strokeWidth="1.25" opacity="0.9"/>
      <path d="M2.5 12h19" strokeWidth="1" opacity="0.4"/>
    </svg>
  );
}
