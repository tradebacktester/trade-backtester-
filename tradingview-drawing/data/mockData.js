// 500 BTC/USDT 1h OHLCV candles — seeded deterministic random walk
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateCandles() {
  const rand = seededRand(42);
  const candles = [];
  const startTime = 1704067200; // 2024-01-01 00:00:00 UTC
  let price = 42000;

  for (let i = 0; i < 500; i++) {
    const time = startTime + i * 3600;
    const open = price;
    const vol = price * 0.012;
    const trend = (rand() - 0.47) * vol;
    const wickU = rand() * vol * 0.6;
    const wickD = rand() * vol * 0.6;
    const close = open + trend;
    const high = Math.max(open, close) + wickU;
    const low  = Math.min(open, close) - wickD;

    candles.push({
      time,
      open:  +open.toFixed(2),
      high:  +high.toFixed(2),
      low:   +low.toFixed(2),
      close: +close.toFixed(2),
    });
    price = close;
  }
  return candles;
}

export const CANDLE_DATA = generateCandles();
