'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Copy, Edit2, Trash2, Search, MoreHorizontal, MessageSquare, Archive, ArrowRight, RotateCcw } from 'lucide-react'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { updateKeepinCrmStage } from '@/app/actions'
import { OrderTimelineModal } from './OrderTimelineModal'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export type OrderStatus = 'PENDING' | 'ORDERED' | 'ARRIVED' | 'ARCHIVED'

export interface FabricOrder {
  id: string
  orderNumber: string
  fabricName: string
  meters: number
  status: OrderStatus
  comment: string | null
  crmId: number | null
  funnelId: number | null
  orderedAt: string | null
  arrivedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

interface OrderListProps {
  status: OrderStatus
}

export function OrderList({ status }: OrderListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingComment, setEditingComment] = useState<FabricOrder | null>(null)
  const [commentText, setCommentText] = useState('')
  const [timelineOrder, setTimelineOrder] = useState<FabricOrder | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: orders = [], isLoading } = useQuery<FabricOrder[]>({
    queryKey: ['fabric-orders'],
    queryFn: async () => {
      const response = await fetch('/api/fabric-orders')
      if (!response.ok) throw new Error('Failed to fetch orders')
      return response.json()
    }
  })

  const statusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string, newStatus: OrderStatus }) => {
      const order = orders.find((o) => o.id === orderId)
      if (newStatus === 'ORDERED' && order?.crmId && order?.funnelId) {
        await updateKeepinCrmStage(order.crmId, order.funnelId)
      }

      const response = await fetch(`/api/fabric-orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!response.ok) throw new Error('Failed to update status')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabric-orders'] })
      toast({ title: 'Успешно', description: 'Статус обновлен' })
    },
    onError: (error) => {
      console.error('Error updating status:', error)
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось обновить статус' })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/fabric-orders/${orderId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete order')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabric-orders'] })
      toast({ title: 'Успешно', description: 'Заказ удален' })
    },
    onError: (error) => {
      console.error('Error deleting order:', error)
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось удалить заказ' })
    }
  })

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!editingComment) return
      const response = await fetch(`/api/fabric-orders/${editingComment.id}/comment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: commentText }),
      })
      if (!response.ok) throw new Error('Failed to save comment')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabric-orders'] })
      setEditingComment(null)
      setCommentText('')
      toast({ title: 'Успешно', description: 'Комментарий сохранен' })
    },
    onError: (error) => {
      console.error('Error saving comment:', error)
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось сохранить комментарий' })
    }
  })

  const handleCopy = (order: FabricOrder) => {
    const text = `${order.fabricName} ${order.meters}м (№${order.orderNumber})`
    navigator.clipboard.writeText(text)
    toast({ title: 'Скопировано!' })
  }

  const getStatusBadge = (status: OrderStatus) => {
    const config = {
      PENDING: { label: 'Нужно заказать', color: 'bg-red-500 hover:bg-red-600' },
      ORDERED: { label: 'Заказано', color: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
      ARRIVED: { label: 'На складе', color: 'bg-green-500 hover:bg-green-600' },
      ARCHIVED: { label: 'Архив', color: 'bg-slate-500 hover:bg-slate-600' },
    }
    const { label, color } = config[status]
    return <Badge className={color}>{label}</Badge>
  }

  const filteredOrders = orders
    .filter((order) => order.status === status)
    .filter((order) =>
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.fabricName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => parseInt(a.orderNumber) - parseInt(b.orderNumber))

  const renderActions = (order: FabricOrder) => {
    if (status === 'PENDING') {
      return (
        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ orderId: order.id, newStatus: 'ORDERED' })} className="h-8 gap-1">
          <ArrowRight className="w-3 h-3" />
          Заказано
        </Button>
      )
    }
    if (status === 'ORDERED') {
      return (
        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ orderId: order.id, newStatus: 'ARRIVED' })} className="h-8 gap-1">
          <ArrowRight className="w-3 h-3" />
          На складе
        </Button>
      )
    }
    if (status === 'ARRIVED') {
      return (
        <div className="flex gap-2">
           <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ orderId: order.id, newStatus: 'ARCHIVED' })} className="h-8 w-8 p-0">
                  <Archive className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>В архив</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button size="sm" variant="ghost" onClick={() => setTimelineOrder(order)} className="h-8 text-xs underline decoration-dotted">
            История
          </Button>
        </div>
      )
    }
    if (status === 'ARCHIVED') {
        return (
          <div className="flex gap-2">
            <TooltipProvider>
                <Tooltip>
                <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ orderId: order.id, newStatus: 'ARRIVED' })} className="h-8 w-8 p-0">
                    <RotateCcw className="w-4 h-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Вернуть на склад</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <Button size="sm" variant="ghost" onClick={() => setTimelineOrder(order)} className="h-8 text-xs underline decoration-dotted">
                История
            </Button>
          </div>
        )
    }
    return null
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800">
            {status === 'PENDING' ? 'Нужно заказать' : 
             status === 'ORDERED' ? 'Заказано' : 
             status === 'ARRIVED' ? 'На складе' : 'Архив'}
          </h2>
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 w-full md:max-w-xs"
            />
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="overflow-x-auto hidden md:block">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>№ Заказа</TableHead>
                <TableHead>Ткань</TableHead>
                <TableHead>Метраж</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Загрузка...</TableCell></TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Ничего не найдено</TableCell></TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id} className={cn("hover:bg-slate-50", order.comment && "bg-amber-500/5")}>
                    <TableCell className="font-medium cursor-pointer" onClick={() => (status === 'ARRIVED' || status === 'ARCHIVED') && setTimelineOrder(order)}>
                        {order.orderNumber}
                    </TableCell>
                    <TableCell>{order.fabricName}</TableCell>
                    <TableCell>{order.meters} м</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      {order.comment ? (
                         <div className="flex items-center gap-2">
                           <span className="line-clamp-1 max-w-[150px]">{order.comment}</span>
                           <span className="text-amber-600 text-xs font-medium">(есть)</span>
                         </div>
                      ) : <span className="text-slate-400">Нет</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {renderActions(order)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleCopy(order)}><Copy className="mr-2 h-4 w-4" />Копировать</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingComment(order); setCommentText(order.comment || '') }}><Edit2 className="mr-2 h-4 w-4" />Комментарий</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteMutation.mutate(order.id)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" />Удалить</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {isLoading ? (
            <p className="text-center py-8 text-slate-500">Загрузка...</p>
          ) : filteredOrders.length === 0 ? (
            <p className="text-center py-8 text-slate-500">Ничего не найдено</p>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.id} className={cn("p-4 space-y-3", order.comment && "bg-amber-50/50")}>
                <div className="flex justify-between items-start">
                  <div className="space-y-1" onClick={() => (status === 'ARRIVED' || status === 'ARCHIVED') && setTimelineOrder(order)}>
                    <div className="flex items-center gap-2">
                       <span className="font-bold">#{order.orderNumber}</span>
                       {order.comment && <MessageSquare className="w-4 h-4 text-amber-600" />}
                    </div>
                    <p className="text-sm text-slate-600">{order.fabricName}</p>
                    <p className="text-sm font-medium">{order.meters} м</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(order.status)}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCopy(order)}><Copy className="mr-2 h-4 w-4" />Копировать</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditingComment(order); setCommentText(order.comment || '') }}><Edit2 className="mr-2 h-4 w-4" />Комментарий</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteMutation.mutate(order.id)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" />Удалить</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="flex justify-end">
                   {renderActions(order)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={!!editingComment} onOpenChange={() => setEditingComment(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Комментарий</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Введите текст..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingComment(null)}>Отмена</Button>
            <Button onClick={() => commentMutation.mutate()}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderTimelineModal
        order={timelineOrder}
        isOpen={!!timelineOrder}
        onClose={() => setTimelineOrder(null)}
      />
    </div>
  )
}
