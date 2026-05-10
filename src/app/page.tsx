'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, MessageSquare } from 'lucide-react'
import { getKeepinCrmDeal } from '@/app/actions'
import { OrderList } from '@/components/OrderList'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface NewOrder {
  crmId: string
  fabricName: string
  meters: string
  model: string
  modules: string
}

export default function PendingOrdersPage() {
  const [newOrder, setNewOrder] = useState<NewOrder>({
    crmId: '',
    fabricName: '',
    meters: '',
    model: '',
    modules: '',
  })
  const [crmOrderTitle, setCrmOrderTitle] = useState<string | null>(null)
  const [crmComment, setCrmComment] = useState<string | null>(null)
  const [funnelId, setFunnelId] = useState<number | null>(null)
  const [isFetchingCrm, setIsFetchingCrm] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [fabricFromCrm, setFabricFromCrm] = useState(false)
  const queryClient = useQueryClient()

  const handleFetchCrmDeal = async () => {
    if (!newOrder.crmId) {
      toast.error('Введите ID заказа из CRM')
      return
    }
    setIsFetchingCrm(true)
    try {
      const deal = await getKeepinCrmDeal(parseInt(newOrder.crmId, 10))
      setCrmOrderTitle(deal.title)
      setCrmComment(deal.crmComment)
      setFunnelId(deal.funnelId)
      setOrderNumber(deal.orderNumber)

      setNewOrder((prev) => ({
        ...prev,
        fabricName: deal.fabric ?? '',
        model: deal.model ?? '',
        modules: deal.modules ?? '',
      }))
      setFabricFromCrm(!!deal.fabric)

      if (deal.fabric) {
        toast.success(`🔍 ${deal.title} — ткань: ${deal.fabric}`)
      } else {
        toast.message(`🔍 ${deal.title}`, {
          description: 'Ткань не указана в CRM — впишите вручную из комментария',
        })
      }
    } catch (error) {
      console.error('Error fetching CRM deal:', error)
      toast.error('Не удалось найти заказ в CRM')
      setCrmOrderTitle(null)
      setCrmComment(null)
      setFunnelId(null)
      setFabricFromCrm(false)
    } finally {
      setIsFetchingCrm(false)
    }
  }

  const resetForm = () => {
    setNewOrder({ crmId: '', fabricName: '', meters: '', model: '', modules: '' })
    setCrmOrderTitle(null)
    setCrmComment(null)
    setFunnelId(null)
    setOrderNumber('')
    setFabricFromCrm(false)
  }

  const addOrderMutation = useMutation({
    mutationFn: async () => {
      if (!newOrder.crmId || !newOrder.fabricName || !newOrder.meters) {
        throw new Error('Fill all fields')
      }

      if (funnelId === null || funnelId === undefined) {
        throw new Error('CRM funnel ID missing')
      }

      const response = await fetch('/api/fabric-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          fabricName: newOrder.fabricName,
          meters: parseFloat(newOrder.meters),
          model: newOrder.model || null,
          modules: newOrder.modules || null,
          crmId: parseInt(newOrder.crmId, 10),
          crmTitle: crmOrderTitle,
          crmComment: crmComment,
          funnelId,
        }),
      })

      if (!response.ok) throw new Error('Failed to create order')
      return response.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['fabric-orders'] })
      resetForm()
      toast.success(`✨ Заказ #${data.orderNumber} (${data.fabricName}) успешно добавлен`)
    },
    onError: (error: any) => {
      console.error('Error creating order:', error)
      toast.error(error.message === 'Fill all fields' ? 'Заполните все видимые поля' : 'Не удалось добавить заказ')
    }
  })

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-4 border border-slate-200 space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); addOrderMutation.mutate() }} className="space-y-3">
          {/* ID + Поиск */}
          <div className="flex gap-2">
            <Input
              id="crmId"
              type="text"
              placeholder="ID из CRM"
              value={newOrder.crmId}
              onChange={(e) => setNewOrder({ ...newOrder, crmId: e.target.value })}
              disabled={addOrderMutation.isPending || isFetchingCrm}
              className="h-10 max-w-[180px]"
            />
            <Button
              type="button"
              onClick={handleFetchCrmDeal}
              disabled={addOrderMutation.isPending || isFetchingCrm}
              className="h-10"
            >
              <Search className="w-4 h-4 mr-1" />
              {isFetchingCrm ? 'Поиск…' : 'Найти'}
            </Button>
            {crmOrderTitle && (
              <div className="flex items-center text-xs text-slate-600 ml-2 truncate">
                <span className="font-semibold truncate">{crmOrderTitle}</span>
                <span className="ml-2 text-slate-400">№{orderNumber}</span>
              </div>
            )}
          </div>

          {/* CRM-комментарий — показываем если ткань пустая, чтобы было откуда списать */}
          {crmOrderTitle && !fabricFromCrm && crmComment && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex gap-2 items-start">
              <MessageSquare className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-700">
                  Ткань не указана в CRM — выпишите из комментария
                </p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                  {crmComment}
                </p>
              </div>
            </div>
          )}

          {/* Поля заказа */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:items-end">
            <div className="md:col-span-4 space-y-1">
              <label className="text-[11px] uppercase tracking-wider font-medium text-slate-500">
                Ткань {fabricFromCrm && <span className="text-emerald-600 normal-case tracking-normal">из CRM</span>}
              </label>
              <Input
                id="fabricName"
                type="text"
                placeholder="Название ткани"
                value={newOrder.fabricName}
                onChange={(e) => setNewOrder({ ...newOrder, fabricName: e.target.value })}
                disabled={addOrderMutation.isPending}
                className="h-10 w-full"
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-[11px] uppercase tracking-wider font-medium text-slate-500">Метраж</label>
              <Input
                id="meters"
                type="number"
                step="0.1"
                placeholder="м"
                value={newOrder.meters}
                onChange={(e) => setNewOrder({ ...newOrder, meters: e.target.value })}
                disabled={addOrderMutation.isPending}
                className="h-10 w-full"
              />
            </div>
            <div className="md:col-span-3 space-y-1">
              <label className="text-[11px] uppercase tracking-wider font-medium text-slate-500">Модель</label>
              <Input
                id="model"
                type="text"
                placeholder="—"
                value={newOrder.model}
                onChange={(e) => setNewOrder({ ...newOrder, model: e.target.value })}
                disabled={addOrderMutation.isPending}
                className="h-10 w-full"
              />
            </div>
            <div className="md:col-span-3 space-y-1">
              <label className="text-[11px] uppercase tracking-wider font-medium text-slate-500">Модули</label>
              <Input
                id="modules"
                type="text"
                placeholder="—"
                value={newOrder.modules}
                onChange={(e) => setNewOrder({ ...newOrder, modules: e.target.value })}
                disabled={addOrderMutation.isPending}
                className="h-10 w-full"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              className="h-10 w-full md:w-auto bg-slate-800 hover:bg-slate-900"
              disabled={addOrderMutation.isPending || isFetchingCrm || !crmOrderTitle}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </div>
        </form>
      </div>

      <OrderList status="PENDING" />
    </div>
  )
}
