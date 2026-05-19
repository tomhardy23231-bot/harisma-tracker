'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  ExternalLink,
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

export default function UnsortedDealsPage() {
  const qc = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({})
  const [dismissCandidate, setDismissCandidate] = useState<UnsortedDeal | null>(null)

  const { data: deals = [], isLoading } = useQuery<UnsortedDeal[]>({
    queryKey: ['unsorted-deals'],
    queryFn: async () => {
      const r = await fetch('/api/unsorted')
      if (!r.ok) throw new Error('Failed to fetch unsorted')
      return r.json()
    },
  })

  const syncMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/unsorted/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.error || 'Sync failed')
      }
      return r.json()
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['unsorted-deals'] })
      qc.invalidateQueries({ queryKey: ['fabric-orders'] })
      const parts: string[] = []
      if (data.imported) parts.push(`новых: ${data.imported}`)
      if (data.updated) parts.push(`обновлено: ${data.updated}`)
      if (data.skipped) parts.push(`пропущено: ${data.skipped}`)
      toast.success(`🔄 Импорт завершён (${parts.join(', ') || 'без изменений'})`)
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
      toast.success(`✨ Заказ #${fabricOrder.orderNumber} переведён в "Нужно заказать"`)
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

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
              Новые сделки из CRM (воронки 1 и 8). Заполните метраж и переведите в работу.
            </p>
          </div>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="h-10 bg-slate-900 hover:bg-slate-800 gap-2"
        >
          <RefreshCcw className={cn("w-4 h-4", syncMutation.isPending && "animate-spin")} />
          {syncMutation.isPending ? 'Импортирую…' : 'Импорт из CRM'}
        </Button>
      </div>

      {isLoading ? (
        <UnsortedSkeleton />
      ) : deals.length === 0 ? (
        <EmptyState onSync={() => syncMutation.mutate()} syncing={syncMutation.isPending} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {deals.map((deal) => {
              const draft = getDraft(deal)
              const isPromoting = promoteMutation.isPending && promoteMutation.variables?.deal.id === deal.id
              const isDismissing = dismissMutation.isPending && dismissMutation.variables === deal.id
              const canPromote = draft.fabric.trim().length > 0 && parseFloat(draft.meters) > 0
              return (
                <motion.div
                  layout
                  key={deal.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-xs">
                          <Hash className="w-3 h-3" />
                          {deal.orderNumber || deal.crmId}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase tracking-wider",
                            deal.funnelId === 8
                              ? "border-violet-300 text-violet-700 bg-violet-50"
                              : "border-blue-300 text-blue-700 bg-blue-50"
                          )}
                        >
                          Воронка {deal.funnelId}
                          {deal.funnelTitle && <span className="ml-1 normal-case opacity-70">· {deal.funnelTitle}</span>}
                        </Badge>
                        {deal.stageName && (
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                            {deal.stageName}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-slate-900 leading-snug line-clamp-2">
                        {deal.crmTitle || '—'}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 mt-1 font-mono">
                        CRM ID · {deal.crmId}
                      </span>
                    </div>
                  </div>

                  {deal.crmComment && (
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5 flex gap-2 items-start">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-4">
                        {deal.crmComment}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-12 gap-2">
                    <FieldInput
                      className="col-span-7"
                      icon={<Package className="w-3.5 h-3.5" />}
                      label="Ткань"
                      value={draft.fabric}
                      onChange={(v) => setDraft(deal, { fabric: v })}
                      placeholder={deal.fabric ?? 'Вписать ткань'}
                      highlight={!draft.fabric.trim()}
                    />
                    <FieldInput
                      className="col-span-5"
                      icon={<Ruler className="w-3.5 h-3.5" />}
                      label="Метраж *"
                      type="number"
                      step="0.1"
                      value={draft.meters}
                      onChange={(v) => setDraft(deal, { meters: v })}
                      placeholder="м"
                      highlight={!(parseFloat(draft.meters) > 0)}
                    />
                    <FieldInput
                      className="col-span-6"
                      icon={<Sofa className="w-3.5 h-3.5" />}
                      label="Модель"
                      value={draft.model}
                      onChange={(v) => setDraft(deal, { model: v })}
                      placeholder={deal.model ?? '—'}
                    />
                    <FieldInput
                      className="col-span-6"
                      icon={<Layers className="w-3.5 h-3.5" />}
                      label="Модули"
                      value={draft.modules}
                      onChange={(v) => setDraft(deal, { modules: v })}
                      placeholder={deal.modules ?? '—'}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => promoteMutation.mutate({ deal, values: draft })}
                      disabled={!canPromote || isPromoting}
                      className="flex-1 h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      {isPromoting ? 'Перевожу…' : 'В работу'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDismissCandidate(deal)}
                      disabled={isDismissing}
                      className="h-9 gap-1.5"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      Скрыть
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
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

interface FieldInputProps {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  step?: string
  placeholder?: string
  highlight?: boolean
  className?: string
}

function FieldInput({ icon, label, value, onChange, type = 'text', step, placeholder, highlight, className }: FieldInputProps) {
  return (
    <div className={cn(
      "flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-white border shadow-sm",
      highlight ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-300",
      className
    )}>
      <div className="text-slate-400 mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 leading-none mb-0.5">
          {label}
        </div>
        <Input
          type={type}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-7 px-1 py-0 text-sm border-0 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 bg-transparent"
        />
      </div>
    </div>
  )
}

function EmptyState({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-slate-300 border-dashed p-12 flex flex-col items-center justify-center gap-3 text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-orange-50 text-orange-500">
        <Inbox className="w-7 h-7" />
      </div>
      <div className="max-w-sm">
        <p className="text-base font-semibold text-slate-800">Пусто</p>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          Нажмите «Импорт из CRM», чтобы подтянуть новые активные сделки из воронок 1 и 8.
          Архивные сделки и уже добавленные заказы пропускаются автоматически.
        </p>
      </div>
      <Button
        onClick={onSync}
        disabled={syncing}
        className="mt-2 h-10 bg-slate-900 hover:bg-slate-800 gap-2"
      >
        <RefreshCcw className={cn("w-4 h-4", syncing && "animate-spin")} />
        {syncing ? 'Импортирую…' : 'Импорт из CRM'}
      </Button>
    </div>
  )
}

function UnsortedSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}
