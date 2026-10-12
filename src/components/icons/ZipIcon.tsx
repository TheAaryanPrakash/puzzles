import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function ZipIcon(props: SVGProps<SVGSVGElement>) {
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

      <path d="M4 5l4 4-4 4 4 4"/>
      <path d="M4 5h5.5M8 9h8M8 13h8M4 13h5.5M9.5 17H20"/>
      <circle cx="4" cy="5" r="1.4" fill="currentColor" stroke="none"/>
      <circle cx="20" cy="17" r="1.4" fill="currentColor" stroke="none"/>
    </svg>
  );
}
