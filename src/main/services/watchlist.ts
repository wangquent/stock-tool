import Store from 'electron-store'
import type { StockIdentity } from '../../shared/types'

let store: Store<{ items: StockIdentity[] }> | null = null

function getStore(): Store<{ items: StockIdentity[] }> {
  if (!store) {
    store = new Store<{ items: StockIdentity[] }>({
      name: 'watchlist',
      defaults: { items: [] }
    })
  }
  return store
}

export function getWatchlist(): StockIdentity[] {
  return getStore().get('items', [])
}

export function addToWatchlist(stock: StockIdentity): StockIdentity[] {
  const items = getWatchlist()
  if (items.some((item) => item.secid === stock.secid)) {
    return items
  }
  const next = [stock, ...items].slice(0, 80)
  getStore().set('items', next)
  return next
}

export function removeFromWatchlist(secid: string): StockIdentity[] {
  const next = getWatchlist().filter((item) => item.secid !== secid)
  getStore().set('items', next)
  return next
}
