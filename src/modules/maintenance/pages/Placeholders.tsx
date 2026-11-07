import { Construction, Sparkles } from 'lucide-react'
import { PageHeader, maintenanceNav } from '../components/Layout'
import { Card } from '../components/ui'
import { useLocation } from '../router'

/** Route exists (menu works) but the screen is built in a later prompt — see docs/maintenance/prompts-maintenance.md. */
export function Pending({ screen, area }: { screen: string; area: string }) {
  const { pathname } = useLocation()
  const title = maintenanceNav.find((n) => n.to === pathname)?.label ?? screen
  return (
    <div>
      <PageHeader crumbs={[{ label: title }]} title={title} />
      <Card>
        <div className="flex items-start gap-3 py-6">
          <Construction className="h-6 w-6 shrink-0 text-amber-500" />
          <div>
            <div className="font-semibold text-gray-800">هذه الشاشة قيد البناء</div>
            <p className="mt-1 text-sm text-gray-500">الشاشة <span className="font-mono" dir="ltr">{screen}</span> تُبنى في مرحلة «{area}» من خطة بناء النموذج.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

const soonText: Record<string, { title: string; text: string }> = {
  pm: { title: 'الصيانة الوقائية', text: 'خطط الصيانة الدورية حسب التاريخ أو العداد، وتوليد أوامر عمل تذهب إلى قائمة "بانتظار الجدولة" (المرحلة P10 من الخطة).' },
  coverage: { title: 'تغطية عقود الخدمة', text: 'قراءة تغطية الأصل من عقود الخدمة (عمالة مجانية، خصم على القطع) عبر عقد قراءة من وحدة العقود — بعد بناء وحدة العقود.' },
  board: { title: 'لوحة السحب والإفلات', text: 'لوحة تقويم موحدة في وحدة الجدولة لنقل الحجوزات بالسحب (SC8، المرحلة P12).' },
  skills: { title: 'مهارات الفنيين', text: 'جدول مهارات وربطها بالفنيين واقتراح الفني المؤهل عند الحجز (SC4، لاحقًا).' },
}

export function ComingSoon() {
  const { pathname } = useLocation()
  const s = soonText[pathname.split('/').pop() ?? ''] ?? { title: 'قريباً', text: '' }
  return (
    <div>
      <PageHeader crumbs={[{ label: s.title }]} title={s.title} />
      <Card>
        <div className="flex items-start gap-3 py-6">
          <Sparkles className="h-6 w-6 shrink-0 text-sky-500" />
          <div>
            <div className="font-semibold text-gray-800">قريباً — خارج النسخة الأولى</div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500">{s.text}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
