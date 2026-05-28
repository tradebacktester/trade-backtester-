import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
  " hover-elevate active-elevate-2" +
  " transition-[box-shadow,transform,background-color,border-color,opacity] duration-[180ms] ease-out",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary-border" +
          " [box-shadow:var(--shadow-btn)]" +
          " hover:[box-shadow:var(--shadow-btn-hover)] hover:-translate-y-px" +
          " active:[box-shadow:var(--shadow-btn-active)] active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive-border" +
          " [box-shadow:var(--shadow-btn)]" +
          " hover:[box-shadow:var(--shadow-btn-hover)] hover:-translate-y-px" +
          " active:[box-shadow:var(--shadow-btn-active)] active:translate-y-0",
        outline:
          "border [border-color:var(--button-outline)]" +
          " [box-shadow:var(--shadow-xs)]" +
          " hover:[box-shadow:var(--shadow-sm)] hover:-translate-y-px" +
          " active:[box-shadow:var(--shadow-2xs)] active:translate-y-0",
        secondary:
          "border bg-secondary text-secondary-foreground border-secondary-border" +
          " [box-shadow:var(--shadow-xs)]" +
          " hover:[box-shadow:var(--shadow-sm)] hover:-translate-y-px" +
          " active:[box-shadow:var(--shadow-2xs)] active:translate-y-0",
        ghost: "border border-transparent",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // @replit changed sizes
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
