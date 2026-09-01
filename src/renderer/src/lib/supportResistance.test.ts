import { describe, expect, it } from 'vitest'
import type { Candle } from '../../../shared/types'
import { donchianLevels, explainLevel, fibonacciLevels, pivotLevels, volumeLevels } from './supportResistance'

function candle(i: number, open: number, high: number, low: number, close: number, volume = 1000): Candle {
  const day = 1 + (i % 28)
  const month = 1 + Math.floor(i / 28)
  return {
    time: `2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    open,
    high,
    low,
    close,
    volume
  }
}

describe('supportResistance methods', () => {
  it('近N日高低取窗口极值', () => {
    const candles: Candle[] = []
    for (let i = 0; i < 20; i++) {
      candles.push(candle(i, 10, 10.5 + i * 0.01, 9.5, 10.2))
    }
    candles[3] = candle(3, 10, 12, 9.5, 10.2)
    candles[8] = candle(8, 10, 10.5, 8, 10.1)
    const levels = donchianLevels(candles, 20)
    expect(levels.find((l) => l.kind === 'resistance')?.price).toBe(12)
    expect(levels.find((l) => l.kind === 'support')?.price).toBe(8)
  })

  it('枢轴点按前一日高低收计算', () => {
    const candles = [
      candle(0, 10, 11, 9, 10.5),
      candle(1, 10.5, 12, 10, 11)
    ]
    const levels = pivotLevels(candles)
    const pp = levels.find((l) => l.label === '枢轴PP')?.price
    expect(pp).toBeCloseTo((11 + 9 + 10.5) / 3)
    expect(levels.find((l) => l.label === '枢轴R1')?.price).toBeCloseTo(2 * (pp as number) - 9)
    expect(levels.find((l) => l.label === '枢轴S1')?.price).toBeCloseTo(2 * (pp as number) - 11)
  })

  it('斐波那契落在摆动高低点之间', () => {
    const candles: Candle[] = []
    for (let i = 0; i < 40; i++) {
      const close = 10 + Math.sin((i / 8) * Math.PI) * 2
      candles.push(candle(i, close, close + 0.2, close - 0.2, close))
    }
    const levels = fibonacciLevels(candles)
    const prices = levels.map((l) => l.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    expect(levels).toHaveLength(5)
    expect(max).toBeGreaterThan(min)
    expect(levels.find((l) => l.label === 'Fib 50%')?.price).toBeCloseTo((min + max) / 2)
  })

  it('成交量POC落在放量价位附近', () => {
    const candles: Candle[] = []
    for (let i = 0; i < 40; i++) {
      const around10 = i % 3 === 0
      candles.push(
        candle(i, around10 ? 10 : 14, around10 ? 10.2 : 14.2, around10 ? 9.8 : 13.8, around10 ? 10 : 14, around10 ? 9000 : 200)
      )
    }
    const poc = volumeLevels(candles).find((l) => l.label === '量POC')
    expect(poc).toBeTruthy()
    expect(poc?.price ?? 0).toBeLessThan(12)
  })

  it('枢轴R1说明包含阻力含义', () => {
    expect(explainLevel('枢轴R1')).toContain('阻力')
    expect(explainLevel('枢轴S1')).toContain('支撑')
    expect(explainLevel('量POC')).toContain('密集')
  })
})
