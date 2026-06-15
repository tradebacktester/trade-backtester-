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
    "transition-all duration-[200ms] ease-[cubic-bezier(0.34,1.2,0.64,1)]",
    "relative overflow-hidden",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "rounded-xl border text-primary-foreground" +
          " [background:linear-gradient(135deg,hsl(250,100%,65%)_0%,hsl(270,100%,60%)_100%)]" +
          " [border-color:rgba(255,255,255,0.22)]" +
          " [box-shadow:inset_0_1px_0_rgba(255,255,255,0.28),var(--shadow-btn)]" +
          " hover:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.36),var(--shadow-btn-hover),0_0_40px_rgba(99,102,241,0.35)] hover:-translate-y-px hover:scale-[1.01]" +
          " active:scale-[0.98] active:translate-y-0 active:[box-shadow:var(--shadow-btn-active)]",
        destructive:
          "rounded-xl border text-destructive-foreground" +
          " [background:linear-gradient(135deg,#ef4444_0%,#dc2626_100%)]" +
          " [border-color:rgba(255,255,255,0.18)]" +
          " [box-shadow:inset_0_1px_0_rgba(255,255,255,0.24),var(--shadow-btn)]" +
          " hover:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.30),var(--shadow-btn-hover),0_0_30px_rgba(239,68,68,0.30)] hover:-translate-y-px hover:scale-[1.01]" +
          " active:scale-[0.98] active:translate-y-0",
        outline:
          "rounded-xl border backdrop-blur-[40px]" +
          " [background:var(--glass-bg)] [border-color:var(--glass-border)]" +
          " [box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),var(--shadow-xs)]" +
          " hover:bg-accent hover:text-accent-foreground hover:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.24),var(--shadow-sm)] hover:-translate-y-px" +
          " active:scale-[0.98]",
        secondary:
          "rounded-xl border backdrop-blur-[40px]" +
          " [background:var(--glass-bg)] [border-color:var(--glass-border)]" +
          " [box-shadow:inset_0_1px_0_rgba(255,255,255,0.16),var(--shadow-xs)]" +
          " hover:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.22),var(--shadow-sm)] hover:-translate-y-px hover:scale-[1.01]" +
          " active:scale-[0.98]",
        ghost:
          "rounded-xl border border-transparent backdrop-blur-[20px]" +
          " hover:[background:var(--glass-bg)] hover:[border-color:var(--glass-border)] hover:text-accent-foreground",
        glass:
          "rounded-xl border backdrop-blur-[44px]" +
          " [background:var(--glass-bg)] [border-color:var(--glass-border)]" +
          " [box-shadow:inset_0_1px_0_rgba(255,255,255,0.20),var(--shadow-sm)]" +
          " hover:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.28),var(--shadow-md)] hover:-translate-y-px hover:[border-color:var(--glass-border-strong)]" +
          " active:scale-[0.98]",
        cyan:
          "rounded-xl font-bold text-white backdrop-blur-[44px]" +
          " [background:linear-gradient(135deg,rgba(99,102,241,0.80)_0%,rgba(139,92,246,0.80)_100%)]" +
          " [border:1px_solid_rgba(255,255,255,0.22)]" +
          " [box-shadow:inset_0_1px_0_rgba(255,255,255,0.28),var(--shadow-btn)]" +
          " hover:[background:linear-gradient(135deg,rgba(99,102,241,0.90)_0%,rgba(139,92,246,0.90)_100%)] hover:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.36),var(--shadow-btn-hover),0_0_50px_rgba(99,102,241,0.40)] hover:-translate-y-px hover:scale-[1.02]" +
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
