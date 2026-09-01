import type { StockApi } from '../shared/types'

declare global {
  interface Window {
    api: StockApi
  }
}

export {}
