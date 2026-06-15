import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    glass?: boolean;
    glow?: "cyan" | "indigo" | "green" | "none";
  }
>(({ className, glass = true, glow = "none", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[22px] border text-card-foreground",
      "transition-[box-shadow,border-color,transform] duration-[280ms]",
      "transition-timing-function-[cubic-bezier(0.34,1.2,0.64,1)]",
      "relative overflow-hidden",
      glass
        ? "backdrop-blur-[44px] [filter:saturate(220%)_brightness(1.06)]"
        : "bg-card",
      glow === "cyan" && "hover:glow-cyan",
      glow === "indigo" && "hover:glow-indigo",
      glow === "green" && "hover:glow-green",
      className
    )}
    style={{
      background: glass ? "var(--glass-bg)" : undefined,
      borderColor: "var(--glass-border)",
      boxShadow: "var(--shadow-card)",
      ...(props.style),
    }}
    {...props}
  >
    {/* Specular top-edge highlight — real glass catching light */}
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-[2]"
      style={{
        height: "1px",
        background: "linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.40) 25%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0.40) 75%, transparent 95%)",
      }}
    />
    {/* Inner top glow — depth gradient */}
    <div
      className="pointer-events-none absolute inset-0 rounded-[22px] z-[1]"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 35%, transparent 100%)",
      }}
    />
    <div className="relative z-[3]" style={{ display: "contents" }}>
      {props.children}
    </div>
  </div>
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("font-bold leading-none tracking-tight", className)} {...props} />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
