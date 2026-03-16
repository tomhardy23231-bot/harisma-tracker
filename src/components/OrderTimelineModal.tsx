'use client'

import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface OrderTimelineModalProps {
  order: any | null
  isOpen: boolean
  onClose: () => void
}

export function OrderTimelineModal({ order, isOpen, onClose }: OrderTimelineModalProps) {
  if (!order) return null

  const timelineItems = [
    {
      label: 'Создан',
      date: order.createdAt,
      show: true,
    },
    {
      label: 'Заказан',
      date: order.orderedAt,
      show: !!order.orderedAt,
    },
    {
      label: 'Прибыл на склад',
      date: order.arrivedAt,
      show: !!order.arrivedAt,
    },
    {
      label: 'Отправлен в архив',
      date: order.archivedAt,
      show: !!order.archivedAt,
    },
  ].filter(item => item.show)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>История заказа #{order.orderNumber}</DialogTitle>
        </DialogHeader>
        <div className="py-6">
          <div className="relative border-l-2 border-slate-200 ml-3 space-y-8">
            {timelineItems.map((item, index) => (
              <div key={index} className="relative pl-8">
                <div 
                  className={cn(
                    "absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white bg-slate-800 shadow-sm",
                    index === timelineItems.length - 1 ? "ring-4 ring-slate-100" : ""
                  )} 
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">{item.label}</span>
                  <span className="text-sm text-slate-500">
                    {item.date ? format(new Date(item.date), 'dd.MM.yyyy HH:mm') : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
