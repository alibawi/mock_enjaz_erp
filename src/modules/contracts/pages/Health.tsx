import { CheckCircle2, XCircle } from 'lucide-react'
import { PageHeader } from '../components/Layout'
import { Async } from '../components/states'
import { Card } from '../components/ui'
import { checkFoundation } from '../data/integrity'
import { today } from '../data/asof'
import { fmtDate } from '../data/format'
import { roleLabel } from '../data/permissions'
import { DATA_VERSION, useStore } from '../data/store'
import { useApi } from '../lib/useApi'

/** Smoke screen (foundation step 0.9): exercises the mock API (latency, error simulation) and the integrity checks. */
export default function Health() {
  const { db, can } = useStore()
  const state = useApi(() => ({ problems: checkFoundation(db), counts: {
    'المنشآت': db.organizations.length, 'المستخدمون': db.users.length, 'الأطراف': db.partners.length, 'الأصناف': db.items.length,
    'التصنيفات': db.categories.length, 'الإعدادات': Object.keys(db.settings).length, 'سجلات التدقيق': db.audit.length,
  } }))

  return (
    <div>
      <PageHeader crumbs={[{ label: 'فحص النظام' }]} title="فحص النظام" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="الحالة العامة">
          <Async state={state}>
            {({ problems, counts }) => (
              <div className="space-y-3 text-sm">
                <div className={`flex items-center gap-2 font-semibold ${problems.length ? 'text-red-600' : 'text-emerald-700'}`}>
                  {problems.length ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                  {problems.length ? `${problems.length} مشكلة في سلامة البيانات` : 'سلامة البيانات الأساسية: سليمة'}
                </div>
                {problems.map((p) => <div key={p} className="text-xs text-red-600" dir="ltr">{p}</div>)}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(counts).map(([k, v]) => <div key={k} className="contents"><dt className="text-gray-500">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>)}
                </dl>
              </div>
            )}
          </Async>
        </Card>
        <Card title="السياق الحالي">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-gray-500">الدور</dt><dd className="font-semibold">{roleLabel[db.role]}</dd>
            <dt className="text-gray-500">المستخدم</dt><dd>{db.users.find((u) => u.id === db.userId)?.name}</dd>
            <dt className="text-gray-500">اليوم التجريبي</dt><dd>{fmtDate(today())}</dd>
            <dt className="text-gray-500">إصدار البيانات</dt><dd dir="ltr" className="text-end">v{DATA_VERSION}</dd>
            <dt className="text-gray-500">محاكاة الخطأ</dt><dd>{db.simulateError ? 'مفعّلة' : 'متوقفة'}</dd>
            <dt className="text-gray-500">صلاحية «إدارة الإعدادات»</dt><dd>{can('Settings.Manage') ? 'نعم' : 'لا'}</dd>
          </dl>
          <p className="mt-3 text-xs text-gray-400">بدّل الدور أو التاريخ من الشريط العلوي، أو فعّل «محاكاة خطأ في الخادم» ثم أعد فتح هذه الشاشة لترى حالة الخطأ وزر إعادة المحاولة.</p>
        </Card>
      </div>
    </div>
  )
}
