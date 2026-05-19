'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Inbox,
  RefreshCcw,
  ArrowRight,
  EyeOff,
  Package,
  Ruler,
  Sofa,
  Layers,
  MessageSquare,
  Hash,
  MoreHorizontal,
  FileText,
  Search,
  Save,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface UnsortedDeal {
  id: string
  crmId: number
  crmTitle: string
  crmComment: string | null
  funnelId: number
  funnelTitle: string | null
  stageId: number | null
  stageName: string | null
  fabric: string | null
  model: string | null
  modules: string | null
  orderNumber: string | null
  importedAt: string
  updatedAt: string
}

interface DraftValues {
  fabric: string
  meters: string
  model: string
  modules: string
  crmComment: string
}

interface SyncResult {
  fetchedFromCrm: number
  imported: number
  updated: number
  skippedInFabric: number
  skippedDecided: number
  cleanedArchived: number
  archivedSeenInCrm: number
  mode: 'full' | 'incremental'
}

export default function UnsortedDealsPage() {
  const qc = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [opened, setOpened] = useState<UnsortedDeal | null>(null)
  const [draft, setDraft] = useState<DraftValues>({ fabric: '', meters: '', model: '', modules: '', crmComment: '' })
  const [dismissCandidate, setDismissCandidate] = useState<UnsortedDeal | null>(null)
  const [lastSync, setLastSync] = useState<SyncResult | null>(null)

  const { data: deals = [], isLoading } = useQuery<UnsortedDeal[]>({
    queryKey: ['unsorted-deals'],
    queryFn: async () => {
      const r = await fetch('/api/unsorted')
      if (!r.ok) throw new Error('Failed to fetch unsorted')
      return r.json()
    },
  })

  // При открытии модалки — инициализируем драфт текущими CRM-значениями.
  useEffect(() => {
    if (opened) {
      setDraft({
        fabric: opened.fabric ?? '',
        meters: '',
        model: opened.model ?? '',
        modules: opened.modules ?? '',
        crmComment: opened.crmComment ?? '',
      })
    }
  }, [opened?.id])

  // Изменилось ли что-то относительно текущих данных в БД (метраж сюда не входит —
  // он не хранится в UnsortedDeal, только для promote).
  const hasUnsavedChanges = !!opened && (
    draft.fabric.trim() !== (opened.fabric ?? '') ||
    draft.model.trim() !== (opened.model ?? '') ||
    draft.modules.trim() !== (opened.modules ?? '') ||
    draft.crmComment !== (opened.crmComment ?? '')
  )

  const syncMutation = useMutation({
    mutationFn: async (force: boolean) => {
      const r = await fetch('/api/unsorted/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.error || 'Sync failed')
      }
      return (await r.json()) as SyncResult
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['unsorted-deals'] })
      qc.invalidateQueries({ queryKey: ['fabric-orders'] })
      setLastSync(data)
      const parts: string[] = []
      if (data.imported) parts.push(`новых: ${data.imported}`)
      if (data.updated) parts.push(`обновлено: ${data.updated}`)
      if (data.cleanedArchived) parts.push(`убрано архивных: ${data.cleanedArchived}`)
      if (data.skippedInFabric) parts.push(`уже в трекере: ${data.skippedInFabric}`)
      if (data.skippedDecided) parts.push(`скрыто/переведено ранее: ${data.skippedDecided}`)
      toast.success(`🔄 Импорт (${data.mode}) — активных ${data.fetchedFromCrm}, архивных ${data.archivedSeenInCrm}. ${parts.join(', ') || 'Без изменений.'}`)
    },
    onError: (err: Error) => {
      toast.error(`Ошибка импорта: ${err.message}`)
    },
  })

  const promoteMutation = useMutation({
    mutationFn: async () => {
      if (!opened) throw new Error('No deal')
      const r = await fetch(`/api/unsorted/${opened.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fabricName: draft.fabric.trim(),
          meters: parseFloat(draft.meters),
          model: draft.model.trim() || null,
          modules: draft.modules.trim() || null,
        }),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.error || 'Promote failed')
      }
      return r.json()
    },
    onSuccess: (fabricOrder: any) => {
      qc.invalidateQueries({ queryKey: ['unsorted-deals'] })
      qc.invalidateQueries({ queryKey: ['fabric-orders'] })
      setOpened(null)
      toast.success(`✨ #${fabricOrder.orderNumber} переведён в "Нужно заказать"`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!opened) throw new Error('No deal')
      const r = await fetch(`/api/unsorted/${opened.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fabric: draft.fabric.trim() || null,
          model: draft.model.trim() || null,
          modules: draft.modules.trim() || null,
          crmComment: draft.crmComment.trim() || null,
        }),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.error || 'Save failed')
      }
      return (await r.json()) as UnsortedDeal
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['unsorted-deals'] })
      setOpened(updated)
      toast.success('💾 Сохранено и отправлено в CRM')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/unsorted/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.error || 'Dismiss failed')
      }
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unsorted-deals'] })
      setOpened(null)
      toast.success('🙈 Скрыто. Не появится при следующем импорте.')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const search = searchQuery.toLowerCase().trim()
  const filtered = deals
    .filter((d) => {
      if (!search) return true
      return (
        (d.orderNumber ?? '').toLowerCase().includes(search) ||
        String(d.crmId).includes(search) ||
        d.crmTitle.toLowerCase().includes(search) ||
        (d.fabric ?? '').toLowerCase().includes(search) ||
        (d.crmComment ?? '').toLowerCase().includes(search)
      )
    })
    .sort((a, b) => {
      const an = parseInt(a.orderNumber || String(a.crmId), 10)
      const bn = parseInt(b.orderNumber || String(b.crmId), 10)
      return (isNaN(bn) ? 0 : bn) - (isNaN(an) ? 0 : an)
    })

  const getFunnelBadge = (funnelId: number) => (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] uppercase tracking-wider font-semibold",
        funnelId === 8
          ? "border-violet-300 text-violet-700 bg-violet-50"
          : "border-emerald-300 text-emerald-700 bg-emerald-50"
      )}
    >
      Воронка {funnelId}
    </Badge>
  )

  // Цветовая идентификация по воронке: толстая полоса слева + hover-tint.
  // Сам фон карточки — белый, чтобы карточки чётко отделялись от серой подложки страницы.
  const funnelStripe = (funnelId: number) =>
    funnelId === 8 ? "before:bg-violet-500" : "before:bg-emerald-500"

  const funnelHover = (funnelId: number) =>
    funnelId === 8 ? "hover:bg-violet-50" : "hover:bg-emerald-50"

  const canPromote = draft.fabric.trim().length > 0 && parseFloat(draft.meters) > 0

  return (
    <div className="space-y-4">
      {/* Шапка */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            Не разобранные
            <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-mono">
              {filtered.length}
              {filtered.length !== deals.length && (
                <span className="text-slate-400 ml-1">/ {deals.length}</span>
              )}
            </Badge>
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full md:w-auto md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Поиск по №, ткани, заголовку…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-full md:w-[260px]"
              />
            </div>
            <Button
              onClick={() => syncMutation.mutate(false)}
              disabled={syncMutation.isPending}
              className="h-9 bg-slate-900 hover:bg-slate-800 gap-2"
            >
              <RefreshCcw className={cn("w-4 h-4", syncMutation.isPending && "animate-spin")} />
              {syncMutation.isPending ? 'Импортирую…' : 'Импорт из CRM'}
            </Button>
          </div>
        </div>

        {lastSync && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
            <SyncStat label="новых" value={lastSync.imported} tone={lastSync.imported > 0 ? 'good' : undefined} />
            <SyncStat label="обновлено" value={lastSync.updated} />
            <SyncStat label="убрано архивных" value={lastSync.cleanedArchived} tone={lastSync.cleanedArchived > 0 ? 'good' : undefined} />
            <SyncStat label="уже в трекере" value={lastSync.skippedInFabric} />
          </div>
        )}
      </div>

      {/* Список */}
      {isLoading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          hasSearch={search.length > 0}
          onSync={() => syncMutation.mutate(false)}
          syncing={syncMutation.isPending}
        />
      ) : (
        <>
          {/* Desktop таблица */}
          <div className="hidden md:block">
            <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-[100px_minmax(0,1fr)_220px_160px_140px_180px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <div>№ Заказа</div>
                <div>Сделка</div>
                <div>Ткань из CRM</div>
                <div>Модель</div>
                <div>Воронка</div>
                <div className="text-right">Действия</div>
              </div>
            </div>
            <div className="space-y-2 mt-2">
              <AnimatePresence mode="popLayout">
                {filtered.map((deal) => (
                  <motion.div
                    layout
                    key={deal.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "relative grid grid-cols-[100px_minmax(0,1fr)_220px_160px_140px_180px] gap-2 items-center",
                      "pl-5 pr-4 py-3 rounded-lg border bg-white shadow-md cursor-pointer transition-all",
                      "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1.5 before:rounded-l-lg",
                      funnelStripe(deal.funnelId),
                      funnelHover(deal.funnelId),
                      "border-slate-200 hover:border-slate-300 hover:shadow-lg",
                      !deal.fabric && "ring-1 ring-amber-200"
                    )}
                    onClick={() => setOpened(deal)}
                  >
                    <div className="font-semibold text-slate-900 tabular-nums">
                      {deal.orderNumber || deal.crmId}
                    </div>
                    <div className="min-w-0">
                      <div className="line-clamp-1 text-sm font-medium text-slate-900">
                        {deal.crmTitle || '—'}
                      </div>
                      {deal.stageName && (
                        <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider line-clamp-1">
                          {deal.stageName}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-slate-700 min-w-0">
                      {deal.fabric ? (
                        <span className="line-clamp-1">{deal.fabric}</span>
                      ) : (
                        <span className="text-amber-600 italic text-xs">не указана</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-700 min-w-0">
                      {deal.model ? (
                        <span className="line-clamp-1">{deal.model}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </div>
                    <div>{getFunnelBadge(deal.funnelId)}</div>
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpened(deal)}
                        className="h-8 gap-1 bg-white"
                      >
                        <ArrowRight className="w-3 h-3" />
                        Разобрать
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onPointerDown={(e) => e.stopPropagation()}>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDismissCandidate(deal)} className="text-slate-700">
                            <EyeOff className="mr-2 h-4 w-4" />Скрыть
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile карточки */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            <AnimatePresence mode="popLayout">
              {filtered.map((deal) => (
                <motion.div
                  layout
                  key={deal.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "relative bg-white rounded-xl border shadow-md hover:shadow-lg p-2.5 pl-4 flex flex-col gap-1 transition-all cursor-pointer",
                    "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1.5 before:rounded-l-xl",
                    funnelStripe(deal.funnelId),
                    "border-slate-200 hover:border-slate-300",
                    !deal.fabric && "ring-1 ring-amber-200"
                  )}
                  onClick={() => setOpened(deal)}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="font-black text-base text-slate-900 leading-none shrink-0">
                        #{deal.orderNumber || deal.crmId}
                      </span>
                      <div className="shrink-0 scale-90 origin-left">
                        {getFunnelBadge(deal.funnelId)}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onPointerDown={(e) => e.stopPropagation()}>
                          <Button variant="ghost" className="h-6 w-6 p-0">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDismissCandidate(deal)} className="text-slate-700">
                            <EyeOff className="mr-2 h-4 w-4" />Скрыть
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="px-1 py-0.5">
                    <h3 className="text-[15px] font-bold text-slate-900 line-clamp-1 leading-tight">
                      {deal.crmTitle || '—'}
                    </h3>
                    {deal.stageName && (
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                        {deal.stageName}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-700 mt-1">
                      <span className="text-slate-400">Ткань:</span>{' '}
                      {deal.fabric ? (
                        <span className="font-medium">{deal.fabric}</span>
                      ) : (
                        <span className="text-amber-600 italic">не указана в CRM</span>
                      )}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Модалка разбора сделки */}
      <Dialog open={!!opened} onOpenChange={(o) => { if (!o) setOpened(null) }}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-[760px] w-[95vw] p-0 overflow-hidden gap-0 bg-slate-100 border-slate-300"
        >
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 bg-white">
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="flex items-center gap-2.5 text-base">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-sm">
                  <Hash className="w-3.5 h-3.5" />
                  {opened?.orderNumber || opened?.crmId}
                </span>
                <span className="text-slate-400 font-normal">·</span>
                {opened && getFunnelBadge(opened.funnelId)}
                {opened?.stageName && (
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-normal">
                    {opened.stageName}
                  </span>
                )}
              </DialogTitle>
              <p className="text-base font-semibold text-slate-900 leading-snug">
                {opened?.crmTitle || '—'}
              </p>
            </div>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ModalField icon={<Package className="w-4 h-4" />} label="Ткань *"
                value={draft.fabric}
                onChange={(v) => setDraft((p) => ({ ...p, fabric: v }))}
                placeholder={opened?.fabric ?? 'Вписать ткань'}
                highlight={!draft.fabric.trim()}
              />
              <ModalField icon={<Ruler className="w-4 h-4" />} label="Метраж *"
                value={draft.meters}
                onChange={(v) => setDraft((p) => ({ ...p, meters: v }))}
                type="number" step="0.1" suffix="м" placeholder="—"
                highlight={!(parseFloat(draft.meters) > 0)}
              />
              <ModalField icon={<Sofa className="w-4 h-4" />} label="Модель"
                value={draft.model}
                onChange={(v) => setDraft((p) => ({ ...p, model: v }))}
                placeholder={opened?.model ?? '—'}
              />
              <ModalField icon={<Layers className="w-4 h-4" />} label="Модули"
                value={draft.modules}
                onChange={(v) => setDraft((p) => ({ ...p, modules: v }))}
                placeholder={opened?.modules ?? '—'}
              />
            </div>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" />
                Комментарий из CRM
                <span className="ml-auto text-[10px] text-slate-400 normal-case tracking-normal font-normal">
                  изменения уйдут в KeepinCRM
                </span>
              </h4>
              <Textarea
                value={draft.crmComment}
                onChange={(e) => setDraft((p) => ({ ...p, crmComment: e.target.value }))}
                placeholder="Комментарий в CRM…"
                rows={5}
                className="resize-y bg-white border-slate-300 focus-visible:ring-slate-400 text-slate-900 leading-relaxed shadow-sm"
              />
            </section>
          </div>

          <DialogFooter className="px-6 py-3 bg-slate-200 border-t border-slate-300 sm:justify-between sm:items-center gap-2">
            {opened?.crmId ? (
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                CRM ID · {opened.crmId}
              </span>
            ) : <span />}
            <div className="flex gap-2 flex-wrap justify-end items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700"
                    disabled={promoteMutation.isPending || saveMutation.isPending}
                    aria-label="Дополнительно"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-slate-700"
                    onClick={() => { if (opened) setDismissCandidate(opened) }}
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    Скрыть навсегда
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpened(null)}
                disabled={promoteMutation.isPending || saveMutation.isPending}
                className="gap-1.5"
              >
                Закрыть
              </Button>
              {hasUnsavedChanges && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="gap-1.5 border-slate-400 bg-white"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saveMutation.isPending ? 'Сохраняю…' : 'Сохранить'}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => promoteMutation.mutate()}
                disabled={!canPromote || promoteMutation.isPending}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                {promoteMutation.isPending ? 'Перевожу…' : 'В работу'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Подтверждение Скрыть */}
      <AlertDialog open={!!dismissCandidate} onOpenChange={(o) => { if (!o) setDismissCandidate(null) }}>
        <AlertDialogContent className="bg-slate-100 border-slate-300">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-200 text-slate-700">
                <EyeOff className="w-4 h-4" />
              </span>
              Скрыть из «Не разобранных»?
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-1">
              Сделка{' '}
              <span className="font-semibold text-slate-800">
                #{dismissCandidate?.orderNumber || dismissCandidate?.crmId}
              </span>{' '}
              ({dismissCandidate?.crmTitle}) больше не появится здесь даже при следующем импорте.
              В CRM она не удаляется.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (dismissCandidate) {
                  dismissMutation.mutate(dismissCandidate.id)
                  setDismissCandidate(null)
                }
              }}
              className="bg-slate-700 hover:bg-slate-800"
            >
              Скрыть
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SyncStat({ label, value, tone }: { label: string; value: number | string; tone?: 'good' }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-slate-400">{label}:</span>
      <span className={cn(
        "font-semibold tabular-nums",
        tone === 'good' ? "text-emerald-600" : "text-slate-700"
      )}>{value}</span>
    </span>
  )
}

interface ModalFieldProps {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  step?: string
  suffix?: string
  placeholder?: string
  highlight?: boolean
}

function ModalField({ icon, label, value, onChange, type = 'text', step, suffix, placeholder, highlight }: ModalFieldProps) {
  return (
    <div className={cn(
      "flex items-start gap-2.5 px-3 py-2 rounded-md bg-white border shadow-sm",
      highlight ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-300"
    )}>
      <div className="text-slate-400 mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 leading-none mb-1">
          {label}
        </div>
        <div className="flex items-center gap-1">
          <Input
            type={type}
            step={step}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-7 px-1.5 py-0 text-sm border-0 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 bg-transparent"
          />
          {suffix && <span className="text-xs text-slate-400 shrink-0">{suffix}</span>}
        </div>
      </div>
    </div>
  )
}

function EmptyState({
  hasSearch, onSync, syncing,
}: { hasSearch: boolean; onSync: () => void; syncing: boolean }) {
  if (hasSearch) {
    return (
      <div className="bg-white rounded-xl border border-slate-300 border-dashed p-12 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center bg-slate-100 text-slate-400">
          <Search className="w-7 h-7" />
        </div>
        <div className="max-w-xs">
          <p className="text-base font-semibold text-slate-800">Ничего не найдено</p>
          <p className="text-sm text-slate-500 mt-1">Попробуйте изменить запрос или сбросить поиск.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-xl border border-slate-300 border-dashed p-12 flex flex-col items-center justify-center gap-3 text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-orange-50 text-orange-500">
        <Inbox className="w-7 h-7" />
      </div>
      <div className="max-w-sm">
        <p className="text-base font-semibold text-slate-800">Пусто</p>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          Нажмите «Импорт из CRM», чтобы подтянуть новые активные сделки из воронок 1 и 8.
        </p>
      </div>
      <Button onClick={onSync} disabled={syncing} className="h-10 mt-2 bg-slate-900 hover:bg-slate-800 gap-2">
        <RefreshCcw className={cn("w-4 h-4", syncing && "animate-spin")} />
        Импорт из CRM
      </Button>
    </div>
  )
}

function ListSkeleton() {
  return (
    <>
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hidden md:block">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>№</TableHead>
              <TableHead>Сделка</TableHead>
              <TableHead>Ткань</TableHead>
              <TableHead>Модель</TableHead>
              <TableHead>Воронка</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 1, 2, 3, 4].map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-7 w-24 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid grid-cols-1 gap-2 md:hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </>
  )
}
