import type { SVGProps } from "react";

/** Hand-drawn placeholder — see docs/redesign/HANDOFF.md "Icons" (svgrepo.com Dazzle Line
 * collection unreachable from the research session; swap for the real asset when available). */
export default function FlameIcon(props: SVGProps<SVGSVGElement>) {
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

      <path d="M12 2.8c.4 2.6-1 4-2.6 5.6C7.6 10.2 6.5 12 6.5 14.3a5.5 5.5 0 0011 0c0-1.8-.9-2.9-1.9-4 .2 1.6-.4 2.6-1.3 3.1.5-2.6-.7-4.3-2.3-6-1 .9-1.5 1.9-1.5 3-1-1.3-1-3.4 1.5-7.6z"/>
    </svg>
  );
}
