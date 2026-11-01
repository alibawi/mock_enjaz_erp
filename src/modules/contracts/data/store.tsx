import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { setToday } from './asof'
import { nowStamp, uid } from './format'
import { applyDueAmendments } from './amendments'
import { generateOccurrences } from './obligations'
import { syncTime } from './lifecycle'
import { sweepBreaches } from './service'
import { autoRenew } from './renewal'
import { can as canRole } from './permissions'
import { seed } from './seed'
import type { AppUser, DB, Perm, RoleId } from './types'

const KEY = 'enki-contracts-mock'
/** Bump whenever the data model or seed changes — stored data with another version is discarded and reseeded. */
export const DATA_VERSION = 11

type Toast = { msg: string; tone: 'ok' | 'err' }

interface Ctx {
  db: DB
  /** Incremented after every successful run(); mockApi hooks use it to refresh. */
  version: number
  /** Applies a mutation to a copy of the DB. If `fn` returns a string it is treated as an error and nothing is saved. */
  run: (fn: (draft: DB) => string | null | void, ok?: string) => boolean
  reset: () => void
  toast: (msg: string, tone?: 'ok' | 'err') => void
  can: (p: Perm) => boolean
  user: AppUser
  setRole: (role: RoleId) => void
  /** Acts as a specific user (role follows the user). */
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
    /* ignore */
  }
  return seed()
}

/** Appends an audit row to a draft DB (call inside run()). */
export function addAudit(d: DB, entity: string, entityId: string, action: string, detail = '') {
  d.audit.push({ id: uid('aud'), at: nowStamp(), userId: d.userId, entity, entityId, action, detail })
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
      /* ignore */
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
      d.userId = u.id; d.role = u.role
    }),
    [run],
  )
  const setAsOf = useCallback((date: string) => run((d) => {
      d.asOf = date
      addAudit(d, 'demo', 'asOf', 'تغيير التاريخ التجريبي', date)
      const n = syncTime(d)
      if (n) addAudit(d, 'demo', 'expiry', `انتهاء ${n} عقد/عقود تلقائياً`, date)
      const am = applyDueAmendments(d)
      if (am) addAudit(d, 'demo', 'amendments', `تطبيق ${am} ملحق/ملاحق عند حلول تاريخ السريان`, date)
      const oc = generateOccurrences(d)
      if (oc) addAudit(d, 'demo', 'occurrences', `توليد ${oc} حدث التزام متكرر`, date)
      const sb = sweepBreaches(d)
      if (sb) addAudit(d, 'demo', 'sla', `تسجيل ${sb} خرق لمستوى الخدمة`, date)
      const rn = autoRenew(d)
      if (rn) addAudit(d, 'demo', 'renewal', `إنشاء ${rn} عقد/عقود تجديد تلقائي`, date)
    }, `التاريخ التجريبي: ${date}`), [run])

  const ctx = { db, version, run, reset, toast, can, user, setRole, setUser, setAsOf }
  // dev-only handle for browser walkthroughs (absent from production builds)
  if (import.meta.env.DEV) (window as unknown as { __mock?: unknown }).__mock = { setUser, setAsOf }

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
  if (!c) throw new Error('StoreProvider missing')
  return c
}
