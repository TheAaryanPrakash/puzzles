interface SilhouetteProps {
  d: string;
  viewBox: string;
  /** Spoiler-free: the country name never appears in the DOM, only in this label for screen readers. */
  label: string;
}

export function Silhouette({ d, viewBox, label }: SilhouetteProps) {
  return (
    <svg
      className="worldle-silhouette mx-auto h-56 w-56 sm:h-72 sm:w-72"
      viewBox={viewBox}
      role="img"
      aria-label={label}
    >
      <path d={d} />
    </svg>
  );
}
