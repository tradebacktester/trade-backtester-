import type { AlertConditionSpec } from "@workspace/db";
import type { IndicatorSnapshot } from "./indicator-snapshot";

// ── Drawing geometry evaluation ──────────────────────────────────────────
// Matches the DrawingAlertGeometry schema in lib/db/src/schema/alerts.ts:
//   hline   → price1 = price level
//   trendline → price1, price2 = upper/lower bounds (used as range)
//   rect    → price1 = upper bound, price2 = lower bound
//   fib     → price1 = high, price2 = low, fibLevel = specific ratio (0.236 etc.)
//             drawingEvent: "fibLevel" means trigger on ANY fib level within band
//   vline   → time-based; cannot be evaluated from price alone → always false
import type { DrawingAlertGeometry } from "@workspace/db";

const STD_FIB_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786];
const TOUCH_TOLERANCE_PCT = 0.003; // 0.3% band

function evalDrawingOperator(
  operator: string,
  drawingEvent: string | undefined,
  geometry: DrawingAlertGeometry | null,
  currPrice: number,
  prevPrice: number,
): boolean {
  if (!geometry) return false;

  const effectiveOp = drawingEvent ?? operator;

  // ── Horizontal line ────────────────────────────────────────────────
  if (geometry.type === "hline") {
    const level = geometry.price1 ?? 0;
    if (!level) return false;
    const band = Math.abs(level) * TOUCH_TOLERANCE_PCT;
    if (effectiveOp === "touch")       return Math.abs(currPrice - level) <= band;
    if (effectiveOp === "breakAbove")  return prevPrice < level && currPrice > level + band;
    if (effectiveOp === "breakBelow")  return prevPrice > level && currPrice < level - band;
    return false;
  }

  // ── Trendline / rectangle (price zone) ────────────────────────────
  if (geometry.type === "trendline" || geometry.type === "rect") {
    const upper = Math.max(geometry.price1 ?? 0, geometry.price2 ?? 0);
    const lower = Math.min(geometry.price1 ?? 0, geometry.price2 ?? 0);
    if (!upper || !lower) return false;
    const wasInside = prevPrice >= lower && prevPrice <= upper;
    const isInside  = currPrice >= lower && currPrice <= upper;
    if (effectiveOp === "touch")      return isInside;
    if (effectiveOp === "enterZone")  return !wasInside && isInside;
    if (effectiveOp === "exitZone")   return wasInside && !isInside;
    if (effectiveOp === "breakAbove") return currPrice > upper && prevPrice <= upper;
    if (effectiveOp === "breakBelow") return currPrice < lower && prevPrice >= lower;
    return false;
  }

  // ── Fibonacci retracement ─────────────────────────────────────────
  if (geometry.type === "fib") {
    const high = geometry.price1 ?? 0;
    const low  = geometry.price2 ?? 0;
    if (!high || !low || high <= low) return false;
    const range = high - low;

    // If a specific fib level ratio is stored, use only that level;
    // otherwise iterate standard Fibonacci levels.
    const levels = geometry.fibLevel != null ? [geometry.fibLevel] : STD_FIB_LEVELS;

    for (const ratio of levels) {
      const fibPrice = low + range * ratio;
      const band = fibPrice * TOUCH_TOLERANCE_PCT;
      if ((effectiveOp === "touch" || effectiveOp === "fibLevel") && Math.abs(currPrice - fibPrice) <= band) return true;
      if (effectiveOp === "breakAbove" && prevPrice < fibPrice && currPrice > fibPrice + band) return true;
      if (effectiveOp === "breakBelow" && prevPrice > fibPrice && currPrice < fibPrice - band) return true;
    }
    return false;
  }

  // ── Vertical line — time-based, cannot evaluate from price snapshot ─
  if (geometry.type === "vline") return false;

  return false;
}

function resolveValue(
  key: string,
  snapshot: IndicatorSnapshot,
  which: "curr" | "prev",
): number | null {
  return snapshot[key]?.[which] ?? null;
}

