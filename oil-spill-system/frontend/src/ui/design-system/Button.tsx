import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-sans font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-blue disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer rounded-[3px]',
  {
    variants: {
      variant: {
        primary:
          'bg-signal-blue text-porcelain font-semibold hover:bg-signal-blue-hover active:bg-signal-blue shadow-sm border border-signal-blue',
        secondary:
          'bg-deck text-foam border border-chartline hover:border-chartline/90 hover:bg-deck/90 active:bg-deck/80',
        outline:
          'border border-chartline text-foam hover:border-signal-blue/50 hover:bg-trench active:bg-deck/50',
        ghost:
          'text-mist hover:text-foam hover:bg-trench/70 active:bg-deck/50',
        danger:
          'bg-rose-950/40 text-rose-300 border border-rose-800/60 hover:bg-rose-900/60 active:bg-rose-900/80',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3.5 text-xs',
        lg: 'h-9 px-4 text-sm',
        icon: 'h-7 w-7 p-0 text-xs',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded animate-spin mr-1" />
        ) : null}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
