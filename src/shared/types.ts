export type MarketName = '沪A' | '深A' | '京A' | '其他'

export interface StockIdentity {
  code: string
  name: string
  secid: string
  market: MarketName
}

export interface Quote {
  secid: string
  code: string
  name: string
  price: number
  prevClose: number
  open: number
  high: number
  low: number
  change: number
  changePct: number
  volume: number
  amount: number
  time: string
}

export interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TrendPoint {
  time: string
  price: number
  avg: number
  volume: number
}

export type ChartTab = 'intraday' | 'daily'

export type BoxSensitivity = 'conservative' | 'standard' | 'sensitive'

export type BoxStatus = 'inside' | 'near_high' | 'near_low' | 'break_up' | 'break_down'

export type SRMethod = 'swing' | 'donchian' | 'volume' | 'fibonacci' | 'pivot'

export type SRKind = 'support' | 'resistance' | 'mid'

export interface SRLevel {
  method: SRMethod
  kind: SRKind
  price: number
  label: string
  explain: string
}

export interface PriceBox {
  startIndex: number
  endIndex: number
  startTime: string
  endTime: string
  high: number
  low: number
  mid: number
  score: number
  topTouches: number
  bottomTouches: number
  insideRatio: number
  status: BoxStatus
  atr: number
}

export interface StockApi {
  searchStocks: (keyword: string) => Promise<StockIdentity[]>
  getQuote: (secid: string) => Promise<Quote | null>
  getQuotes: (secids: string[]) => Promise<Quote[]>
  getDailyKline: (secid: string) => Promise<Candle[]>
  getIntraday: (secid: string) => Promise<TrendPoint[]>
  watchlistGet: () => Promise<StockIdentity[]>
  watchlistAdd: (stock: StockIdentity) => Promise<StockIdentity[]>
  watchlistRemove: (secid: string) => Promise<StockIdentity[]>
}
