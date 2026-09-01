type CacheEntry<T> = {
  expireAt: number
  data: T
}

const store = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = store.get(key) as CacheEntry<T> | undefined
  if (hit && hit.expireAt > now) {
    return hit.data
  }

  const pending = inflight.get(key)
  if (pending) {
    return pending as Promise<T>
  }

  const task = fn()
    .then((data) => {
      store.set(key, { expireAt: Date.now() + ttlMs, data })
      return data
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, task)
  return task
}
