import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'default' | 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  large?: boolean
  icon?: ReactNode
  tooltip?: string
  children?: ReactNode
}

export function Button({
  variant = 'default',
  size = 'md',
  block = false,
  large = false,
  icon,
  tooltip,
  children,
  className,
  style,
  ...rest
}: ButtonProps) {
  const effectiveSize = large ? 'lg' : size
  const variantClass =
    variant === 'primary'
      ? 'btn--primary'
      : variant === 'secondary'
        ? 'btn--secondary'
        : variant === 'ghost'
          ? 'btn--ghost'
          : variant === 'danger'
            ? 'btn--danger'
            : ''

  const sizeClass = effectiveSize === 'sm' ? 'btn--sm' : effectiveSize === 'lg' ? 'btn--lg' : ''

  const cls = [
    'btn',
    variantClass,
    sizeClass,
    block ? 'btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={cls}
      style={style}
      data-tooltip={tooltip}
      {...rest}
    >
      {icon ? <span className="btn-icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  )
}