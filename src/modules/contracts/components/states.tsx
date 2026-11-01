import { AlertTriangle, Inbox, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'

export const EmptyBlock = ({ title = 'لا توجد بيانات', hint, action }: { title?: string; hint?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 py-12 text-center">
    <Inbox className="h-9 w-9 text-gray-300" />
    <div className="text-sm font-medium text-gray-600">{title}</div>
    {hint && <div className="max-w-sm text-xs text-gray-400">{hint}</div>}
    {action}
  </div>
)

export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="flex flex-col items-center gap-2 py-12 text-center">
    <AlertTriangle className="h-9 w-9 text-red-400" />
    <div className="text-sm font-medium text-red-700">{message}</div>
    {onRetry && <button type="button" className="btn mt-1" onClick={onRetry}><RotateCw className="h-4 w-4" />إعادة المحاولة</button>}
  </div>
)

export function LoadingSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse p-4" aria-busy="true">
      <div className="mb-3 h-4 w-1/4 rounded bg-gray-200" />
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="mb-2 flex gap-3">
          {Array.from({ length: cols }).map((__, c) => <div key={c} className="h-5 flex-1 rounded bg-gray-100" />)}
        </div>
      ))}
    </div>
  )
}

/** Renders loading / error / content from a useApi state. */
export function Async<T>({ state, children, skeleton }: {
  state: { data: T | undefined; loading: boolean; error: string | null; reload: () => void }
  children: (data: T) => ReactNode
  skeleton?: ReactNode
}) {
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />
  if (state.loading || state.data === undefined) return <>{skeleton ?? <LoadingSkeleton />}</>
  return <>{children(state.data)}</>
}
