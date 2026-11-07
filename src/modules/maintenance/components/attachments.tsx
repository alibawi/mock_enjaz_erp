import { Download, FileText, Paperclip, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { fmtDateTime } from '../data/format'

/** Mock attachment record (no real upload: only name, size and type are kept). */
export interface MockAttachment {
  id: string; ownerType: string; ownerId: string; subType: 'Photo' | 'Report' | 'Signature' | 'Other'
  fileName: string; size: number; contentType: string; uploadedBy: string; uploadedAt: string; version: number
}
export const subTypeLabel: Record<MockAttachment['subType'], string> = { Photo: 'صورة', Report: 'تقرير فحص', Signature: 'توقيع العميل', Other: 'أخرى' }
const size = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/** Choose a local file and report its metadata only. */
export function AttachmentUploader({ onPick, disabled, label = 'رفع مرفق' }: {
  onPick: (f: { fileName: string; size: number; contentType: string }) => void; disabled?: boolean; label?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={ref} type="file" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) onPick({ fileName: f.name, size: f.size, contentType: f.type || 'application/octet-stream' })
        e.target.value = ''
      }} />
      <button type="button" disabled={disabled} className="btn" onClick={() => ref.current?.click()}><Upload className="h-4 w-4" />{label}</button>
    </>
  )
}

export function AttachmentList({ items, onPreview, onDelete, canDownload = true, canDelete = false }: {
  items: MockAttachment[]; onPreview?: (a: MockAttachment) => void; onDelete?: (a: MockAttachment) => void; canDownload?: boolean; canDelete?: boolean
}) {
  if (!items.length) return <div className="flex flex-col items-center gap-1 py-8 text-sm text-gray-400"><Paperclip className="h-6 w-6" />لا توجد مرفقات</div>
  return (
    <ul className="divide-y divide-gray-100">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-3 py-2">
          <FileText className="h-5 w-5 shrink-0 text-gray-400" />
          <button type="button" className="min-w-0 flex-1 text-start" onClick={() => onPreview?.(a)}>
            <div className="truncate text-sm font-medium text-gray-900" dir="auto">{a.fileName}</div>
            <div className="text-[11px] text-gray-400">{subTypeLabel[a.subType]} · نسخة {a.version} · {size(a.size)} · {a.uploadedBy} · {fmtDateTime(a.uploadedAt)}</div>
          </button>
          {canDownload && <button type="button" className="rounded p-1.5 text-gray-400 hover:bg-gray-100" title="تنزيل (محاكاة)"><Download className="h-4 w-4" /></button>}
          {canDelete && <button type="button" className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => onDelete?.(a)} title="حذف"><Trash2 className="h-4 w-4" /></button>}
        </li>
      ))}
    </ul>
  )
}
