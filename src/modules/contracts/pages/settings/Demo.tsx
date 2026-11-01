import { CalendarPlus, RotateCcw, ZapOff } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/Layout'
import { Card, Confirm } from '../../components/ui'
import { DEFAULT_TODAY, addDays, addMonths } from '../../data/asof'
import { fmtDate } from '../../data/format'
import { DATA_VERSION, useStore } from '../../data/store'
import { NoAccess } from './Settings'

/** X7 — demo controls: demo "today", reset of the demo data, server-error simulation. */
export default function Demo() {
  const { db, run, reset, toast, setAsOf, can } = useStore()
  const [confirm, setConfirm] = useState(false)
  if (!can('Settings.Manage')) return <div><PageHeader crumbs={[{ label: 'الإعدادات' }, { label: 'أدوات العرض' }]} title="أدوات العرض" /><NoAccess /></div>
  const step = [['+1 يوم', () => addDays(db.asOf, 1)], ['+1 أسبوع', () => addDays(db.asOf, 7)], ['+1 شهر', () => addMonths(db.asOf, 1)], ['+3 أشهر', () => addMonths(db.asOf, 3)]] as const
  const size = (() => { try { return Math.round(JSON.stringify(db).length / 1024) } catch { return 0 } })()
  return (
    <div>
      <PageHeader crumbs={[{ label: 'الإعدادات', to: '/settings' }, { label: 'أدوات العرض' }]} title="أدوات العرض" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="اليوم التجريبي">
          <p className="mb-2 text-sm">اليوم الحالي: <b>{fmtDate(db.asOf)}</b></p>
          <p className="mb-3 text-xs text-gray-500">تقدّم التاريخ ينتهي العقود، ويفعّل الموقّعة، ويطبّق الملاحق المستحقة، وينشئ التجديد التلقائي وأحداث الالتزامات، ويسجّل خروقات SLA.</p>
          <div className="mb-3 flex flex-wrap gap-2">{step.map(([l, f]) => <button key={l} type="button" className="btn" onClick={() => setAsOf(f())}><CalendarPlus className="h-4 w-4" />{l}</button>)}</div>
          <div className="flex items-center gap-2"><input type="date" dir="ltr" className="inp w-44" value={db.asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} />
            <button type="button" className="btn" onClick={() => setAsOf(DEFAULT_TODAY)}>العودة إلى {fmtDate(DEFAULT_TODAY)}</button></div>
          <p className="mt-2 text-[11px] text-gray-400">الرجوع بالتاريخ لا يتراجع عن نتائج ما حدث عند التقدّم؛ استخدم إعادة التعيين للبدء من جديد.</p>
        </Card>
        <Card title="البيانات والأخطاء">
          <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm"><dt className="text-gray-500">إصدار البيانات</dt><dd dir="ltr" className="text-end">v{DATA_VERSION}</dd><dt className="text-gray-500">حجم البيانات المحلية</dt><dd className="text-end tabular-nums">{size} KB</dd>
            <dt className="text-gray-500">محاكاة خطأ الخادم</dt><dd className="text-end">{db.simulateError ? 'مفعّلة' : 'متوقفة'}</dd></dl>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => run((d) => { d.simulateError = !d.simulateError }, db.simulateError ? 'تم إيقاف محاكاة الخطأ' : 'محاكاة خطأ الخادم مفعّلة — أعد فتح أي قائمة')}><ZapOff className="h-4 w-4" />{db.simulateError ? 'إيقاف محاكاة الخطأ' : 'محاكاة خطأ في الخادم'}</button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirm(true)}><RotateCcw className="h-4 w-4" />إعادة تعيين البيانات التجريبية</button>
          </div>
        </Card>
      </div>
      {confirm && <Confirm title="إعادة تعيين البيانات" text="ستُمسح كل التغييرات وتعود البيانات التجريبية إلى حالتها الأولى." danger onClose={() => setConfirm(false)} onYes={() => { reset(); toast('تمت إعادة تعيين البيانات التجريبية'); window.location.hash = '#/' }} />}
    </div>
  )
}
