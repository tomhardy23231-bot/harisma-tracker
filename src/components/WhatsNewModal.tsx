'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Sparkles, Wand2, Pencil, Calendar, Hash, ShieldAlert, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const CHANGELOG_VERSION = '2026-05-10'
const STORAGE_KEY = 'harisma-changelog-seen'

const changes = [
  {
    icon: Wand2,
    tone: 'bg-violet-100 text-violet-700',
    title: 'Автозаполнение из CRM',
    description: 'Вставь ID сделки — ткань, модель и модули подтянутся сами. Если ткань не указана в CRM — увидишь комментарий, чтобы выписать её вручную.',
  },
  {
    icon: Pencil,
    tone: 'bg-blue-100 text-blue-700',
    title: 'Редактирование прямо в карточке заказа',
    description: 'Открой заказ → нажми «Редактировать». Можно менять ткань, метраж, модель, модули и оба комментария.',
  },
  {
    icon: Calendar,
    tone: 'bg-emerald-100 text-emerald-700',
    title: 'Фильтр по дате в архиве',
    description: 'По умолчанию показывается текущий месяц. Видно количество за период и всего в архиве.',
  },
  {
    icon: Hash,
    tone: 'bg-amber-100 text-amber-700',
    title: 'Счётчики в навигации',
    description: 'Возле каждой вкладки — бейдж со сколько сейчас заказов в этом статусе.',
  },
  {
    icon: ShieldAlert,
    tone: 'bg-red-100 text-red-700',
    title: 'Подтверждение удаления',
    description: 'Случайно удалить заказ больше нельзя — теперь сначала диалог подтверждения.',
  },
]

export function WhatsNewModal() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (seen !== CHANGELOG_VERSION) setOpen(true)
    } catch {
      /* localStorage недоступен — просто не показываем */
    }
  }, [])

  const handleClose = () => {
    try { localStorage.setItem(STORAGE_KEY, CHANGELOG_VERSION) } catch { /* ignore */ }
    setOpen(false)
  }

  if (!mounted) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden bg-slate-100 border-slate-300 max-w-full w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl rounded-none sm:rounded-2xl"
      >
        {/* Header */}
        <DialogHeader className="px-6 py-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 ring-1 ring-white/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-[10px] uppercase tracking-widest font-semibold opacity-70 text-left">
                Обновление · {CHANGELOG_VERSION}
              </p>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-left">
                Что нового в HARISMA
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-300 text-left pt-0.5">
                Несколько изменений, которые сделают работу удобнее
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {changes.map((c, i) => {
            const Icon = c.icon
            return (
              <div
                key={i}
                className="flex gap-3 p-3 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", c.tone)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 leading-tight">{c.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{c.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-200 border-t border-slate-300 shrink-0">
          <Button
            onClick={handleClose}
            className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-base font-semibold gap-2"
          >
            Понятно, начать работу
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
