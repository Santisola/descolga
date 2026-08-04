/**
 * The icon set used across the app, lifted from the design canvas. All strokes,
 * all `currentColor`, so a parent's colour drives them.
 */
type Props = { size?: number; className?: string }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export function PlusIcon({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function CheckIcon({ size = 14, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export function BellIcon({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className} strokeWidth={1.7}>
      <path d="M18 9a6 6 0 10-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M10 20a2.4 2.4 0 004 0" />
    </svg>
  )
}

export function BellOffIcon({ size = 19, className }: Props) {
  return (
    <svg {...base(size)} className={className} strokeWidth={1.7}>
      <path d="M18 9a6 6 0 00-9.6-4.8M6 10v-1M18 9c0 5 2 6 2 6H6.5" />
      <path d="M4 4l16 16" />
    </svg>
  )
}

export function GearIcon({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className} strokeWidth={1.6}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M18 6l-1.6 1.6M7.6 16.4L6 18" />
    </svg>
  )
}

export function RepeatIcon({ size = 16, className }: Props) {
  return (
    <svg {...base(size)} className={className} strokeWidth={1.7}>
      <path d="M4 12a8 8 0 018-8c3 0 5.5 1.7 7 4M20 12a8 8 0 01-8 8c-3 0-5.5-1.7-7-4" />
      <path d="M19 3v5h-5M5 21v-5h5" />
    </svg>
  )
}

export function ClockIcon({ size = 12, className }: Props) {
  return (
    <svg {...base(size)} className={className} strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function InfoIcon({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className} strokeWidth={1.7}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M12 11.5v5" />
    </svg>
  )
}

export function ShareIcon({ size = 17, className }: Props) {
  return (
    <svg {...base(size)} className={className} strokeWidth={1.7}>
      <path d="M12 15V4M8.5 7.5L12 4l3.5 3.5" />
      <path d="M7 12H5.5v8h13v-8H17" />
    </svg>
  )
}

export function ChevronLeftIcon({ size = 18, className }: Props) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}
