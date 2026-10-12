import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function HintIcon(props: SVGProps<SVGSVGElement>) {
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

      <path d="M9 18.5h6M9.8 21h4.4"/>
      <path d="M12 2.5a6.5 6.5 0 00-3.8 11.8c.8.6 1.3 1.4 1.3 2.3h5a2.7 2.7 0 011.3-2.3A6.5 6.5 0 0012 2.5z"/>
    </svg>
  );
}
