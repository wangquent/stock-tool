import { create } from 'zustand'
import type { BoxSensitivity, ChartTab, Quote, SRMethod, StockIdentity } from '../../../shared/types'

interface AppState {
  selected: StockIdentity | null
  watchlist: StockIdentity[]
  quotes: Record<string, Quote>
  chartTab: ChartTab
  toolboxOpen: boolean
  boxEnabled: boolean
  boxSensitivity: BoxSensitivity
  srEnabled: boolean
  srMethods: SRMethod[]
  setSelected: (stock: StockIdentity | null) => void
  setWatchlist: (items: StockIdentity[]) => void
  setQuotes: (quotes: Quote[]) => void
  setChartTab: (tab: ChartTab) => void
  setToolboxOpen: (open: boolean) => void
  setBoxEnabled: (enabled: boolean) => void
  setBoxSensitivity: (value: BoxSensitivity) => void
  setSrEnabled: (enabled: boolean) => void
  toggleSrMethod: (method: SRMethod) => void
}

export const useAppStore = create<AppState>((set) => ({
  selected: null,
  watchlist: [],
  quotes: {},
  chartTab: 'intraday',
  toolboxOpen: false,
  boxEnabled: false,
  boxSensitivity: 'standard',
  srEnabled: false,
  srMethods: ['swing', 'donchian'],
  setSelected: (stock) => set({ selected: stock }),
  setWatchlist: (items) => set({ watchlist: items }),
  setQuotes: (quotes) =>
    set((state) => {
      const next = { ...state.quotes }
      for (const quote of quotes) {
        next[quote.secid] = quote
      }
      return { quotes: next }
    }),
  setChartTab: (tab) => set({ chartTab: tab }),
  setToolboxOpen: (open) => set({ toolboxOpen: open }),
  setBoxEnabled: (enabled) =>
    set((state) => ({
      boxEnabled: enabled,
      chartTab: enabled ? 'daily' : state.chartTab,
      toolboxOpen: enabled ? true : state.toolboxOpen
    })),
  setBoxSensitivity: (value) => set({ boxSensitivity: value }),
  setSrEnabled: (enabled) =>
    set((state) => ({
      srEnabled: enabled,
      chartTab: enabled ? 'daily' : state.chartTab,
      toolboxOpen: enabled ? true : state.toolboxOpen
    })),
  toggleSrMethod: (method) =>
    set((state) => {
      const current = state.srMethods ?? []
      return {
        srMethods: current.includes(method)
          ? current.filter((item) => item !== method)
          : [...current, method]
      }
    })
}))
