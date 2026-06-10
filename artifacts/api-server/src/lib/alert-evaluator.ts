import type { AlertConditionSpec } from "@workspace/db";
import type { IndicatorSnapshot } from "./indicator-snapshot";

// ── Drawing geometry evaluation ──────────────────────────────────────────
// DrawingGeometry is stored as JSONB on conditions created from drawing tools.
// Supported shapes: horizontalLine { price }, priceZone { upper, lower },
//   fibRetracement { high, low, levels: number[] }
type DrawingGeometry =
  | { type: "horizontalLine"; price: number }
  | { type: "priceZone"; upper: number; lower: number }
  | { type: "fibRetracement"; high: number; low: number; levels: number[] };

const TOUCH_TOLERANCE_PCT = 0.003; // 0.3% band for "touch" events

function evalDrawingOperator(
  operator: string,
  drawingEvent: string | undefined,
  geometry: DrawingGeometry | null,
  currPrice: number,
  prevPrice: number,
): boolean {
  if (!geometry) return false;

  const effectiveOp = drawingEvent ?? operator;

  if (geometry.type === "horizontalLine") {
    const level = geometry.price;
    const band = level * TOUCH_TOLERANCE_PCT;
    if (effectiveOp === "touch")       return Math.abs(currPrice - level) <= band;
    if (effectiveOp === "breakAbove")  return prevPrice < level && currPrice > level + band;
    if (effectiveOp === "breakBelow")  return prevPrice > level && currPrice < level - band;
    return false;
  }

  if (geometry.type === "priceZone") {
    const { upper, lower } = geometry;
    const wasInside = prevPrice >= lower && prevPrice <= upper;
    const isInside  = currPrice >= lower && currPrice <= upper;
    if (effectiveOp === "touch")      return isInside;
    if (effectiveOp === "enterZone")  return !wasInside && isInside;
    if (effectiveOp === "exitZone")   return wasInside && !isInside;
    if (effectiveOp === "breakAbove") return currPrice > upper && prevPrice <= upper;
    if (effectiveOp === "breakBelow") return currPrice < lower && prevPrice >= lower;
    return false;
  }

  if (geometry.type === "fibRetracement") {
    const { high, low, levels } = geometry;
    const range = high - low;
    for (const level of levels) {
      const fibPrice = low + range * level;
      const band = fibPrice * TOUCH_TOLERANCE_PCT;
      if (effectiveOp === "touch" && Math.abs(currPrice - fibPrice) <= band)     return true;
      if (effectiveOp === "breakAbove" && prevPrice < fibPrice && currPrice > fibPrice + band) return true;
      if (effectiveOp === "breakBelow" && prevPrice > fibPrice && currPrice < fibPrice - band) return true;
    }
    return false;
  }

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
      const geometry = ((cond as any).drawingGeometry ?? null) as DrawingGeometry | null;
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
