import { useEffect, useRef } from 'react'
import { EmptyBlock } from '../../components/states'
import { LoadingSkeleton } from '../../components/states'
import { createEstimate } from '../../data/estimate'
import { uid } from '../../data/format'
import { useStore } from '../../data/store'
import { Link, useNavigate, useSearchParams } from '../../router'

/** `/estimates/new?request=…` creates the draft estimate once and opens its card (lines are edited there). */
export default function EstimateNew() {
  const { run, can } = useStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const requestId = params.get('request') ?? ''
  const done = useRef(false)

  useEffect(() => {
    if (done.current || !requestId || !can('Estimates.Create')) return
    done.current = true // StrictMode runs effects twice in dev
    const id = uid('es')
    if (run((d) => createEstimate(d, requestId, id), 'تم إنشاء مسودة التقدير')) nav(`/estimates/${id}`, { replace: true })
    else nav(`/requests/${requestId}`, { replace: true })
  }, [requestId, can, run, nav])

  if (!requestId) return <EmptyBlock title="يُعدّ التقدير من طلب صيانة" hint="افتح الطلب واختر «إعداد التقدير»." action={<Link to="/requests" className="btn">الطلبات</Link>} />
  if (!can('Estimates.Create')) return <EmptyBlock title="لا تملك صلاحية إعداد التقديرات" />
  return <LoadingSkeleton rows={3} />
}
