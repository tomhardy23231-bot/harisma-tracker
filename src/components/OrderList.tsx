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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Copy, Edit2, Trash2, Search, MoreHorizontal, MessageSquare, Archive, ArrowRight, RotateCcw, Package, Ruler, Layers, Sofa, FileText, Hash, Calendar, X, Save, Pencil, Truck, CheckCircle } from 'lucide-react'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { updateKeepinCrmStage, getKeepinCrmDeal } from '@/app/actions'
import { OrderTimelineModal } from './OrderTimelineModal'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'

export type OrderStatus = 'PENDING' | 'ORDERED' | 'ARRIVED' | 'ARCHIVED'

export interface FabricOrder {
  id: string
  orderNumber: string
  fabricName: string
  meters: number
  model: string | null
  modules: string | null
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

type DateFilterField = 'archivedAt' | 'arrivedAt' | 'orderedAt' | 'createdAt'

interface OrderListProps {
  status: OrderStatus
  dateFilterField?: DateFilterField
}

const todayMonthFrom = () => format(startOfMonth(new Date()), 'yyyy-MM-dd')
const todayMonthTo = () => format(endOfMonth(new Date()), 'yyyy-MM-dd')

export function OrderList({ status, dateFilterField }: OrderListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingComment, setEditingComment] = useState<FabricOrder | null>(null)
  const [commentText, setCommentText] = useState('')
  const [timelineOrder, setTimelineOrder] = useState<FabricOrder | null>(null)
  const [crmInfoOrder, setCrmInfoOrder] = useState<FabricOrder | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<FabricOrder | null>(null)
  const [dateFrom, setDateFrom] = useState<string>(() => dateFilterField ? todayMonthFrom() : '')
  const [dateTo, setDateTo] = useState<string>(() => dateFilterField ? todayMonthTo() : '')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    fabricName: '',
    meters: '',
    model: '',
    modules: '',
    comment: '',
    crmComment: '',
  })
  const queryClient = useQueryClient()

  // Reset edit form values when opening a different order (edit mode is controlled by openOrder/closeOrder)
  useEffect(() => {
    if (crmInfoOrder) {
      setEditForm({
        fabricName: crmInfoOrder.fabricName ?? '',
        meters: String(crmInfoOrder.meters ?? ''),
        model: crmInfoOrder.model ?? '',
        modules: crmInfoOrder.modules ?? '',
        comment: crmInfoOrder.comment ?? '',
        crmComment: crmInfoOrder.crmComment ?? '',
      })
    }
  }, [crmInfoOrder?.id])

  const openOrder = (order: FabricOrder, edit = false) => {
    setCrmInfoOrder(order)
    setIsEditing(edit)
  }
  const closeOrder = () => {
    setCrmInfoOrder(null)
    setIsEditing(false)
  }

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

  // Бэкфил CRM-комментария из ленивой подгрузки, если в БД пусто и пользователь ещё не вводил
  useEffect(() => {
    if (!fetchedCrmData?.crmComment) return
    if (crmInfoOrder?.crmComment) return
    setEditForm((prev) => prev.crmComment ? prev : { ...prev, crmComment: fetchedCrmData.crmComment! })
  }, [fetchedCrmData?.crmComment, crmInfoOrder?.crmComment])

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

  const editOrderMutation = useMutation({
    mutationFn: async () => {
      if (!crmInfoOrder) throw new Error('No order')
      const meters = parseFloat(editForm.meters)
      if (!editForm.fabricName.trim()) throw new Error('Ткань обязательна')
      if (!Number.isFinite(meters) || meters <= 0) throw new Error('Метраж должен быть положительным числом')

      const response = await fetch(`/api/fabric-orders/${crmInfoOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fabricName: editForm.fabricName.trim(),
          meters,
          model: editForm.model.trim() || null,
          modules: editForm.modules.trim() || null,
          comment: editForm.comment.trim() || null,
          crmComment: editForm.crmComment.trim() || null,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to save')
      }
      return response.json()
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['fabric-orders'] })
      setCrmInfoOrder(updated)
      setIsEditing(false)
      toast.success('💾 Заказ обновлён')
    },
    onError: (error: Error) => {
      console.error('Error saving order:', error)
      toast.error(error.message || 'Не удалось сохранить')
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

  // Все заказы данного статуса (для счётчика «всего»)
  const totalForStatus = orders.filter((o) => o.status === status).length

  // Smart Search Logic
  const filteredOrders = orders
    .filter((order) => {
      // Глобальный поиск — игнорирует статус и фильтр дат
      if (searchQuery.length > 0) {
        const search = searchQuery.toLowerCase()
        return (
          order.orderNumber.toLowerCase().includes(search) ||
          order.fabricName.toLowerCase().includes(search) ||
          (order.comment && order.comment.toLowerCase().includes(search))
        )
      }

      if (order.status !== status) return false

      // Фильтр по дате — только если задано поле и есть границы
      if (dateFilterField) {
        const raw = order[dateFilterField]
        if (!raw) return false
        const orderDate = new Date(raw)
        if (dateFrom) {
          const from = new Date(`${dateFrom}T00:00:00`)
          if (orderDate < from) return false
        }
        if (dateTo) {
          const to = new Date(`${dateTo}T23:59:59`)
          if (orderDate > to) return false
        }
      }

      return true
    })
    .sort((a, b) => parseInt(a.orderNumber) - parseInt(b.orderNumber))

  const resetDateFilter = () => {
    setDateFrom(todayMonthFrom())
    setDateTo(todayMonthTo())
  }
  const clearDateFilter = () => {
    setDateFrom('')
    setDateTo('')
  }

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

  const isDateFilterActive = !!dateFilterField && searchQuery.length === 0

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            {getPageTitle()}
            <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-mono">
              {filteredOrders.length}
              {isDateFilterActive && totalForStatus !== filteredOrders.length && (
                <span className="text-slate-400 ml-1">/ {totalForStatus}</span>
              )}
            </Badge>
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

        {isDateFilterActive && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Период</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 w-[150px] text-sm"
              />
              <span className="text-slate-400 text-sm">—</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 w-[150px] text-sm"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={resetDateFilter} className="h-8 text-xs">
              Текущий месяц
            </Button>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={clearDateFilter} className="h-8 text-xs text-slate-500">
                <X className="w-3 h-3 mr-1" />
                Сбросить
              </Button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <OrdersSkeleton />
      ) : filteredOrders.length === 0 ? (
        <EmptyState status={status} hasSearch={searchQuery.length > 0} />
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
                  <TableHead>Модель</TableHead>
                  <TableHead>Модули</TableHead>
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
              onClick={() => openOrder(order)}
              >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{order.orderNumber}</span>                  <TooltipProvider>
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
              <TableCell className="text-sm text-slate-700">
                {order.model ? <span className="line-clamp-1 max-w-[160px]">{order.model}</span> : <span className="text-slate-300">—</span>}
              </TableCell>
              <TableCell className="text-sm text-slate-700">
                {order.modules ? <span className="line-clamp-1 max-w-[200px]">{order.modules}</span> : <span className="text-slate-300">—</span>}
              </TableCell>
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
                      <DropdownMenuItem onClick={() => openOrder(order, true)}><Pencil className="mr-2 h-4 w-4" />Редактировать</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditingComment(order); setCommentText(order.comment || '') }}><Edit2 className="mr-2 h-4 w-4" />Только комментарий</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteCandidate(order)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" />Удалить</DropdownMenuItem>
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
              className="bg-white rounded-xl border border-slate-200 shadow-md hover:shadow-lg p-2 flex flex-col gap-1 hover:border-slate-300 transition-all cursor-pointer"
              onClick={() => openOrder(order)}
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
                  <DropdownMenuItem onClick={() => openOrder(order, true)}>
                    <Pencil className="mr-2 h-4 w-4" />Редактировать
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setEditingComment(order); setCommentText(order.comment || '') }}>
                    <Edit2 className="mr-2 h-4 w-4" />Только комментарий
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeleteCandidate(order)} className="text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />Удалить
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
              </div>

              {/* Основная информация: Ткань и Метраж */}
              <div className="transition-colors group px-1 py-0.5 rounded-md">              <h3 className="text-[15px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 leading-tight">
              {order.fabricName}
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
              {order.meters} м
              </p>
              {(order.model || order.modules) && (
                <div className="mt-1 space-y-0.5">
                  {order.model && (
                    <p className="text-[11px] text-slate-700 leading-tight">
                      <span className="text-slate-400">Модель:</span> <span className="font-medium">{order.model}</span>
                    </p>
                  )}
                  {order.modules && (
                    <p className="text-[11px] text-slate-700 leading-tight">
                      <span className="text-slate-400">Модули:</span> <span className="font-medium">{order.modules}</span>
                    </p>
                  )}
                </div>
              )}
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

              <Dialog open={!!crmInfoOrder} onOpenChange={(open) => { if (!open) closeOrder() }}>
                <DialogContent showCloseButton={false} className="sm:max-w-[560px] p-0 overflow-hidden gap-0 bg-slate-100 border-slate-300">
                  {/* Header */}
                  <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <DialogTitle className="flex items-center gap-2.5 text-base">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-sm">
                            <Hash className="w-3.5 h-3.5" />
                            {crmInfoOrder?.orderNumber}
                          </span>
                          <span className="text-slate-400 font-normal">·</span>
                          {crmInfoOrder && getStatusBadge(crmInfoOrder.status)}
                        </DialogTitle>
                        <p className="text-base font-semibold text-slate-900 leading-snug">
                          {isFetchingCrm
                            ? <Skeleton className="h-5 w-3/4" />
                            : (crmInfoOrder?.crmTitle || fetchedCrmData?.title || '—')}
                        </p>
                      </div>
                      {!isEditing && crmInfoOrder && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditing(true)}
                          className="shrink-0 h-8 gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Редактировать
                        </Button>
                      )}
                    </div>
                  </DialogHeader>

                  {/* Body */}
                  <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
                    {/* Параметры заказа */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {isEditing ? (
                        <>
                          <EditableFieldRow icon={<Package className="w-4 h-4" />} label="Ткань *"
                            value={editForm.fabricName}
                            onChange={(v) => setEditForm((p) => ({ ...p, fabricName: v }))} />
                          <EditableFieldRow icon={<Ruler className="w-4 h-4" />} label="Метраж *"
                            value={editForm.meters} type="number" step="0.1" suffix="м"
                            onChange={(v) => setEditForm((p) => ({ ...p, meters: v }))} />
                          <EditableFieldRow icon={<Sofa className="w-4 h-4" />} label="Модель"
                            value={editForm.model}
                            onChange={(v) => setEditForm((p) => ({ ...p, model: v }))} />
                          <EditableFieldRow icon={<Layers className="w-4 h-4" />} label="Модули"
                            value={editForm.modules}
                            onChange={(v) => setEditForm((p) => ({ ...p, modules: v }))} />
                        </>
                      ) : (
                        <>
                          <FieldRow icon={<Package className="w-4 h-4" />} label="Ткань" value={crmInfoOrder?.fabricName} valueClass="font-semibold text-slate-900" />
                          <FieldRow icon={<Ruler className="w-4 h-4" />} label="Метраж" value={crmInfoOrder ? `${crmInfoOrder.meters} м` : null} />
                          <FieldRow icon={<Sofa className="w-4 h-4" />} label="Модель" value={crmInfoOrder?.model} />
                          <FieldRow icon={<Layers className="w-4 h-4" />} label="Модули" value={crmInfoOrder?.modules} />
                        </>
                      )}
                    </div>

                    {/* Комментарий из CRM */}
                    <section className="space-y-1.5">
                      <h4 className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <FileText className="w-3.5 h-3.5" />
                        Комментарий из CRM
                      </h4>
                      {isEditing ? (
                        <Textarea
                          value={editForm.crmComment}
                          onChange={(e) => setEditForm((p) => ({ ...p, crmComment: e.target.value }))}
                          placeholder="Комментарий из CRM…"
                          rows={5}
                          className="resize-y bg-white border-slate-300 focus-visible:ring-slate-400 text-slate-900 leading-relaxed shadow-sm"
                        />
                      ) : isFetchingCrm ? (
                        <div className="space-y-2 p-3 rounded-md border border-slate-300 bg-white shadow-sm">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-5/6" />
                          <Skeleton className="h-3 w-2/3" />
                        </div>
                      ) : (
                        <div className={cn(
                          "p-3 rounded-md border text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
                          (crmInfoOrder?.crmComment || fetchedCrmData?.crmComment)
                            ? "bg-white border-slate-300 text-slate-900"
                            : "bg-slate-50 border-slate-300 border-dashed text-slate-500 italic text-center py-4"
                        )}>
                          {crmInfoOrder?.crmComment || fetchedCrmData?.crmComment || 'Нет комментария в CRM'}
                        </div>
                      )}
                    </section>

                    {/* Внутренний комментарий */}
                    <section className="space-y-1.5">
                      <h4 className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Внутренний комментарий
                      </h4>
                      {isEditing ? (
                        <Textarea
                          value={editForm.comment}
                          onChange={(e) => setEditForm((p) => ({ ...p, comment: e.target.value }))}
                          placeholder="Заметка по заказу…"
                          rows={3}
                          className="resize-none bg-amber-50 border-amber-300 focus-visible:ring-amber-400 text-amber-950 shadow-sm"
                        />
                      ) : crmInfoOrder?.comment ? (
                        <div className="p-3 rounded-md border border-amber-300 bg-amber-50 text-sm leading-relaxed whitespace-pre-wrap text-amber-950 shadow-sm">
                          {crmInfoOrder.comment}
                        </div>
                      ) : (
                        <div className="p-3 rounded-md border border-dashed border-amber-300 bg-amber-50/40 text-sm text-amber-800/70 italic text-center">
                          Нет внутреннего комментария
                        </div>
                      )}
                    </section>
                  </div>

                  {/* Footer */}
                  <DialogFooter className="px-6 py-3 bg-slate-200 border-t border-slate-300 sm:justify-between sm:items-center gap-2">
                    {crmInfoOrder?.crmId ? (
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                        CRM ID · {crmInfoOrder.crmId}
                      </span>
                    ) : <span />}
                    {isEditing ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (crmInfoOrder) {
                              setEditForm({
                                fabricName: crmInfoOrder.fabricName ?? '',
                                meters: String(crmInfoOrder.meters ?? ''),
                                model: crmInfoOrder.model ?? '',
                                modules: crmInfoOrder.modules ?? '',
                                comment: crmInfoOrder.comment ?? '',
                                crmComment: crmInfoOrder.crmComment ?? '',
                              })
                            }
                            setIsEditing(false)
                          }}
                          disabled={editOrderMutation.isPending}
                        >
                          Отмена
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => editOrderMutation.mutate()}
                          disabled={editOrderMutation.isPending}
                          className="gap-1.5 bg-slate-900 hover:bg-slate-800"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {editOrderMutation.isPending ? 'Сохранение…' : 'Сохранить'}
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={closeOrder}>Закрыть</Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>

      <Dialog open={!!editingComment} onOpenChange={() => setEditingComment(null)}>
        <DialogContent className="sm:max-w-[425px] bg-slate-100 border-slate-300">
          <DialogHeader>
            <DialogTitle>Комментарий</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Введите текст..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={4}
              className="bg-white"
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

      <AlertDialog open={!!deleteCandidate} onOpenChange={(open) => { if (!open) setDeleteCandidate(null) }}>
        <AlertDialogContent className="bg-slate-100 border-slate-300">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-red-100 text-red-600 shrink-0">
                <Trash2 className="w-4 h-4" />
              </span>
              Удалить заказ?
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-1">
              Заказ{' '}
              <span className="font-semibold text-slate-800">#{deleteCandidate?.orderNumber}</span>{' '}
              <span className="text-slate-700">({deleteCandidate?.fabricName}, {deleteCandidate?.meters} м)</span>{' '}
              будет удалён без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCandidate) {
                  deleteMutation.mutate(deleteCandidate.id)
                  setDeleteCandidate(null)
                }
              }}
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface FieldRowProps {
  icon: React.ReactNode
  label: string
  value?: string | number | null
  valueClass?: string
}

function FieldRow({ icon, label, value, valueClass }: FieldRowProps) {
  const hasValue = value !== null && value !== undefined && value !== ''
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-md bg-white border border-slate-300 shadow-sm">
      <div className="text-slate-500 mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 leading-none mb-1">
          {label}
        </div>
        <div className={cn(
          "text-sm leading-tight break-words",
          hasValue ? (valueClass ?? "text-slate-900 font-medium") : "text-slate-400 italic"
        )}>
          {hasValue ? value : '—'}
        </div>
      </div>
    </div>
  )
}

function OrdersSkeleton() {
  return (
    <>
      {/* Desktop */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hidden md:block">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>№ Заказа</TableHead>
              <TableHead>Ткань</TableHead>
              <TableHead>Метраж</TableHead>
              <TableHead>Модель</TableHead>
              <TableHead>Модули</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Комментарий</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 1, 2, 3, 4].map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-7 w-24 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
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

interface EmptyStateProps {
  status: OrderStatus
  hasSearch: boolean
}

function EmptyState({ status, hasSearch }: EmptyStateProps) {
  const config: Record<OrderStatus, { icon: typeof Package; title: string; subtitle: string; tone: string }> = {
    PENDING: {
      icon: Package,
      title: 'Нет заказов в работе',
      subtitle: 'Создайте первый заказ через форму выше — вставьте ID сделки из CRM',
      tone: 'text-red-500 bg-red-50',
    },
    ORDERED: {
      icon: Truck,
      title: 'Нет заказанных тканей',
      subtitle: 'Перенесите заказ из «Нужно заказать», и он появится здесь',
      tone: 'text-yellow-600 bg-yellow-50',
    },
    ARRIVED: {
      icon: CheckCircle,
      title: 'Склад пуст',
      subtitle: 'Здесь будут заказы, прибывшие на склад',
      tone: 'text-emerald-600 bg-emerald-50',
    },
    ARCHIVED: {
      icon: Archive,
      title: 'Архив пуст',
      subtitle: 'Заказы попадают сюда после архивации',
      tone: 'text-slate-500 bg-slate-100',
    },
  }
  const c = config[status]
  const Icon = hasSearch ? Search : c.icon

  return (
    <div className="bg-white rounded-xl border border-slate-300 border-dashed p-12 flex flex-col items-center justify-center gap-3 text-center">
      <div className={cn("w-14 h-14 rounded-full flex items-center justify-center", hasSearch ? "text-slate-400 bg-slate-100" : c.tone)}>
        <Icon className="w-7 h-7" />
      </div>
      <div className="max-w-xs">
        <p className="text-base font-semibold text-slate-800">
          {hasSearch ? 'Ничего не найдено' : c.title}
        </p>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          {hasSearch ? 'Попробуйте изменить запрос или сбросить поиск' : c.subtitle}
        </p>
      </div>
    </div>
  )
}

interface EditableFieldRowProps {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  step?: string
  suffix?: string
}

function EditableFieldRow({ icon, label, value, onChange, type = 'text', step, suffix }: EditableFieldRowProps) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-md bg-white border border-slate-300 ring-1 ring-slate-300/40 shadow-sm">
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
            className="h-7 px-1.5 py-0 text-sm border-0 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 bg-transparent"
          />
          {suffix && <span className="text-xs text-slate-400 shrink-0">{suffix}</span>}
        </div>
      </div>
    </div>
  )
}