function evalOperator(
  operator: AlertConditionSpec["operator"],
  curr: number | null,
  prev: number | null,
  targetCurr: number | null,
  targetPrev: number | null,
  targetValue: number | undefined,
): boolean {
  if (curr == null) return false;

  const target = targetValue !== undefined ? targetValue : targetCurr;

  switch (operator) {
    case "gt":
      return target != null && curr > target;
    case "lt":
      return target != null && curr < target;
    case "eq":
      return target != null && Math.abs(curr - target) < 1e-9;
    case "crossAbove":
      return prev != null && targetPrev != null && target != null && prev <= targetPrev && curr > target;
    case "crossBelow":
      return prev != null && targetPrev != null && target != null && prev >= targetPrev && curr < target;
    case "enters":
      if (targetValue === undefined) return false;
      return prev != null && prev < targetValue && curr >= targetValue;
    case "exits":
      if (targetValue === undefined) return false;
      return prev != null && prev >= targetValue && curr < targetValue;
    case "signal":
      return curr > 0;
    default:
      return false;
  }
}

interface EvalResult {
  triggered: boolean;
  message: string;
}

export function evaluateAlertConditions(
  alertName: string,
  symbol: string,
  conditions: AlertConditionSpec[],
  snapshot: IndicatorSnapshot,
): EvalResult {
  if (conditions.length === 0) {
    return { triggered: false, message: "" };
  }

  const groupMap = new Map<number, { results: boolean[]; logicOp: "AND" | "OR" }>();

  // Resolve current price from snapshot for drawing geometry evaluation
  const currPrice = snapshot["price_close"]?.curr ?? null;
  const prevPrice = snapshot["price_close"]?.prev ?? null;

  for (const cond of conditions) {
    const gid = cond.groupId ?? 0;
    if (!groupMap.has(gid)) {
      groupMap.set(gid, { results: [], logicOp: cond.logicOp });
    }

    // ── Drawing condition ───────────────────────────────────────────
    const isDrawing =
      (cond as any).drawingId !== undefined ||
      (cond as any).drawingEvent !== undefined ||
      cond.indicatorId === "drawing";

    if (isDrawing) {
      const geometry = ((cond as any).drawingGeometry ?? null) as DrawingAlertGeometry | null;
      const drawingEvent = (cond as any).drawingEvent as string | undefined;
      const result =
        currPrice != null && prevPrice != null
          ? evalDrawingOperator(cond.operator, drawingEvent, geometry, currPrice, prevPrice)
          : false;
      groupMap.get(gid)!.results.push(result);
      continue;
    }

    // ── Indicator / price condition ─────────────────────────────────
    const indicatorKey = `${cond.indicatorId}_${cond.outputKey}`;
    const curr = resolveValue(indicatorKey, snapshot, "curr");
    const prev = resolveValue(indicatorKey, snapshot, "prev");

    let targetCurr: number | null = null;
    let targetPrev: number | null = null;

    if (cond.targetIndicatorId && cond.targetOutputKey) {
      const tKey = `${cond.targetIndicatorId}_${cond.targetOutputKey}`;
      targetCurr = resolveValue(tKey, snapshot, "curr");
      targetPrev = resolveValue(tKey, snapshot, "prev");
    } else if (cond.targetValue !== undefined) {
      targetCurr = cond.targetValue;
      targetPrev = cond.targetValue;
    }

    const result = evalOperator(cond.operator, curr, prev, targetCurr, targetPrev, cond.targetValue);
    groupMap.get(gid)!.results.push(result);
  }

  const groupResults: boolean[] = [];
  for (const [, group] of groupMap) {
    if (group.logicOp === "OR") {
      groupResults.push(group.results.some(Boolean));
    } else {
      groupResults.push(group.results.every(Boolean));
    }
  }

  const triggered = groupResults.every(Boolean);
  const message = triggered
    ? `Alert "${alertName}" triggered for ${symbol}`
    : "";

  return { triggered, message };
}
