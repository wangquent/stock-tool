import { contextBridge, ipcRenderer } from 'electron'
import type { StockApi, StockIdentity } from '../shared/types'

const api: StockApi = {
  searchStocks: (keyword) => ipcRenderer.invoke('search-stocks', keyword),
  getQuote: (secid) => ipcRenderer.invoke('get-quote', secid),
  getQuotes: (secids) => ipcRenderer.invoke('get-quotes', secids),
  getDailyKline: (secid) => ipcRenderer.invoke('get-daily-kline', secid),
  getIntraday: (secid) => ipcRenderer.invoke('get-intraday', secid),
  watchlistGet: () => ipcRenderer.invoke('watchlist-get'),
  watchlistAdd: (stock: StockIdentity) => ipcRenderer.invoke('watchlist-add', stock),
  watchlistRemove: (secid) => ipcRenderer.invoke('watchlist-remove', secid)
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  const w = window as unknown as Window & { api: StockApi }
  w.api = api
}
