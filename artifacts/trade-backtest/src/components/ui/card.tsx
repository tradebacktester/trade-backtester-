import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    glass?: boolean;
    glow?: "cyan" | "indigo" | "green" | "none";
  }
>(({ className, glass = false, glow = "none", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[22px] border text-card-foreground",
      "transition-[box-shadow,border-color,transform] duration-[280ms]",
      "transition-timing-function-[cubic-bezier(0.34,1.2,0.64,1)]",
      "relative overflow-hidden",
      glass
        ? "backdrop-blur-[24px] saturate-[180%]"
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
    {/* Premium glass shine overlay */}
    <div
      className="pointer-events-none absolute inset-0 rounded-[22px]"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)",
        zIndex: 0,
      }}
    />
    <div className="relative z-[1]" style={{ display: "contents" }}>
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
