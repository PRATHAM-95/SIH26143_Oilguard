import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'default' | 'primary'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  block?: boolean
  large?: boolean
  children: ReactNode
}

export function Button({
  variant = 'default',
  block = false,
  large = false,
  children,
  className,
  style,
  ...rest
}: ButtonProps) {
  const cls = [
    'btn',
    variant === 'primary' ? 'btn--primary' : '',
    block ? 'btn--block' : '',
    large ? 'btn--lg' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={cls}
      style={style}
      {...rest}
    >
      {children}
    </button>
  )
}