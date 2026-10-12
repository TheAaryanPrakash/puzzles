import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function WorldleIcon(props: SVGProps<SVGSVGElement>) {
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

      <circle cx="11" cy="10.5" r="7.5"/>
      <path d="M3.6 10.5h14.8M11 3v15M6 5.5c2 2 2 11 0 13.5M16 5.5c-2 2-2 11 0 13.5" strokeWidth="1.25"/>
      <path d="M11 22l3.2-6.4a3.2 3.2 0 10-6.4 0z" fill="currentColor" stroke="none" opacity="0"/>
    </svg>
  );
}
