export function generateSparklinePath(symbol: string, isUp: boolean, w = 64, h = 32): string {
  const seed = symbol.split('').reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0)

  const n = 14
  const points: [number, number][] = []
  let val = isUp ? 40 : 60

  for (let i = 0; i < n; i++) {
    const r1 = ((seed * (i + 3) * 29 + i * 17) % 1000) / 1000
    const r2 = ((seed * (i + 7) * 13 + i * 41) % 1000) / 1000
    const noise = (r1 - 0.5) * 22 + (r2 - 0.5) * 8
    const trend = isUp ? (i / (n - 1)) * 38 : -(i / (n - 1)) * 38
    val = Math.max(4, Math.min(96, 50 + trend * 0.5 + noise))
    points.push([i, val])
  }

  const xS = w / (n - 1)
  const yS = h / 100

  let d = `M ${(points[0][0] * xS).toFixed(1)} ${(h - points[0][1] * yS).toFixed(1)}`
  for (let i = 1; i < n; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const cpx = ((x0 + x1) / 2) * xS
    const cp0y = (h - y0 * yS).toFixed(1)
    const p1y = (h - y1 * yS).toFixed(1)
    d += ` Q ${cpx.toFixed(1)} ${cp0y} ${(x1 * xS).toFixed(1)} ${p1y}`
  }

  return d
}

export function generateSparklineArea(symbol: string, isUp: boolean, w = 64, h = 32): { line: string; area: string } {
  const line = generateSparklinePath(symbol, isUp, w, h)
  const area = line + ` L ${w} ${h} L 0 ${h} Z`
  return { line, area }
}

// Generates a realistic 1-day chart from actual OHLCV data so each stock looks unique.
// The noise amplitude is proportional to the stock's real high-low trading range.
export function generateDayChart(
  symbol: string,
  open: number,
  high: number,
  low: number,
  close: number,
  w = 340,
  h = 140
): { line: string; area: string; points: number[] } {
  const seed = symbol.split('').reduce((a, c, i) => a + c.charCodeAt(0) * (i + 3), 0)
  const n = 60
  const tradingRange = Math.max(high - low, close * 0.003)
  const rawPrices: number[] = [open]

  for (let i = 1; i < n - 1; i++) {
    const r1 = ((seed * (i + 5) * 37 + i * 23) % 10000) / 10000
    const r2 = ((seed * (i + 11) * 19 + i * 7) % 10000) / 10000
    const noise = (r1 - 0.5) * tradingRange * 0.22 + (r2 - 0.5) * tradingRange * 0.08
    const prev = rawPrices[i - 1]
    const drift = (close - prev) / (n - i) * 0.45
    const next = Math.max(low * 0.997, Math.min(high * 1.003, prev + drift + noise))
    rawPrices.push(next)
  }
  rawPrices.push(close)

  const minP = Math.min(...rawPrices)
  const maxP = Math.max(...rawPrices)
  const range = maxP - minP || 1
  const pad = h * 0.12
  const pts = rawPrices.map((p, i) => [
    (i / (n - 1)) * w,
    pad + ((maxP - p) / range) * (h - pad * 2),
  ] as [number, number])

  let line = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < n; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
    const cpx = ((x0 + x1) / 2).toFixed(1)
    line += ` Q ${cpx} ${y0.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`
  }
  return { line, area: line + ` L ${w} ${h} L 0 ${h} Z`, points: rawPrices }
}

export function generateIntradayChart(
  symbol: string,
  currentPrice: number,
  isUp: boolean,
  w = 340,
  h = 140
): { line: string; area: string; points: number[] } {
  const seed = symbol.split('').reduce((a, c, i) => a + c.charCodeAt(0) * (i + 3), 0)
  const n = 32

  const rawPrices: number[] = []
  const openPct = isUp ? -0.025 : 0.025
  let pct = openPct

  for (let i = 0; i < n; i++) {
    const r1 = ((seed * (i + 5) * 37 + i * 23) % 10000) / 10000
    const r2 = ((seed * (i + 11) * 19 + i * 7)  % 10000) / 10000
    const noise = (r1 - 0.5) * 0.012 + (r2 - 0.5) * 0.006
    const drift = isUp ? 0.0015 : -0.0015
    pct = Math.max(-0.08, Math.min(0.08, pct + drift + noise))
    rawPrices.push(currentPrice * (1 + pct))
  }
  rawPrices[n - 1] = currentPrice

  const minP = Math.min(...rawPrices)
  const maxP = Math.max(...rawPrices)
  const range = maxP - minP || 1
  const pad = h * 0.12

  const pts = rawPrices.map((p, i) => {
    const x = (i / (n - 1)) * w
    const y = pad + ((maxP - p) / range) * (h - pad * 2)
    return [x, y] as [number, number]
  })

  let line = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < n; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const cpx = ((x0 + x1) / 2).toFixed(1)
    line += ` Q ${cpx} ${y0.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`
  }

  const area = line + ` L ${w} ${h} L 0 ${h} Z`

  return { line, area, points: rawPrices }
}
