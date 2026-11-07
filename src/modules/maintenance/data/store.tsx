import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { setToday, today } from './asof'
import { nowStamp, uid } from './format'
import { sweepExpiry } from './estimate'
import { can as canRole } from './permissions'
import { seed } from './seed'
import type { AppUser, DB, Perm, RoleId } from './types'

const KEY = 'enki-maintenance-mock'
/** Bump whenever the data model or seed changes — stored data with another version is discarded and reseeded. */
export const DATA_VERSION = 8

type Toast = { msg: string; tone: 'ok' | 'err' }

interface Ctx {
  db: DB
  /** Incremented after every successful run(); useApi hooks use it to refresh. */
  version: number
  /** Applies a mutation to a copy of the DB. If `fn` returns a string it is treated as an error and nothing is saved. */
  run: (fn: (draft: DB) => string | null | void, ok?: string) => boolean
  reset: () => void
  toast: (msg: string, tone?: 'ok' | 'err') => void
  can: (p: Perm) => boolean
  user: AppUser
  setRole: (role: RoleId) => void
  setUser: (userId: string) => void
  setAsOf: (date: string) => void
}

const StoreCtx = createContext<Ctx | null>(null)

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw) as { version?: number; db?: DB }
      if (saved.version === DATA_VERSION && saved.db) return saved.db
    }
  } catch {
    /* ignore: unreadable storage falls back to the seed */
  }
  return seed()
}

/** Appends an audit row to a draft DB (call inside run()). */
export function addAudit(d: DB, entity: string, entityId: string, action: string, detail = '') {
  d.audit.push({ id: uid('aud'), at: nowStamp(), userId: d.userId, entity, entityId, action, detail })
}

/** Next document number in the plan's format: MWO-2026-000046 (counter per prefix and year). */
export function nextNumber(d: DB, prefix: string) {
  const year = today().slice(0, 4)
  const key = `${prefix}-${year}`
  d.counters[key] = (d.counters[key] ?? 0) + 1
  return `${prefix}-${year}-${String(d.counters[key]).padStart(6, '0')}`
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => {
    const d = load()
    setToday(d.asOf)
    return d
  })
  const [version, setVersion] = useState(0)
  const ref = useRef(db) // latest DB so consecutive run() calls in one event build on each other
  const [toastMsg, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: DATA_VERSION, db }))
    } catch {
      /* ignore: storage full or blocked, the session keeps working in memory */
    }
  }, [db])

  const toast = useCallback((msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const commit = useCallback((next: DB) => {
    ref.current = next
    setToday(next.asOf)
    setDb(next)
    setVersion((v) => v + 1)
  }, [])

  const run = useCallback(
    (fn: (draft: DB) => string | null | void, ok?: string) => {
      const next = structuredClone(ref.current)
      setToday(next.asOf)
      const err = fn(next)
      if (typeof err === 'string') {
        toast(err, 'err')
        return false
      }
      commit(next)
      if (ok) toast(ok)
      return true
    },
    [toast, commit],
  )

  const reset = useCallback(() => commit(seed()), [commit])
  const can = useCallback((p: Perm) => canRole(db.rolePerms, db.role, p), [db.rolePerms, db.role])
  const user = useMemo(() => db.users.find((u) => u.id === db.userId) ?? db.users[0], [db.users, db.userId])

  const setRole = useCallback(
    (role: RoleId) => run((d) => {
      d.role = role
      const u = d.users.find((x) => x.role === role)
      if (u) d.userId = u.id
    }),
    [run],
  )
  const setUser = useCallback(
    (userId: string) => run((d) => {
      const u = d.users.find((x) => x.id === userId)
      if (!u) return 'مستخدم غير معروف'
      d.userId = u.id
      d.role = u.role
    }),
    [run],
  )
  const setAsOf = useCallback((date: string) => run((d) => {
    d.asOf = date
    setToday(date)
    addAudit(d, 'demo', 'asOf', 'تغيير التاريخ التجريبي', date)
    const ex = sweepExpiry(d)
    if (ex) addAudit(d, 'demo', 'expiry', `انتهاء صلاحية ${ex} تقدير/تقديرات`, date)
  }, `التاريخ التجريبي: ${date}`), [run])

  const ctx = { db, version, run, reset, toast, can, user, setRole, setUser, setAsOf }
  // dev-only handle for browser walkthroughs (absent from production builds)
  if (import.meta.env.DEV) (window as unknown as { __maint?: unknown }).__maint = { setUser, setAsOf }

  return (
    <StoreCtx.Provider value={ctx}>
      {children}
      {toastMsg && (
        <div className={`fixed bottom-5 left-5 z-50 max-w-md rounded-md px-4 py-2.5 text-sm text-white shadow-lg ${toastMsg.tone === 'ok' ? 'bg-navy' : 'bg-red-600'}`}>
          {toastMsg.msg}
        </div>
      )}
    </StoreCtx.Provider>
  )
}

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('Maintenance StoreProvider missing')
  return c
}
