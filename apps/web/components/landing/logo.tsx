/**
 * mytest brand mark — an "m" with a check badge. Same geometry as brand/mark.mjs
 * (the source for every generated icon); colours follow the theme tokens so it flips in dark mode.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      fill="none"
      className={`h-8 w-8 shrink-0 ${className}`}
    >
      <rect width="64" height="64" rx="15" fill="var(--foreground)" />
      <g transform="translate(32 32) scale(1.08) translate(-32.75 -30)">
        <path
          d="M12.5 48V30.5a7.75 7.75 0 0 1 15.5 0V48M28 30.5a7.75 7.75 0 0 1 15.5 0V48"
          stroke="var(--background)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="47.5" cy="17.5" r="11.6" fill="var(--foreground)" />
        <circle cx="47.5" cy="17.5" r="8.6" fill="var(--accent)" />
        <path
          d="M43.5 17.9l2.9 3 5.4-6.4"
          stroke="var(--foreground)"
          strokeWidth="2.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
