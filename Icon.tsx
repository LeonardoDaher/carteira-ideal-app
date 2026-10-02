import type React from 'react'

type IconProps = { size?: number; className?: string; style?: React.CSSProperties }

function base(children: React.ReactNode, { size = 20, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {children}
    </svg>
  )
}

export function UsersIcon(props: IconProps) {
  return base(
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
    props,
  )
}

export function CompassIcon(props: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88Z" />
    </>,
    props,
  )
}

export function BarChartIcon(props: IconProps) {
  return base(
    <>
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" />
      <rect x="12.5" y="8" width="3" height="10" />
      <rect x="18" y="5" width="3" height="13" />
    </>,
    props,
  )
}

export function CalculatorIcon(props: IconProps) {
  return base(
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="11" x2="8" y2="11" />
      <line x1="12" y1="11" x2="12" y2="11" />
      <line x1="16" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="8" y2="15" />
      <line x1="12" y1="15" x2="12" y2="15" />
      <line x1="16" y1="15" x2="16" y2="19" />
      <line x1="8" y1="19" x2="8" y2="19" />
      <line x1="12" y1="19" x2="12" y2="19" />
    </>,
    props,
  )
}

export function ClipboardListIcon(props: IconProps) {
  return base(
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M9 3h6v3H9z" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </>,
    props,
  )
}

export function TargetIcon(props: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>,
    props,
  )
}

export function PinIcon(props: IconProps) {
  return base(
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </>,
    props,
  )
}

export function BrainIcon(props: IconProps) {
  return base(
    <>
      <path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5.2A3 3 0 0 0 9 19V3Z" />
      <path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5.2A3 3 0 0 1 15 19V3Z" />
      <line x1="12" y1="4" x2="12" y2="19" />
    </>,
    props,
  )
}

export function ChevronDownIcon(props: IconProps) {
  return base(<polyline points="6 9 12 15 18 9" />, props)
}

export function AlertTriangleIcon(props: IconProps) {
  return base(
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <line x1="12" y1="10" x2="12" y2="14.5" />
      <circle cx="12" cy="17.3" r="0.6" fill="currentColor" stroke="none" />
    </>,
    props,
  )
}

export function SunIcon(props: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="4.5" />
      <line x1="12" y1="1.5" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22.5" />
      <line x1="1.5" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22.5" y2="12" />
      <line x1="4.4" y1="4.4" x2="6.1" y2="6.1" />
      <line x1="17.9" y1="17.9" x2="19.6" y2="19.6" />
      <line x1="4.4" y1="19.6" x2="6.1" y2="17.9" />
      <line x1="17.9" y1="6.1" x2="19.6" y2="4.4" />
    </>,
    props,
  )
}

export function MoonIcon(props: IconProps) {
  return base(<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />, props)
}

export function PlayIcon(props: IconProps) {
  return base(<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none" />, props)
}

export function GraduationCapIcon(props: IconProps) {
  return base(
    <>
      <path d="M2 9.5 12 5l10 4.5-10 4.5-10-4.5Z" />
      <path d="M6 11.5V17c0 1.4 2.7 3 6 3s6-1.6 6-3v-5.5" />
      <path d="M20.5 9.5v5" />
    </>,
    props,
  )
}

export function LoaderIcon(props: IconProps) {
  return base(
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
    </>,
    props,
  )
}

/** Cadeado do livro bônus (mesmo desenho do que era usado na landing). */
export function LockIcon(props: IconProps) {
  return base(
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </>,
    props,
  )
}

export function XIcon(props: IconProps) {
  return base(<path d="M6 6l12 12M18 6L6 18" />, props)
}

export function PencilIcon(props: IconProps) {
  return base(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>,
    props,
  )
}

export function EyeIcon(props: IconProps) {
  return base(
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>,
    props,
  )
}

export function EyeOffIcon(props: IconProps) {
  return base(
    <>
      <path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.7 17.7 0 0 1-3.2 4.2" />
      <path d="M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </>,
    props,
  )
}
