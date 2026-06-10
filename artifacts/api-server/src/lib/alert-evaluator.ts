import type { AlertConditionSpec } from "@workspace/db";
import type { IndicatorSnapshot } from "./indicator-snapshot";

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

  for (const cond of conditions) {
    const gid = cond.groupId ?? 0;
    if (!groupMap.has(gid)) {
      groupMap.set(gid, { results: [], logicOp: cond.logicOp });
    }

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
