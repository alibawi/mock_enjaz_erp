import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'

/** Unified filter dropdown used on every list (playbook 0.8). */
export function FilterSelect({ label, value, onChange, options, allLabel = 'الكل' }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; allLabel?: string
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-500">
      <span>{label}</span>
      <span className="relative">
        <select className="inp w-auto min-w-[110px] appearance-none pe-7 text-[13px]" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{allLabel}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute end-2 top-2 h-4 w-4 text-gray-400" />
      </span>
    </label>
  )
}

export interface Option { value: string; label: string; hint?: string }

/** Searchable dropdown (combobox). */
export function SearchableSelect({ value, onChange, options, placeholder = 'اختر...', disabled, clearable = true }: {
  value: string; onChange: (v: string) => void; options: Option[]; placeholder?: string; disabled?: boolean; clearable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const current = options.find((o) => o.value === value)
  const shown = useMemo(() => options.filter((o) => !q || `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60), [options, q])
  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)}
        className="inp flex items-center justify-between gap-2 text-start disabled:opacity-60">
        <span className={`truncate ${current ? '' : 'text-gray-400'}`}>{current?.label ?? placeholder}</span>
        <span className="flex items-center gap-1">
          {clearable && current && !disabled && <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-700" onClick={(e) => { e.stopPropagation(); onChange('') }} />}
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </span>
      </button>
      {open && (
        <div className="absolute start-0 top-9 z-30 w-full min-w-[220px] rounded-md border border-line bg-white shadow-lg">
          <div className="relative border-b border-line p-1.5">
            <Search className="absolute start-3 top-3.5 h-3.5 w-3.5 text-gray-400" />
            <input autoFocus className="inp ps-7" placeholder="بحث..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {shown.length === 0 && <div className="px-3 py-3 text-center text-xs text-gray-400">لا نتائج</div>}
            {shown.map((o) => (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); setQ('') }}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start text-sm hover:bg-gray-50">
                <span className="truncate">{o.label}{o.hint && <span className="ms-2 text-[11px] text-gray-400">{o.hint}</span>}</span>
                {o.value === value && <Check className="h-3.5 w-3.5 text-navy" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

type PickerProps = { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }

export function PartnerSelect({ kind, ...p }: PickerProps & { kind?: 'customer' | 'vendor' }) {
  const { db } = useStore()
  const options = db.partners.filter((x) => !kind || x.kind === kind).map((x) => ({ value: x.id, label: x.name, hint: `${x.code} · ${x.city}` }))
  return <SearchableSelect options={options} placeholder="اختر الطرف" {...p} />
}
export function ItemSelect(p: PickerProps) {
  const { db } = useStore()
  return <SearchableSelect options={db.items.map((x) => ({ value: x.id, label: x.name, hint: x.code }))} placeholder="اختر الصنف" {...p} />
}
export function CategorySelect(p: PickerProps) {
  const { db } = useStore()
  const label = (id: string): string => {
    const c = db.categories.find((x) => x.id === id)!
    return c.parentId ? `${label(c.parentId)} › ${c.name}` : c.name
  }
  return <SearchableSelect options={db.categories.map((x) => ({ value: x.id, label: label(x.id), hint: x.code }))} placeholder="اختر التصنيف" {...p} />
}
export function UserSelect(p: PickerProps) {
  const { db } = useStore()
  return <SearchableSelect options={db.users.map((x) => ({ value: x.id, label: x.name, hint: x.title }))} placeholder="اختر المستخدم" {...p} />
}
export function EmployeeSelect(p: PickerProps) {
  const { db } = useStore()
  return <SearchableSelect options={db.employees.map((x) => ({ value: x.id, label: x.name, hint: x.department }))} placeholder="اختر الموظف" {...p} />
}
export function OrganizationSelect(p: PickerProps) {
  const { db } = useStore()
  return <SearchableSelect options={db.organizations.map((x) => ({ value: x.id, label: x.name }))} placeholder="اختر المنشأة" clearable={false} {...p} />
}

/** Tag / multi-item editor (e.g. reminder days, covered serials). */
export function ChipListEditor({ values, onChange, placeholder = 'أضف عنصراً واضغط Enter', disabled }: {
  values: string[]; onChange: (v: string[]) => void; placeholder?: string; disabled?: boolean
}) {
  const [text, setText] = useState('')
  const add = () => {
    const t = text.trim()
    if (t && !values.includes(t)) onChange([...values, t])
    setText('')
  }
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-md border border-line bg-white p-1">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded bg-navy-50 px-2 py-0.5 text-xs text-navy">
          {v}{!disabled && <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}><X className="h-3 w-3" /></button>}
        </span>
      ))}
      {!disabled && (
        <input className="min-w-[120px] flex-1 border-0 bg-transparent px-1 text-sm outline-none" placeholder={placeholder} value={text}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} onBlur={add} />
      )}
    </div>
  )
}

export function DateInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return <input type="date" className="inp" dir="ltr" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
}
