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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Copy, Edit2, Trash2, Search, MoreHorizontal, MessageSquare, Archive, ArrowRight, RotateCcw } from 'lucide-react'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { updateKeepinCrmStage, getKeepinCrmDeal } from '@/app/actions'
import { OrderTimelineModal } from './OrderTimelineModal'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'

export type OrderStatus = 'PENDING' | 'ORDERED' | 'ARRIVED' | 'ARCHIVED'

export interface FabricOrder {
  id: string
  orderNumber: string
  fabricName: string
  meters: number
  status: OrderStatus
  comment: string | null
  crmId: number | null
  crmTitle: string | null
  crmComment: string | null
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
  const [crmInfoOrder, setCrmInfoOrder] = useState<FabricOrder | null>(null)
  const queryClient = useQueryClient()

  const { data: orders = [], isLoading } = useQuery<FabricOrder[]>({
    queryKey: ['fabric-orders'],
    queryFn: async () => {
      const response = await fetch('/api/fabric-orders')
      if (!response.ok) throw new Error('Failed to fetch orders')
      return response.json()
    }
  })

  const { data: fetchedCrmData, isLoading: isFetchingCrm } = useQuery({
    queryKey: ['crm-deal', crmInfoOrder?.crmId],
    queryFn: () => getKeepinCrmDeal(crmInfoOrder!.crmId!),
    enabled: !!crmInfoOrder && !crmInfoOrder.crmComment && !!crmInfoOrder.crmId,
  });

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
      return { order, newStatus }
    },
    onSuccess: ({ order, newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['fabric-orders'] })
      
      const statusLabels: Record<OrderStatus, string> = {
        PENDING: 'Нужно заказать',
        ORDERED: 'Заказано',
        ARRIVED: 'На складе',
        ARCHIVED: 'Архив'
      }
      
      const icon = newStatus === 'ORDERED' ? '📦' : newStatus === 'ARRIVED' ? '✅' : newStatus === 'ARCHIVED' ? '🗄️' : '🔄'
      
      toast(`${icon} Заказ #${order?.orderNumber} (${order?.fabricName}) успешно перемещен в '${statusLabels[newStatus]}'`)
    },
    onError: (error) => {
      console.error('Error updating status:', error)
      toast.error('Ошибка: Не удалось обновить статус')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/fabric-orders/${orderId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete order')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabric-orders'] })
      toast.success('🗑️ Заказ успешно удален')
    },
    onError: (error) => {
      console.error('Error deleting order:', error)
      toast.error('Ошибка: Не удалось удалить заказ')
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
      toast.success('📝 Комментарий сохранен')
    },
    onError: (error) => {
      console.error('Error saving comment:', error)
      toast.error('Ошибка: Не удалось сохранить комментарий')
    }
  })

  const handleCopy = (order: FabricOrder) => {
    const text = `${order.fabricName} ${order.meters}м (№${order.orderNumber})`
    navigator.clipboard.writeText(text)
    toast.success('📋 Данные заказа скопированы')
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

  // Smart Search Logic
  const filteredOrders = orders
    .filter((order) => {
      if (searchQuery.length === 0) {
        return order.status === status
      }
      
      const search = searchQuery.toLowerCase()
      return (
        order.orderNumber.toLowerCase().includes(search) ||
        order.fabricName.toLowerCase().includes(search) ||
        (order.comment && order.comment.toLowerCase().includes(search))
      )
    })
    .sort((a, b) => parseInt(a.orderNumber) - parseInt(b.orderNumber))

  const renderActions = (order: FabricOrder) => {
    // Actions based on individual order status for global search consistency
    const currentStatus = order.status
    
    if (currentStatus === 'PENDING') {
      return (
        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ orderId: order.id, newStatus: 'ORDERED' })} className="h-8 gap-1">
          <ArrowRight className="w-3 h-3" />
          Заказано
        </Button>
      )
    }
    if (currentStatus === 'ORDERED') {
      return (
        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ orderId: order.id, newStatus: 'ARRIVED' })} className="h-8 gap-1">
          <ArrowRight className="w-3 h-3" />
          На складе
        </Button>
      )
    }
    if (currentStatus === 'ARRIVED') {
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
    if (currentStatus === 'ARCHIVED') {
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

  const getPageTitle = () => {
    if (searchQuery.length > 0) return 'Результаты поиска'
    
    switch(status) {
      case 'PENDING': return 'Нужно заказать'
      case 'ORDERED': return 'Заказано'
      case 'ARRIVED': return 'На складе'
      case 'ARCHIVED': return 'Архив'
      default: return 'Заказы'
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-800">
          {getPageTitle()}
        </h2>
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Поиск по №, ткани или комм..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 w-full md:max-w-xs"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-slate-500 animate-pulse">Загрузка...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 border-dashed p-12 text-center">
          <p className="text-slate-500">Ничего не найдено</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hidden md:block">
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
              <AnimatePresence mode="popLayout">
              {filteredOrders.map((order) => (
              <motion.tr
              layout
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn("hover:bg-slate-50 transition-colors border-b cursor-pointer", order.comment && "bg-amber-500/5")}
              onClick={() => setCrmInfoOrder(order)}
              >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span 
                    className="hover:underline" 
                    onClick={(e) => {
                      if (order.status === 'ARRIVED' || order.status === 'ARCHIVED') {
                        e.stopPropagation();
                        setTimelineOrder(order);
                      }
                    }}
                  >
                    {order.orderNumber}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleCopy(order) }} className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Скопировать заказ</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableCell>
              <TableCell>{order.fabricName}</TableCell>
              <TableCell>{order.meters} м</TableCell>
              <TableCell>{getStatusBadge(order.status)}</TableCell>
              <TableCell>
                {order.comment ? (
                   <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                     <span className="line-clamp-1 max-w-[150px]">{order.comment}</span>
                     <span className="text-amber-600 text-xs font-medium">(есть)</span>
                   </div>
                ) : <span className="text-slate-400">Нет</span>}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  {renderActions(order)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onPointerDown={(e) => e.stopPropagation()}>
                      <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditingComment(order); setCommentText(order.comment || '') }}><Edit2 className="mr-2 h-4 w-4" />Комментарий</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteMutation.mutate(order.id)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" />Удалить</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
              </motion.tr>
              ))}
              </AnimatePresence>
              </TableBody>
              </Table>
              </div>

              {/* Mobile Card View */}
              <div className="grid grid-cols-1 gap-2 md:hidden">
              <AnimatePresence mode="popLayout">
              {filteredOrders.map((order) => (
              <motion.div
              layout
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 flex flex-col gap-1 hover:border-slate-300 transition-colors cursor-pointer"
              onClick={() => setCrmInfoOrder(order)}
              >
              {/* Шапка карточки */}
              <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="font-black text-base text-slate-900 leading-none shrink-0">
                #{order.orderNumber}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleCopy(order) }} className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600 shrink-0">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Скопировать заказ</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="shrink-0 scale-90 origin-left">
                {getStatusBadge(order.status)}
              </div>
              </div>

              <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              {renderActions(order)}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onPointerDown={(e) => e.stopPropagation()}>
                  <Button variant="ghost" className="h-6 w-6 p-0">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditingComment(order); setCommentText(order.comment || '') }}>
                    <Edit2 className="mr-2 h-4 w-4" />Комментарий
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => deleteMutation.mutate(order.id)} className="text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />Удалить
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
              </div>

              {/* Основная информация: Ткань и Метраж */}
              <div 
              className={cn(
              "transition-colors group px-1 py-0.5 rounded-md",
              (order.status === 'ARRIVED' || order.status === 'ARCHIVED') && "hover:bg-slate-50"
              )}
              onClick={(e) => {
              if (order.status === 'ARRIVED' || order.status === 'ARCHIVED') {
                e.stopPropagation();
                setTimelineOrder(order);
              }
              }}
              >
              <h3 className="text-[15px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 leading-tight">
              {order.fabricName}
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
              {order.meters} м
              </p>
              </div>

              {/* Комментарий */}
              {order.comment && (
              <div className="bg-amber-50 border border-amber-100 rounded-md p-1.5 flex gap-1.5 items-start mt-0.5" onClick={(e) => e.stopPropagation()}>
              <MessageSquare className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-900 leading-tight whitespace-pre-wrap line-clamp-2 italic">
                {order.comment}
              </p>
              </div>
              )}
              </motion.div>
              ))}
              </AnimatePresence>
              </div>
              </>
              )}

              <Dialog open={!!crmInfoOrder} onOpenChange={() => setCrmInfoOrder(null)}>
              <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
              <span className="text-slate-500">Заказ #{crmInfoOrder?.orderNumber}</span>
              <span className="text-slate-400">|</span>
              <span>CRM Info</span>
              </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
              <div className="space-y-1">
              <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Оригинальное название</h4>
              <p className="text-lg font-bold text-slate-900">
              {isFetchingCrm ? <Skeleton className="h-7 w-3/4" /> : (crmInfoOrder?.crmTitle || fetchedCrmData?.title || '—')}
              </p>
              </div>

              <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Комментарий из CRM</h4>
              {isFetchingCrm ? (
              <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              </div>
              ) : (
              <div className={cn(
              "p-4 rounded-md border text-sm leading-relaxed whitespace-pre-wrap",
              (crmInfoOrder?.crmComment || fetchedCrmData?.crmComment) 
              ? "bg-slate-50 border-slate-200 text-slate-700" 
              : "bg-slate-50/50 border-slate-100 text-slate-400 italic"
              )}>
              {crmInfoOrder?.crmComment || fetchedCrmData?.crmComment || 'Нет комментария в CRM'}
              </div>
              )}
              </div>

              {crmInfoOrder?.crmId && (
              <div className="pt-2">
              <p className="text-[10px] text-slate-400 text-right uppercase tracking-widest">
              CRM ID: {crmInfoOrder.crmId}
              </p>
              </div>
              )}
              </div>

              <DialogFooter>
              <Button variant="outline" onClick={() => setCrmInfoOrder(null)}>Закрыть</Button>
              </DialogFooter>
              </DialogContent>
              </Dialog>

              <Dialog open={!!editingComment} onOpenChange={() => setEditingComment(null)}>        <DialogContent className="sm:max-w-[425px]">
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
