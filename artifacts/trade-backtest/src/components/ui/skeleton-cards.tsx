import { cn } from "@/lib/utils";

function pulse(className?: string, style?: React.CSSProperties) {
  return (
    <div
      className={cn("animate-pulse rounded-lg", className)}
      style={{ background: "hsl(var(--muted))", ...style }}
    />
  );
}

export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 rounded-xl border border-border bg-card flex flex-col gap-2", className)}>
      {pulse("h-3 w-20")}
      {pulse("h-7 w-24")}
      {pulse("h-2 w-16")}
    </div>
  );
}

export function SkeletonRow({ cols = 4, className }: { cols?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 py-3 px-1", className)}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="flex-1">
          {pulse("h-4 w-full")}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ rows = 3, className }: { rows?: number; className?: string }) {
  const widths = ["w-full", "w-5/6", "w-4/6"];
  return (
    <div className={cn("p-5 rounded-2xl border border-border bg-card flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2 mb-1">
        {pulse("h-6 w-6 rounded-lg")}
        {pulse("h-4 w-32")}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cn("animate-pulse rounded-lg h-4", widths[i] ?? "w-1/2")}
          style={{ background: "hsl(var(--muted))" }} />
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 200, className }: { height?: number; className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card flex items-end gap-1 p-4", className)}
      style={{ height }}
    >
      {[55, 70, 40, 85, 60, 90, 45, 75, 65, 80, 50, 95].map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t animate-pulse"
          style={{ height: `${h}%`, background: "hsl(var(--muted))", animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border overflow-hidden", className)}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border" style={{ background: "hsl(var(--muted)/0.4)" }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1">{pulse("h-3 w-16")}</div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="flex-1">
              {pulse("h-4", { width: `${50 + Math.floor(Math.sin(r + c) * 30 + 30)}%` })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
