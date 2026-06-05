import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "cursor-pointer select-none",
    "transition-all duration-[180ms] ease-[cubic-bezier(0.34,1.2,0.64,1)]",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground rounded-xl border border-primary-border" +
          " [box-shadow:var(--shadow-btn)]" +
          " hover:[box-shadow:var(--shadow-btn-hover)] hover:-translate-y-px hover:scale-[1.01]" +
          " active:scale-[0.98] active:translate-y-0 active:[box-shadow:var(--shadow-btn-active)]",
        destructive:
          "bg-destructive text-destructive-foreground rounded-xl border border-destructive-border" +
          " [box-shadow:var(--shadow-btn)]" +
          " hover:[box-shadow:var(--shadow-btn-hover)] hover:-translate-y-px hover:scale-[1.01]" +
          " active:scale-[0.98] active:translate-y-0",
        outline:
          "rounded-xl border [border-color:var(--button-outline)] bg-transparent" +
          " [box-shadow:var(--shadow-xs)]" +
          " hover:bg-accent hover:text-accent-foreground hover:[box-shadow:var(--shadow-sm)] hover:-translate-y-px" +
          " active:scale-[0.98]",
        secondary:
          "rounded-xl border bg-secondary text-secondary-foreground border-secondary-border" +
          " [box-shadow:var(--shadow-xs)]" +
          " hover:[box-shadow:var(--shadow-sm)] hover:-translate-y-px hover:scale-[1.01]" +
          " active:scale-[0.98]",
        ghost:
          "rounded-xl border border-transparent" +
          " hover:bg-accent hover:text-accent-foreground",
        glass:
          "rounded-xl border backdrop-blur-[16px] saturate-150" +
          " [background:var(--glass-bg)] [border-color:var(--glass-border)]" +
          " [box-shadow:var(--shadow-sm)]" +
          " hover:[box-shadow:var(--shadow-md)] hover:-translate-y-px hover:[border-color:var(--glass-border-strong)]" +
          " active:scale-[0.98]",
        cyan:
          "rounded-xl font-bold text-white" +
          " [background:rgba(255,255,255,0.09)]" +
          " [border:1px_solid_rgba(255,255,255,0.16)]" +
          " [box-shadow:var(--shadow-btn)]" +
          " hover:[background:rgba(255,255,255,0.14)] hover:[box-shadow:var(--shadow-btn-hover),0_0_40px_rgba(255,255,255,0.06)] hover:-translate-y-px hover:scale-[1.02]" +
          " active:scale-[0.97]",
        link: "text-primary underline-offset-4 hover:underline font-medium",
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm:  "min-h-8 rounded-lg px-3 text-xs font-semibold",
        lg:  "min-h-10 rounded-xl px-8 text-[15px]",
        xl:  "min-h-12 rounded-2xl px-10 text-[15px] font-bold",
        icon:    "h-9 w-9 rounded-xl",
        "icon-sm": "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
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
