import { CandleLoader } from "@/components/candle-loader";
import { cn } from "@/lib/utils";

function Spinner({ className }: { className?: string }) {
  const small = className?.includes("size-4") || className?.includes("h-4");
  const xsmall = className?.includes("h-3") || className?.includes("size-3");
  return (
    <CandleLoader
      size={xsmall ? "xs" : small ? "sm" : "md"}
      className={cn(className)}
    />
  );
}

export { Spinner };
