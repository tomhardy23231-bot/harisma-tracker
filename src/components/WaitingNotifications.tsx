'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Bell, Hourglass, AlertCircle, Play } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import {
  type FabricOrder,
  isWaitingOverdue,
  waitingDaysElapsed,
} from './OrderList'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Нужно заказать',
  ORDERED: 'Заказано',
  ARRIVED: 'На складе',
  ARCHIVED: 'Архив',
}

/**
 * Маленький значок-колокольчик с числом ПРОСРОЧЕННЫХ ожиданий.
 * Просроченное уведомление НЕ убрать без действия — только «Продлить» или
 * «Снять ожидание». Этим колокольчик отличается от toast'ов, которые
 * проходят сами.
 */
export function WaitingNotifications() {
  const qc = useQueryClient()
  const [extendTarget, setExtendTarget] = useState<FabricOrder | null>(null)
  const [extendReason, setExtendReason] = useState('')
  const [extendDays, setExtendDays] = useState('7')

  const { data: orders = [] } = useQuery<FabricOrder[]>({
    queryKey: ['fabric-orders'],
    queryFn: async () => {
      const r = await fetch('/api/fabric-orders')
      if (!r.ok) return []
      return r.json()
    },
    refetchOnWindowFocus: false,
    refetchInterval: 60_000, // раз в минуту переоценка просрочек
  })

  const waiting = orders.filter((o) => o.waitingSince && o.status !== 'ARCHIVED')
  const overdue = waiting.filter(isWaitingOverdue)

  const extendMutation = useMutation({
    mutationFn: async ({ orderId, reason, days }: { orderId: string; reason: string; days: number }) => {
      const r = await fetch(`/api/fabric-orders/${orderId}/wait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, days }),
      })
      if (!r.ok) throw new Error('Failed to extend')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fabric-orders'] })
      setExtendTarget(null)
      setExtendReason('')
      setExtendDays('7')
      toast.success('⏳ Ожидание продлено')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const clearMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const r = await fetch(`/api/fabric-orders/${orderId}/wait`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed to clear')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fabric-orders'] })
      toast.success('▶️ Ожидание снято')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const totalCount = waiting.length
  const overdueCount = overdue.length

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "relative inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors",
              overdueCount > 0
                ? "text-rose-600 hover:bg-rose-50"
                : totalCount > 0
                  ? "text-amber-600 hover:bg-amber-50"
                  : "text-slate-400 hover:bg-slate-100"
            )}
            aria-label={`Ожидания: ${totalCount}, просрочено: ${overdueCount}`}
          >
            <Bell className="w-[18px] h-[18px]" />
            {totalCount > 0 && (
              <span
                className={cn(
                  "absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold leading-none tabular-nums text-white",
                  overdueCount > 0 ? "bg-rose-500" : "bg-amber-500"
                )}
              >
                {overdueCount > 0 ? overdueCount : totalCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[360px] p-0 bg-white border-slate-200 shadow-xl"
        >
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <Hourglass className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Заказы в ожидании</h3>
            <span className="ml-auto text-[11px] text-slate-500 tabular-nums">
              {overdueCount > 0 && (
                <span className="text-rose-600 font-semibold">{overdueCount} просроч.</span>
              )}
              {overdueCount > 0 && totalCount > overdueCount && <span className="mx-1 text-slate-300">·</span>}
              {totalCount > overdueCount && <span>{totalCount - overdueCount} активн.</span>}
            </span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
            {waiting.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Нет заказов в ожидании
              </div>
            ) : (
              waiting
                .sort((a, b) => waitingDaysElapsed(b) - waitingDaysElapsed(a))
                .map((o) => {
                  const days = waitingDaysElapsed(o)
                  const od = isWaitingOverdue(o)
                  return (
                    <div key={o.id} className="px-4 py-3 hover:bg-slate-50">
                      <div className="flex items-start gap-2 mb-1.5">
                        <span className={cn(
                          "inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0",
                          od ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-700"
                        )}>
                          {od ? <AlertCircle className="w-3.5 h-3.5" /> : <Hourglass className="w-3.5 h-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className="font-semibold text-slate-900">#{o.orderNumber}</span>
                            <span className="text-slate-400 text-xs">·</span>
                            <span className="text-xs text-slate-500">{STATUS_LABEL[o.status]}</span>
                            <span className={cn(
                              "ml-auto text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded",
                              od ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                            )}>
                              {days} дн
                            </span>
                          </div>
                          <div className="text-xs text-slate-700 mt-0.5 line-clamp-1">
                            {o.fabricName} · {o.meters} м
                          </div>
                          {o.waitingReason && (
                            <div className="text-[11px] text-slate-600 mt-1 italic">
                              «{o.waitingReason}»
                            </div>
                          )}
                          {o.waitingUntil && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              срок до {format(new Date(o.waitingUntil), 'dd.MM.yyyy')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => clearMutation.mutate(o.id)}
                          disabled={clearMutation.isPending}
                          className="h-7 text-xs gap-1"
                        >
                          <Play className="w-3 h-3" />
                          Снять
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setExtendTarget(o)
                            setExtendReason(o.waitingReason || '')
                            setExtendDays('7')
                          }}
                          className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700"
                        >
                          <Hourglass className="w-3 h-3" />
                          Продлить
                        </Button>
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={!!extendTarget} onOpenChange={(o) => { if (!o) setExtendTarget(null) }}>
        <DialogContent className="sm:max-w-[420px] bg-slate-100 border-slate-300">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-amber-100 text-amber-700">
                <Hourglass className="w-4 h-4" />
              </span>
              Продлить ожидание
              {extendTarget && (
                <span className="text-sm font-normal text-slate-500 ml-1">
                  #{extendTarget.orderNumber}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-600">
                Причина
              </label>
              <Textarea
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
                rows={2}
                className="bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-600">
                Продлить на (дней)
              </label>
              <div className="flex gap-2">
                {[3, 7, 14, 30].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={extendDays === String(d) ? 'default' : 'outline'}
                    onClick={() => setExtendDays(String(d))}
                    className={cn("h-8 px-3", extendDays === String(d) && "bg-slate-800")}
                  >
                    {d}
                  </Button>
                ))}
                <Input
                  type="number"
                  min="1"
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  className="h-8 w-20 bg-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendTarget(null)} disabled={extendMutation.isPending}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                if (!extendTarget) return
                const days = parseInt(extendDays, 10)
                if (!extendReason.trim() || !(days > 0)) {
                  toast.error('Заполните причину и срок (> 0)')
                  return
                }
                extendMutation.mutate({ orderId: extendTarget.id, reason: extendReason.trim(), days })
              }}
              disabled={extendMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 gap-1.5"
            >
              <Hourglass className="w-4 h-4" />
              {extendMutation.isPending ? 'Сохраняю…' : 'Продлить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
