// Mock "API": reads go through a Promise with 300-600 ms latency so loading/empty/error states are real (playbook §8 step 0.9).
// Pages call useApi(() => compute from db, [deps]); the first load shows a skeleton, later refreshes (after run()) update silently.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../data/store'

export const latency = () => 300 + Math.random() * 300

export interface ApiState<T> { data: T | undefined; loading: boolean; error: string | null; reload: () => void }

export function useApi<T>(fn: () => T, deps: unknown[] = []): ApiState<T> {
  const { db, version } = useStore()
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const first = useRef(true)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    const silent = !first.current
    if (!silent) setLoading(true)
    const wait = silent ? 0 : latency()
    const t = window.setTimeout(() => {
      if (!alive) return
      if (db.simulateError) {
        setError('تعذّر الاتصال بالخادم (محاكاة خطأ)')
        setLoading(false)
        return
      }
      try {
        setData(fnRef.current())
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'خطأ غير متوقع')
      }
      first.current = false
      setLoading(false)
    }, wait)
    return () => { alive = false; window.clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, tick, db.simulateError, ...deps])

  const reload = useCallback(() => { first.current = true; setTick((t) => t + 1) }, [])
  return { data, loading, error, reload }
}
