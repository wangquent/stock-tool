import type { BoxSensitivity, BoxStatus, Candle, PriceBox } from '../../../shared/types'

interface SwingPoint {
  index: number
  price: number
}

interface Cluster {
  price: number
  members: SwingPoint[]
}

const PARAMS: Record<BoxSensitivity, { n: number; k: number }> = {
  conservative: { n: 8, k: 0.3 },
  standard: { n: 5, k: 0.4 },
  sensitive: { n: 3, k: 0.55 }
}

function trueRange(candles: Candle[], i: number): number {
  if (i === 0) return candles[0].high - candles[0].low
  const prevClose = candles[i - 1].close
  return Math.max(
    candles[i].high - candles[i].low,
    Math.abs(candles[i].high - prevClose),
    Math.abs(candles[i].low - prevClose)
  )
}

export function computeAtr(candles: Candle[], period = 14): number {
  if (candles.length === 0) return 0
  const ranges = candles.map((_, i) => trueRange(candles, i))
  if (ranges.length < period) {
    return ranges.reduce((a, b) => a + b, 0) / ranges.length
  }
  let atr = ranges.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < ranges.length; i++) {
    atr = (atr * (period - 1) + ranges[i]) / period
  }
  return atr
}

export function fractalSwings(candles: Candle[], n: number): { highs: SwingPoint[]; lows: SwingPoint[] } {
  const highs: SwingPoint[] = []
  const lows: SwingPoint[] = []
  for (let i = n; i < candles.length - n; i++) {
    let isHigh = true
    let isLow = true
    for (let j = 1; j <= n; j++) {
      if (candles[i].high < candles[i - j].high || candles[i].high < candles[i + j].high) {
        isHigh = false
      }
      if (candles[i].low > candles[i - j].low || candles[i].low > candles[i + j].low) {
        isLow = false
      }
    }
    if (isHigh) highs.push({ index: i, price: candles[i].high })
    if (isLow) lows.push({ index: i, price: candles[i].low })
  }
  return { highs, lows }
}

function clusterPrices(points: SwingPoint[], tolerance: number): Cluster[] {
  if (points.length === 0) return []
  const sorted = [...points].sort((a, b) => a.price - b.price)
  const clusters: Cluster[] = []

  for (const point of sorted) {
    const found = clusters.find((c) => Math.abs(point.price - c.price) <= tolerance)
    if (found) {
      found.members.push(point)
      found.price = found.members.reduce((sum, m) => sum + m.price, 0) / found.members.length
    } else {
      clusters.push({ price: point.price, members: [point] })
    }
  }

  return clusters.filter((c) => c.members.length >= 2)
}

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMax >= bMin && bMax >= aMin
}

function boxStatus(lastClose: number, high: number, low: number, tolerance: number): BoxStatus {
  const height = high - low
  const band = 0.15 * height
  if (lastClose > high + tolerance) return 'break_up'
  if (lastClose < low - tolerance) return 'break_down'
  if (lastClose >= high - band) return 'near_high'
  if (lastClose <= low + band) return 'near_low'
  return 'inside'
}

function overlapsTooMuch(a: PriceBox, b: PriceBox): boolean {
  const timeOverlap = Math.min(a.endIndex, b.endIndex) - Math.max(a.startIndex, b.startIndex)
  const timeUnion = Math.max(a.endIndex, b.endIndex) - Math.min(a.startIndex, b.startIndex)
  const priceOverlap = Math.min(a.high, b.high) - Math.max(a.low, b.low)
  const priceUnion = Math.max(a.high, b.high) - Math.min(a.low, b.low)
  if (timeUnion <= 0 || priceUnion <= 0 || timeOverlap <= 0 || priceOverlap <= 0) return false
  return timeOverlap / timeUnion > 0.6 && priceOverlap / priceUnion > 0.6
}

export function detectBoxes(
  candles: Candle[],
  sensitivity: BoxSensitivity = 'standard'
): PriceBox[] {
  if (candles.length < 30) return []

  const { n, k } = PARAMS[sensitivity]
  const atr = computeAtr(candles)
  if (!Number.isFinite(atr) || atr <= 0) return []

  const tolerance = k * atr
  const { highs, lows } = fractalSwings(candles, n)
  const resistance = clusterPrices(highs, tolerance)
  const support = clusterPrices(lows, tolerance)
  const last = candles[candles.length - 1]
  const candidates: PriceBox[] = []

  for (const res of resistance) {
    for (const sup of support) {
      if (res.price <= sup.price) continue
      const height = res.price - sup.price
      if (height < 1.2 * atr || height > 6 * atr) continue

      const highIdx = res.members.map((m) => m.index)
      const lowIdx = sup.members.map((m) => m.index)
      const highMin = Math.min(...highIdx)
      const highMax = Math.max(...highIdx)
      const lowMin = Math.min(...lowIdx)
      const lowMax = Math.max(...lowIdx)
      if (!rangesOverlap(highMin, highMax, lowMin, lowMax)) continue

      const start = Math.min(highMin, lowMin)
      const end = Math.max(highMax, lowMax)
      const len = end - start + 1
      if (len < 8 || len > 80) continue

      let inside = 0
      let topTouches = 0
      let bottomTouches = 0
      for (let i = start; i <= end; i++) {
        const c = candles[i]
        if (c.close >= sup.price && c.close <= res.price) inside += 1
        if (c.high >= res.price - tolerance && c.high <= res.price + tolerance) topTouches += 1
        if (c.low <= sup.price + tolerance && c.low >= sup.price - tolerance) bottomTouches += 1
      }

      if (topTouches < 2 || bottomTouches < 2) continue
      const insideRatio = inside / len
      if (insideRatio < 0.7) continue

      const recency = end / Math.max(candles.length - 1, 1)
      const score = ((topTouches + bottomTouches) * insideRatio) / (height / atr) * (0.5 + 0.5 * recency)

      candidates.push({
        startIndex: start,
        endIndex: candles.length - 1,
        startTime: candles[start].time,
        endTime: last.time,
        high: res.price,
        low: sup.price,
        mid: (res.price + sup.price) / 2,
        score,
        topTouches,
        bottomTouches,
        insideRatio,
        status: boxStatus(last.close, res.price, sup.price, tolerance),
        atr
      })
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const picked: PriceBox[] = []
  for (const box of candidates) {
    if (picked.some((p) => overlapsTooMuch(p, box))) continue
    picked.push(box)
    if (picked.length >= 2) break
  }
  return picked
}

export function statusLabel(status: BoxStatus): string {
  switch (status) {
    case 'inside':
      return '箱内震荡'
    case 'near_high':
      return '靠近箱顶'
    case 'near_low':
      return '靠近箱底'
    case 'break_up':
      return '向上突破'
    case 'break_down':
      return '向下跌破'
  }
}
