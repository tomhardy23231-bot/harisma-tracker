'use client'

import { useState } from 'react'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  MessageSquare,
  Hash,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react'
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
}

interface SyncResult {
  fetchedFromCrm: number
  imported: number
  updated: number
  skippedInFabric: number
  skippedDecided: number
  mode: 'full' | 'incremental'
}

export default function UnsortedDealsPage() {
  const qc = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
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
      if (data.skippedInFabric) parts.push(`уже в трекере: ${data.skippedInFabric}`)
      if (data.skippedDecided) parts.push(`скрыто/переведено ранее: ${data.skippedDecided}`)
      toast.success(`🔄 Импорт (${data.mode}) — получено ${data.fetchedFromCrm}: ${parts.join(', ') || 'без изменений'}`)
    },
    onError: (err: Error) => {
      toast.error(`Ошибка импорта: ${err.message}`)
    },
  })

  const promoteMutation = useMutation({
    mutationFn: async ({ deal, values }: { deal: UnsortedDeal; values: DraftValues }) => {
      const r = await fetch(`/api/unsorted/${deal.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fabricName: values.fabric.trim(),
          meters: parseFloat(values.meters),
          model: values.model.trim() || null,
          modules: values.modules.trim() || null,
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
      toast.success(`✨ #${fabricOrder.orderNumber} переведён в "Нужно заказать"`)
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
      toast.success('🙈 Скрыто. Не появится при следующем импорте.')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const getDraft = (deal: UnsortedDeal): DraftValues =>
    drafts[deal.id] ?? {
      fabric: deal.fabric ?? '',
      meters: '',
      model: deal.model ?? '',
      modules: deal.modules ?? '',
    }

  const setDraft = (deal: UnsortedDeal, patch: Partial<DraftValues>) => {
    setDrafts((prev) => ({
      ...prev,
      [deal.id]: { ...getDraft(deal), ...patch },
    }))
  }

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
              <Inbox className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 leading-tight flex items-center gap-2">
                Не разобранные
                <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-mono">
                  {deals.length}
                </Badge>
              </h2>
              <p className="text-xs text-slate-500">
                Новые сделки из CRM (воронки 1 и 8). Архивные и уже в трекере — пропускаются.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => syncMutation.mutate(true)}
                    disabled={syncMutation.isPending}
                    className="h-10 gap-2"
                  >
                    <Download className={cn("w-4 h-4", syncMutation.isPending && "animate-pulse")} />
                    Полный
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Перетащить ВСЕ активные сделки из CRM<br/>(а не только новее последней импортированной)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              onClick={() => syncMutation.mutate(false)}
              disabled={syncMutation.isPending}
              className="h-10 bg-slate-900 hover:bg-slate-800 gap-2"
            >
              <RefreshCcw className={cn("w-4 h-4", syncMutation.isPending && "animate-spin")} />
              {syncMutation.isPending ? 'Импортирую…' : 'Импорт из CRM'}
            </Button>
          </div>
        </div>

        {lastSync && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
            <SyncStat label="режим" value={lastSync.mode === 'full' ? 'полный' : 'инкремент'} />
            <SyncStat label="из CRM" value={lastSync.fetchedFromCrm} />
            <SyncStat label="новых" value={lastSync.imported} tone={lastSync.imported > 0 ? 'good' : undefined} />
            <SyncStat label="обновлено" value={lastSync.updated} />
            <SyncStat label="уже в трекере" value={lastSync.skippedInFabric} />
            <SyncStat label="скрыто/обработано ранее" value={lastSync.skippedDecided} />
          </div>
        )}
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : deals.length === 0 ? (
        <EmptyState onSync={() => syncMutation.mutate(false)} onForce={() => syncMutation.mutate(true)} syncing={syncMutation.isPending} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden hidden md:block">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[110px]">№ / CRM</TableHead>
                  <TableHead>Сделка</TableHead>
                  <TableHead className="w-[240px]">Ткань</TableHead>
                  <TableHead className="w-[100px]">Метраж *</TableHead>
                  <TableHead className="w-[160px]">Модель</TableHead>
                  <TableHead className="w-[160px]">Модули</TableHead>
                  <TableHead className="w-[210px] text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {deals.map((deal) => {
                    const draft = getDraft(deal)
                    const isPromoting = promoteMutation.isPending && promoteMutation.variables?.deal.id === deal.id
                    const isDismissing = dismissMutation.isPending && dismissMutation.variables === deal.id
                    const canPromote = draft.fabric.trim().length > 0 && parseFloat(draft.meters) > 0
                    const isOpen = expanded.has(deal.id)
                    return (
                      <motion.tr
                        layout
                        key={deal.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.18 }}
                        className={cn("border-b align-top", isOpen && "bg-slate-50/50")}
                      >
                        <TableCell className="py-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px] w-fit">
                              <Hash className="w-3 h-3" />
                              {deal.orderNumber || deal.crmId}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">CRM #{deal.crmId}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] uppercase tracking-wider w-fit px-1 py-0",
                                deal.funnelId === 8
                                  ? "border-violet-300 text-violet-700 bg-violet-50"
                                  : "border-blue-300 text-blue-700 bg-blue-50"
                              )}
                            >
                              в.{deal.funnelId}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 max-w-[280px]">
                          <div className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">
                            {deal.crmTitle || '—'}
                          </div>
                          {deal.stageName && (
                            <div className="text-[10px] text-slate-500 mt-0.5">{deal.stageName}</div>
                          )}
                          {deal.crmComment && (
                            <button
                              onClick={() => toggleExpanded(deal.id)}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700"
                            >
                              <MessageSquare className="w-3 h-3" />
                              {isOpen ? 'Скрыть' : 'Комментарий из CRM'}
                              {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                          {isOpen && deal.crmComment && (
                            <div className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {deal.crmComment}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            value={draft.fabric}
                            onChange={(e) => setDraft(deal, { fabric: e.target.value })}
                            placeholder={deal.fabric ?? 'Вписать ткань'}
                            className={cn(
                              "h-8 text-sm",
                              !draft.fabric.trim() && "border-amber-300 ring-1 ring-amber-200"
                            )}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            type="number"
                            step="0.1"
                            value={draft.meters}
                            onChange={(e) => setDraft(deal, { meters: e.target.value })}
                            placeholder="м"
                            className={cn(
                              "h-8 text-sm",
                              !(parseFloat(draft.meters) > 0) && "border-amber-300 ring-1 ring-amber-200"
                            )}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            value={draft.model}
                            onChange={(e) => setDraft(deal, { model: e.target.value })}
                            placeholder={deal.model ?? '—'}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            value={draft.modules}
                            onChange={(e) => setDraft(deal, { modules: e.target.value })}
                            placeholder={deal.modules ?? '—'}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => promoteMutation.mutate({ deal, values: draft })}
                              disabled={!canPromote || isPromoting}
                              className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              {isPromoting ? '…' : 'В работу'}
                            </Button>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDismissCandidate(deal)}
                                    disabled={isDismissing}
                                    className="h-8 w-8 p-0"
                                  >
                                    <EyeOff className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Скрыть навсегда</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>

          {/* Mobile compact list */}
          <div className="md:hidden space-y-2">
            <AnimatePresence mode="popLayout">
              {deals.map((deal) => {
                const draft = getDraft(deal)
                const isPromoting = promoteMutation.isPending && promoteMutation.variables?.deal.id === deal.id
                const canPromote = draft.fabric.trim().length > 0 && parseFloat(draft.meters) > 0
                const isOpen = expanded.has(deal.id)
                return (
                  <motion.div
                    layout
                    key={deal.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                  >
                    <button
                      onClick={() => toggleExpanded(deal.id)}
                      className="w-full p-3 flex items-start gap-2 text-left"
                    >
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px]">
                          <Hash className="w-3 h-3" />
                          {deal.orderNumber || deal.crmId}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] uppercase tracking-wider px-1 py-0",
                            deal.funnelId === 8
                              ? "border-violet-300 text-violet-700 bg-violet-50"
                              : "border-blue-300 text-blue-700 bg-blue-50"
                          )}
                        >
                          в.{deal.funnelId}
                        </Badge>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">
                          {deal.crmTitle || '—'}
                        </div>
                        {deal.stageName && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{deal.stageName}</div>
                        )}
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-3">
                        {deal.crmComment && (
                          <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {deal.crmComment}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <MobileField label="Ткань *" value={draft.fabric} onChange={(v) => setDraft(deal, { fabric: v })} highlight={!draft.fabric.trim()} placeholder={deal.fabric ?? '—'} />
                          <MobileField label="Метраж *" type="number" step="0.1" value={draft.meters} onChange={(v) => setDraft(deal, { meters: v })} highlight={!(parseFloat(draft.meters) > 0)} placeholder="м" />
                          <MobileField label="Модель" value={draft.model} onChange={(v) => setDraft(deal, { model: v })} placeholder={deal.model ?? '—'} />
                          <MobileField label="Модули" value={draft.modules} onChange={(v) => setDraft(deal, { modules: v })} placeholder={deal.modules ?? '—'} />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => promoteMutation.mutate({ deal, values: draft })}
                            disabled={!canPromote || isPromoting}
                            className="flex-1 h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            {isPromoting ? '…' : 'В работу'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDismissCandidate(deal)}
                            className="h-9 gap-1.5"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            Скрыть
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </>
      )}

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
              <span className="font-semibold text-slate-800">#{dismissCandidate?.orderNumber || dismissCandidate?.crmId}</span>{' '}
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

interface MobileFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  step?: string
  placeholder?: string
  highlight?: boolean
}

function MobileField({ label, value, onChange, type = 'text', step, placeholder, highlight }: MobileFieldProps) {
  return (
    <div className={cn(
      "flex flex-col gap-0.5 p-1.5 rounded-md bg-white border",
      highlight ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"
    )}>
      <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-500 leading-none">{label}</span>
      <Input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 px-1 py-0 text-sm border-0 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 bg-transparent"
      />
    </div>
  )
}

function EmptyState({ onSync, onForce, syncing }: { onSync: () => void; onForce: () => void; syncing: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-slate-300 border-dashed p-12 flex flex-col items-center justify-center gap-3 text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-orange-50 text-orange-500">
        <Inbox className="w-7 h-7" />
      </div>
      <div className="max-w-sm">
        <p className="text-base font-semibold text-slate-800">Пусто</p>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          Если в CRM есть активные сделки, которых пока нет в трекере — нажмите «Полный»,
          чтобы перетянуть все. Обычный «Импорт» тянет только новые с прошлого раза.
        </p>
      </div>
      <div className="flex gap-2 mt-2">
        <Button onClick={onForce} disabled={syncing} variant="outline" className="h-10 gap-2">
          <Download className="w-4 h-4" />
          Полный
        </Button>
        <Button onClick={onSync} disabled={syncing} className="h-10 bg-slate-900 hover:bg-slate-800 gap-2">
          <RefreshCcw className={cn("w-4 h-4", syncing && "animate-spin")} />
          Импорт из CRM
        </Button>
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 border-b last:border-0">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-24 ml-auto" />
        </div>
      ))}
    </div>
  )
}
