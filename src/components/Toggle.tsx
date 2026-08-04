'use client'

type Props = {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}

/** The 44×26 switch from the design canvas, as a real ARIA switch. */
export function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="dg-toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="dg-toggle-knob" />
    </button>
  )
}
