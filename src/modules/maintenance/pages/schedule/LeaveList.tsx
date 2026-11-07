import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { DataTable } from '../../components/DataTable'
import { TechnicianSelect } from '../../components/inputs'
import { PageHeader } from '../../components/Layout'
import { ErrorState, LoadingSkeleton } from '../../components/states'
import { Badge, Card, Field, FormGrid, Modal } from '../../components/ui'
import { diffDays, today } from '../../data/asof'
import { fmtDate, uid } from '../../data/format'
import { addLeave, removeLeave } from '../../data/schedule'
import { useStore } from '../../data/store'
import { useApi } from '../../lib/useApi'

/** Technician leave (S16): imported from HR (read-only here) plus short manual absences; blocks booking on the board. */
export default function LeaveList() {
  const { db, run, can } = useStore()
  const [dlg, setDlg] = useState<{ technicianId: string; from: string; to: string; note: string } | null>(null)
  const api = useApi(() => db.leaves, [])
  if (api.error) return <ErrorState message={api.error} onRetry={api.reload} />
  if (api.loading) return <LoadingSkeleton />
  const rows = [...(api.data ?? [])].sort((a, b) => b.from.localeCompare(a.from))
  const state = (from: string, to: string) => (to < today() ? <Badge tone="gray">منتهية</Badge> : from <= today() ? <Badge tone="amber">جارية</Badge> : <Badge tone="blue">قادمة</Badge>)

  return (
    <div>
      <PageHeader crumbs={[{ label: 'الجدولة', to: '/schedule' }, { label: 'إجازات الفنيين' }]} title="إجازات الفنيين"
        actions={can('Schedule.Manage') && <button type="button" className="btn btn-primary" onClick={() => setDlg({ technicianId: '', from: today(), to: today(), note: '' })}><Plus className="h-4 w-4" />غياب يدوي</button>} />
      <p className="mb-3 text-sm text-gray-600">الإجازات المعتمدة تُستورد من الموارد البشرية ولا تُعدَّل هنا. الغياب اليدوي القصير يسجله المنسق، ويُمنع الحجز على أيام الإجازة في لوحة الجدولة.</p>
      <Card pad={false}>
        <DataTable rows={rows} emptyTitle="لا توجد إجازات" columns={[
          { key: 't', label: 'الفني', render: (l) => db.technicians.find((t) => t.id === l.technicianId)?.name },
          { key: 'f', label: 'من', render: (l) => fmtDate(l.from), sort: (l) => l.from },
          { key: 'to', label: 'إلى', render: (l) => fmtDate(l.to) },
          { key: 'n', label: 'الأيام', num: true, render: (l) => diffDays(l.to, l.from) + 1 },
          { key: 's', label: 'المصدر', render: (l) => (l.source === 'hr' ? <Badge tone="blue">مستورد من الموارد البشرية</Badge> : <Badge tone="gray">يدوي</Badge>) },
          { key: 'st', label: 'الحالة', render: (l) => state(l.from, l.to) },
          { key: 'note', label: 'ملاحظة', render: (l) => l.note },
          { key: 'x', label: '', render: (l) => (l.source === 'manual' && can('Schedule.Manage') ? <button type="button" className="rounded p-1 text-gray-400 hover:text-red-600" onClick={() => run((d) => removeLeave(d, l.id), 'حُذف الغياب')}><Trash2 className="h-4 w-4" /></button> : null) },
        ]} />
      </Card>
      {dlg && (
        <Modal title="غياب يدوي" onClose={() => setDlg(null)} footer={<><button type="button" className="btn" onClick={() => setDlg(null)}>تراجع</button><button type="button" className="btn btn-primary" onClick={() => run((d) => addLeave(d, dlg, uid('lv')), 'سُجّل الغياب') && setDlg(null)}>حفظ</button></>}>
          <FormGrid>
            <Field label="الفني" required span={3}><TechnicianSelect value={dlg.technicianId} onChange={(v) => setDlg({ ...dlg, technicianId: v })} /></Field>
            <Field label="من"><input type="date" className="inp" value={dlg.from} onChange={(e) => setDlg({ ...dlg, from: e.target.value })} /></Field>
            <Field label="إلى"><input type="date" className="inp" value={dlg.to} onChange={(e) => setDlg({ ...dlg, to: e.target.value })} /></Field>
            <Field label="ملاحظة" span={3}><input className="inp" value={dlg.note} onChange={(e) => setDlg({ ...dlg, note: e.target.value })} /></Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  )
}
