export interface TradeForOverfit {
  pnl: number;
  pnlPercent: number;
}

export function computeOverfittingScore(trades: TradeForOverfit[]): number {
  if (trades.length < 5) return 82;

  // ── 1. Walk-forward IS/OOS split (first 60% = in-sample, last 40% = out-of-sample)
  const splitIdx = Math.floor(trades.length * 0.6);
  const isTrades = trades.slice(0, splitIdx);
  const oosTrades = trades.slice(splitIdx);

  function miniSharpe(ts: TradeForOverfit[]): number {
    if (ts.length < 2) return 0;
    const rets = ts.map(t => t.pnlPercent / 100);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
    const std = Math.sqrt(variance);
    return std > 0 ? mean / std : 0;
  }

  const isSharpe = miniSharpe(isTrades);
  const oosSharpe = miniSharpe(oosTrades);

  let wfSignal = 0;
  if (isSharpe > 0.01) {
    if (oosSharpe <= 0) {
      wfSignal = 1.0; // Positive IS, negative OOS = strong overfit signal
    } else {
      wfSignal = Math.max(0, 1 - oosSharpe / isSharpe);
    }
  } else if (isSharpe <= 0 && oosSharpe <= 0) {
    wfSignal = 0.15; // Both periods bad = bad strategy, not necessarily overfit
  }
  wfSignal = Math.min(1, wfSignal);

  // ── 2. Monte Carlo: shuffle P&Ls and see how often random orderings do better
  const pnls = trades.map(t => t.pnl);
  const actualTotal = pnls.reduce((s, p) => s + p, 0);
  let beatCount = 0;
  const ITER = 300;
  for (let i = 0; i < ITER; i++) {
    const arr = [...pnls];
    for (let j = arr.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [arr[j], arr[k]] = [arr[k], arr[j]];
    }
    if (arr.reduce((s, p) => s + p, 0) > actualTotal * 1.04) beatCount++;
  }
  const mcSignal = beatCount / ITER;

  // ── 3. Sample size penalty (<30 trades = high overfit risk from small N)
  const sampleSignal = Math.max(0, 1 - trades.length / 30);

  // ── Combine
  const raw = 0.45 * wfSignal + 0.30 * mcSignal + 0.25 * sampleSignal;
  return Math.round(Math.min(100, Math.max(0, raw * 100)));
}

export interface OverfitRating {
  label: string;
  color: string;
  bg: string;
  description: string;
}

export function overfitRating(score: number): OverfitRating {
  if (score <= 20) return {
    label: "Low Risk",
    color: "#16a34a",
    bg: "rgba(22,163,74,0.10)",
    description: "Strategy performs consistently across in-sample and out-of-sample periods.",
  };
  if (score <= 45) return {
    label: "Moderate",
    color: "#d97706",
    bg: "rgba(217,119,6,0.10)",
    description: "Some performance decay out-of-sample. Paper trade before going live.",
  };
  if (score <= 70) return {
    label: "High Risk",
    color: "#ea580c",
    bg: "rgba(234,88,12,0.10)",
    description: "Significant drop in out-of-sample performance. Likely curve-fitted.",
  };
  return {
    label: "Likely Overfit",
    color: "#dc2626",
    bg: "rgba(220,38,38,0.10)",
    description: "Results unlikely to replicate in live trading. Strategy may be noise-fit.",
  };
}
