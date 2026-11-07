import { ArrowRight, Printer } from 'lucide-react'
import { PrintSheet } from '../../components/board'
import { EmptyBlock } from '../../components/states'
import { lineTotal, totals } from '../../data/estimate'
import { coverageLabel, fmtDate, iqd, lineKindLabel, num } from '../../data/format'
import { useStore } from '../../data/store'
import { Link, useParams } from '../../router'

/** Printable repair quotation with the customer approval box (rule 4: acceptance is separate from internal approval). */
export default function EstimatePrint() {
  const { id } = useParams()
  const { db } = useStore()
  const e = db.estimates.find((x) => x.id === id)
  if (!e) return <EmptyBlock title="التقدير غير موجود" action={<Link to="/estimates" className="btn">العودة</Link>} />
  const asset = db.assets.find((a) => a.id === e.assetId)
  const v = db.vehicles.find((x) => x.assetId === e.assetId)
  const partner = db.partners.find((p) => p.id === e.partnerId)
  const t = totals(db, e)
  const draft = !['approved'].includes(e.status)

  return (
    <div>
      <div className="no-print mb-3 flex items-center justify-between">
        <Link to={`/estimates/${e.id}`} className="btn"><ArrowRight className="h-4 w-4" />العودة إلى التقدير</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" />طباعة</button>
      </div>
      <PrintSheet title="عرض سعر إصلاح" number={`${e.number} / v${e.version}`} date={db.asOf}
        footer={
          <div className="text-[12px]">
            <div className="mb-2 font-bold text-navy">موافقة العميل</div>
            <div className="grid grid-cols-3 gap-6">
              <div>☐ أوافق على العرض أعلاه</div><div>☐ لا أوافق</div><div>التاريخ: ____ / ____ / ________</div>
              <div className="col-span-2"><div className="text-gray-500">اسم العميل وتوقيعه</div><div className="mt-8 border-t border-gray-400" /></div>
              <div><div className="text-gray-500">ختم المركز</div><div className="mt-8 border-t border-gray-400" /></div>
            </div>
          </div>
        }>
        {draft && <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-center text-[12px] font-semibold text-amber-800">مسودة — غير معتمدة داخليًا بعد</div>}
        <div className="mb-4 grid grid-cols-2 gap-x-8 text-[12px]">
          <div><span className="text-gray-500">العميل: </span><b>{partner?.name}</b> — <span dir="ltr">{partner?.phone}</span></div>
          <div><span className="text-gray-500">الأصل: </span><b>{asset?.name}</b>{v ? ` — ${v.plate}` : asset?.serial ? ` — ${asset.serial}` : ''}</div>
          <div><span className="text-gray-500">صالح حتى: </span><b>{fmtDate(e.validUntil)}</b></div>
          <div><span className="text-gray-500">الضمان حتى: </span>{fmtDate(asset?.warrantyEnd)}</div>
        </div>
        <table className="w-full border-collapse text-[12px]">
          <thead><tr className="bg-gray-100"><th className="border border-gray-300 px-2 py-1 text-start">#</th><th className="border border-gray-300 px-2 py-1 text-start">البند</th><th className="border border-gray-300 px-2 py-1">النوع</th><th className="border border-gray-300 px-2 py-1">الكمية</th><th className="border border-gray-300 px-2 py-1">السعر</th><th className="border border-gray-300 px-2 py-1">خصم</th><th className="border border-gray-300 px-2 py-1">التغطية</th><th className="border border-gray-300 px-2 py-1">المجموع</th></tr></thead>
          <tbody>
            {e.lines.map((l, i) => (
              <tr key={l.id}>
                <td className="border border-gray-300 px-2 py-1">{i + 1}</td>
                <td className="border border-gray-300 px-2 py-1">{db.items.find((x) => x.id === l.itemId)?.name}</td>
                <td className="border border-gray-300 px-2 py-1 text-center">{lineKindLabel[l.kind]}</td>
                <td className="border border-gray-300 px-2 py-1 text-center tabular-nums">{num(l.qty, l.qty % 1 ? 1 : 0)}</td>
                <td className="border border-gray-300 px-2 py-1 text-end tabular-nums">{iqd(l.price)}</td>
                <td className="border border-gray-300 px-2 py-1 text-center">{l.discountPct ? `${l.discountPct}%` : '—'}</td>
                <td className="border border-gray-300 px-2 py-1 text-center">{coverageLabel[l.coverage]}</td>
                <td className="border border-gray-300 px-2 py-1 text-end tabular-nums">{l.coverage === 'paid' ? iqd(lineTotal(l)) : `0 (${iqd(lineTotal(l))})`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ms-auto mt-3 w-72 space-y-1 text-[12px]">
          <div className="flex justify-between"><span>الإجمالي</span><span className="tabular-nums">{iqd(t.gross)}</span></div>
          {t.warranty > 0 && <div className="flex justify-between text-sky-700"><span>يغطيه الضمان</span><span className="tabular-nums">-{iqd(t.warranty)}</span></div>}
          {t.goodwill > 0 && <div className="flex justify-between text-amber-700"><span>مجاني (حسن نية)</span><span className="tabular-nums">-{iqd(t.goodwill)}</span></div>}
          <div className="flex justify-between border-t border-gray-400 pt-1 text-sm font-bold"><span>المطلوب من العميل</span><span className="tabular-nums">{iqd(t.billable)}</span></div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-gray-600">الأسعار تقديرية؛ تُحتسب الفاتورة على القطع المستهلكة فعلًا والساعات المنفذة. قد يُطلب عربون قبل البدء. ينتهي العرض في تاريخ صلاحيته ويحتاج بعدها إلى تحديث.</p>
      </PrintSheet>
    </div>
  )
}
