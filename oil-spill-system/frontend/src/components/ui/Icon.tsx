import type { SVGProps } from 'react'

/**
 * Compact stroke icon set (24-viewBox, drawn on an 18px grid at render time).
 * Kept local so the tool rail and command bar never depend on an icon font.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number }

export type { IconProps }

function Icon({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function CommandIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M9 9l3 3-3 3M15 15h1" />
    </Icon>
  )
}

export function ShipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 15l9-4 9 4" />
      <path d="M12 4v7" />
      <path d="M8.5 5.5l3.5-2 3.5 2" />
      <path d="M4 19h16" />
      <path d="M5 16.5L4 19l-1-2.5" />
      <path d="M19 16.5L20 19l1-2.5" />
    </Icon>
  )
}

export function RadarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 12l5-4" />
    </Icon>
  )
}

export function BacktraceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7h10a6 6 0 0 1 0 12H5" />
      <path d="M7 3L3 7l4 4" />
    </Icon>
  )
}

export function RankIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h16" />
      <path d="M4 10h16" />
      <path d="M4 15h10" />
      <path d="M4 20h6" />
      <circle cx="18" cy="18" r="2.4" />
    </Icon>
  )
}

export function DossierIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 4h10l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M14 4v5h5" />
      <path d="M8 12h8M8 16h6" />
    </Icon>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function MinusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  )
}

export function CompassIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5L13 13l-4.5 2.5L11 11z" />
    </Icon>
  )
}

export function CrosshairIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  )
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 15l6-6 6 6" />
    </Icon>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9l6 6 6-6" />
    </Icon>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  )
}

export function LayersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" opacity={0.6} />
    </Icon>
  )
}

export function SoilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Icon>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Icon>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12H5M11 6l-6 6 6 6" />
    </Icon>
  )
}