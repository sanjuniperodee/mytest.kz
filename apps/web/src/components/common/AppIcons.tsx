/**
 * Shared icon components used across NavBar, ProfilePage, and other UI.
 * All icons accept `active` prop for nav highlighting.
 */

interface IconProps {
  active?: boolean;
  className?: string;
}

const iconStyle = {
  width: 22,
  height: 22,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const HomeIcon = ({ active }: IconProps) => (
  <svg viewBox="0 0 24 24" {...iconStyle} fill={active ? 'currentColor' : 'none'} strokeWidth={active ? 0 : 1.8}>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    {!active && <polyline points="9 22 9 12 15 12 15 22" />}
  </svg>
);

export const StatsIcon = ({ active }: IconProps) => (
  <svg viewBox="0 0 24 24" {...iconStyle} strokeWidth={active ? 2.2 : 1.8}>
    <path d="M4 19V5M4 19h16" />
    <path d="M8 15v-4M13 15V8M18 15v-6" />
  </svg>
);

export const MistakesIcon = ({ active }: IconProps) => (
  <svg viewBox="0 0 24 24" {...iconStyle} strokeWidth={active ? 2.2 : 1.8}>
    <path d="M12 8v4m0 4h.01" />
    <circle cx="12" cy="12" r="9" />
  </svg>
);

export const LeaderboardIcon = ({ active }: IconProps) => (
  <svg viewBox="0 0 24 24" {...iconStyle} strokeWidth={active ? 2.2 : 1.8}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M5 5H3v2a4 4 0 0 0 4 4M19 5h2v2a4 4 0 0 1-4 4" />
  </svg>
);

export const SettingsIcon = ({ active }: IconProps) => (
  <svg viewBox="0 0 24 24" {...iconStyle} strokeWidth={active ? 2.2 : 1.8}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
  </svg>
);

export const PlansIcon = ({ active }: IconProps) => (
  <svg viewBox="0 0 24 24" {...iconStyle} strokeWidth={active ? 2.2 : 1.8}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20M6 15h4" />
  </svg>
);

export const ProfileIcon = ({ active }: IconProps) => (
  <svg viewBox="0 0 24 24" {...iconStyle} fill={active ? 'currentColor' : 'none'} strokeWidth={active ? 0 : 1.8}>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const AdmissionIcon = ({ active }: IconProps) => (
  <svg viewBox="0 0 24 24" {...iconStyle} strokeWidth={active ? 2.2 : 1.8}>
    <path d="M4 19h16" />
    <path d="M6 17V9" />
    <path d="M12 17V5" />
    <path d="M18 17v-6" />
  </svg>
);

export const BackArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
  </svg>
);

export const ChevronRightIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.4 }}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const StarIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none" aria-hidden>
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
  </svg>
);