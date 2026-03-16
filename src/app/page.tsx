'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search } from 'lucide-react'
import { getKeepinCrmDeal } from '@/app/actions'
import { OrderList } from '@/components/OrderList'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface NewOrder {
  crmId: string
  fabricName: string
  meters: string
}

export default function PendingOrdersPage() {
  const [newOrder, setNewOrder] = useState<NewOrder>({
    crmId: '',
    fabricName: '',
    meters: '',
  })
  const [crmOrderTitle, setCrmOrderTitle] = useState<string | null>(null)
  const [funnelId, setFunnelId] = useState<number | null>(null)
  const [isFetchingCrm, setIsFetchingCrm] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
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
      setFunnelId(deal.funnelId)
      setOrderNumber(deal.orderNumber)
      toast.success(`🔍 Найден заказ: ${deal.title}`)
    } catch (error) {
      console.error('Error fetching CRM deal:', error)
      toast.error('Не удалось найти заказ в CRM')
      setCrmOrderTitle(null)
      setFunnelId(null)
    } finally {
      setIsFetchingCrm(false)
    }
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
          crmId: parseInt(newOrder.crmId, 10),
          funnelId,
        }),
      })

      if (!response.ok) throw new Error('Failed to create order')
      return response.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['fabric-orders'] })
      setNewOrder({ crmId: '', fabricName: '', meters: '' })
      setCrmOrderTitle(null)
      setFunnelId(null)
      toast.success(`✨ Заказ #${data.orderNumber} (${data.fabricName}) успешно добавлен`)
    },
    onError: (error: any) => {
      console.error('Error creating order:', error)
      toast.error(error.message === 'Fill all fields' ? 'Заполните все видимые поля' : 'Не удалось добавить заказ')
    }
  })

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-4 border border-slate-200">
        <form onSubmit={(e) => { e.preventDefault(); addOrderMutation.mutate() }} className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-grow space-y-3 md:space-y-0 md:flex md:gap-3">
            <div className="flex-grow min-w-[150px] space-y-1">
              <div className="flex gap-2">
                <Input
                  id="crmId"
                  type="text"
                  placeholder="ID из CRM"
                  value={newOrder.crmId}
                  onChange={(e) => setNewOrder({ ...newOrder, crmId: e.target.value })}
                  disabled={addOrderMutation.isPending || isFetchingCrm}
                  className="h-10 w-full"
                />
                <Button
                  type="button"
                  onClick={handleFetchCrmDeal}
                  disabled={addOrderMutation.isPending || isFetchingCrm}
                  className="h-10"
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              {crmOrderTitle && (
                <p className="text-xs text-slate-600 mt-1">
                  Найден: <span className="font-semibold">{crmOrderTitle}</span>
                </p>
              )}
            </div>
            <div className="flex-grow min-w-[150px]">
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
            <div className="flex-grow min-w-[100px] md:max-w-[120px]">
              <Input
                id="meters"
                type="number"
                step="0.1"
                placeholder="Метраж"
                value={newOrder.meters}
                onChange={(e) => setNewOrder({ ...newOrder, meters: e.target.value })}
                disabled={addOrderMutation.isPending}
                className="h-10 w-full"
              />
            </div>
          </div>
          <Button
            type="submit"
            className="h-10 w-full md:w-auto bg-slate-800 hover:bg-slate-900"
            disabled={addOrderMutation.isPending || isFetchingCrm || !crmOrderTitle}
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить
          </Button>
        </form>
      </div>

      <OrderList status="PENDING" />
    </div>
  )
}
