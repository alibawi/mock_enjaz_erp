import { ClipboardList, FileSignature, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ASSETS_BASE } from '../modules/assets/router'
import { CONTRACTS_BASE } from '../modules/contracts/router'

const modules: { to: string; title: string; text: string; icon: LucideIcon }[] = [
  { to: ASSETS_BASE, title: 'الموجودات الثابتة', text: 'سجل الأصول، الإهلاك، إعادة التقييم، النقل والاستبعاد، الصيانة والتقارير.', icon: ClipboardList },
  { to: CONTRACTS_BASE, title: 'إدارة العقود', text: 'العقود والاتفاقيات، الملاحق والتجديد، الالتزامات والدفعات، القوالب والاعتماد.', icon: FileSignature },
]

export default function Hub() {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center border-b border-line bg-white px-4">
        <h1 className="text-base font-bold text-navy">الصفحة الرئيسية</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-5">
        <p className="mb-4 text-gray-500">اختر الوحدة التي تريد استعراضها في النموذج التجريبي.</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ to, title, text, icon: Icon }) => (
            <Link key={to} to={to} className="card flex gap-3 p-4 transition hover:border-navy hover:shadow-sm">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-navy-50 text-navy"><Icon className="h-5 w-5" /></div>
              <div>
                <div className="font-semibold text-navy">{title}</div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{text}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  )
}
