'use client'

import { useEffect, useState } from 'react'
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
import { Copy, Edit2, Trash2, Plus, Search } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getKeepinCrmDeal, updateKeepinCrmStage } from '@/app/actions'

type OrderStatus = 'PENDING' | 'ORDERED' | 'ARRIVED'

interface FabricOrder {
  id: string
  orderNumber: string
  fabricName: string
  meters: number
  status: OrderStatus
  comment: string | null
  crmId: number | null
  funnelId: number | null
  createdAt: string
  updatedAt: string
}

interface NewOrder {
  crmId: string
  fabricName: string
  meters: string
}

export default function Home() {
  const [orders, setOrders] = useState<FabricOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [newOrder, setNewOrder] = useState<NewOrder>({
    crmId: '',
    fabricName: '',
    meters: '',
  })
  const [editingComment, setEditingComment] = useState<FabricOrder | null>(null)
  const [commentText, setCommentText] = useState('')
  const { toast } = useToast()
  const [crmOrderTitle, setCrmOrderTitle] = useState<string | null>(null)
  const [funnelId, setFunnelId] = useState<number | null>(null)
  const [isFetchingCrm, setIsFetchingCrm] = useState(false)
  const [orderNumber, setOrderNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/fabric-orders')
      const data = await response.json()
      setOrders(data)
    } catch (error) {
      console.error('Error fetching orders:', error)
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось загрузить заказы',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFetchCrmDeal = async () => {
    if (!newOrder.crmId) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Введите ID заказа из CRM',
      })
      return
    }
    setIsFetchingCrm(true)
    try {
      const deal = await getKeepinCrmDeal(parseInt(newOrder.crmId, 10))
      setCrmOrderTitle(deal.title)
      setFunnelId(deal.funnelId)
      setOrderNumber(deal.orderNumber)
      toast({
        title: 'Успешно',
        description: `Найден заказ: ${deal.title}`,
      })
    } catch (error) {
      console.error('Error fetching CRM deal:', error)
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось найти заказ в CRM',
      })
      setCrmOrderTitle(null)
      setFunnelId(null)
    } finally {
      setIsFetchingCrm(false)
    }
  }

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrder.crmId || !newOrder.fabricName || !newOrder.meters) {
      toast({ variant: 'destructive', title: 'Ошибка', description: 'Заполните все видимые поля' })
      return
    }
    
    if (funnelId === null || funnelId === undefined) {
      toast({ 
        variant: 'destructive', 
        title: 'Ошибка данных CRM', 
        description: 'Не удалось получить ID воронки (funnel_id) из CRM. Посмотрите логи сервера.' 
      })
      console.error("❌ Validation failed: funnelId is missing", { funnelId, crmOrderTitle })
      return
    }

    setSubmitting(true)
    try {
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

      if (response.ok) {
        await fetchOrders()
        setNewOrder({ crmId: '', fabricName: '', meters: '' })
        setCrmOrderTitle(null)
        setFunnelId(null)
        toast({
          title: 'Успешно',
          description: 'Заказ добавлен',
        })
      } else {
        const errorText = await response.text();
        console.error("Failed to create order:", errorText);
        throw new Error('Failed to create order')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось добавить заказ',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    if (newStatus === 'ORDERED') {
      const order = orders.find((o) => o.id === orderId)
      if (order && order.crmId && order.funnelId) {
        try {
          await updateKeepinCrmStage(order.crmId, order.funnelId)
          console.log(`Successfully updated CRM stage for order ${order.orderNumber}`)
        } catch (error) {
          console.error(`Failed to update CRM stage for order ${order.orderNumber}:`, error)
          toast({
            variant: 'destructive',
            title: 'Ошибка CRM',
            description: 'Не удалось обновить стадию в CRM.',
          })
        }
      }
    }

    try {
      const response = await fetch(`/api/fabric-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        await fetchOrders()
        toast({
          title: 'Успешно',
          description: 'Статус обновлен',
        })
      } else {
        const errorText = await response.text();
        console.error("Failed to update status:", errorText);
        throw new Error('Failed to update status')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось обновить статус',
      })
    }
  }

  const handleCopy = (order: FabricOrder) => {
    const text = `${order.fabricName} ${order.meters}м (№${order.orderNumber})`
    navigator.clipboard.writeText(text)
    toast({
      title: 'Скопировано!',
    })
  }

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const response = await fetch(`/api/fabric-orders/${orderId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchOrders()
        toast({
          title: 'Успешно',
          description: 'Заказ удален',
        })
      } else {
        throw new Error('Failed to delete order')
      }
    } catch (error) {
      console.error('Error deleting order:', error)
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось удалить заказ',
      })
    }
  }

  const handleOpenComment = (order: FabricOrder) => {
    setEditingComment(order)
    setCommentText(order.comment || '')
  }

  const handleSaveComment = async () => {
    if (!editingComment) return

    try {
      const response = await fetch(`/api/fabric-orders/${editingComment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: commentText }),
      })

      if (response.ok) {
        await fetchOrders()
        setEditingComment(null)
        setCommentText('')
        toast({
          title: 'Успешно',
          description: 'Комментарий сохранен',
        })
      } else {
        const errorText = await response.text();
        console.error("Failed to save comment:", errorText);
        throw new Error('Failed to save comment')
      }
    } catch (error) {
      console.error('Error saving comment:', error)
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось сохранить комментарий',
      })
    }
  }

  const getStatusBadge = (status: OrderStatus) => {
    const config = {
      PENDING: { label: 'Нужно заказать', variant: 'destructive' as const },
      ORDERED: { label: 'Заказано', variant: 'default' as const },
      ARRIVED: { label: 'На складе', variant: 'default' as const },
    }
    const { label, variant } = config[status]
    
    return (
      <Badge 
        variant={variant}
        className={
          status === 'PENDING' 
            ? 'bg-red-500 hover:bg-red-600' 
            : status === 'ORDERED' 
            ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
            : 'bg-green-500 hover:bg-green-600'
        }
      >
        {label}
      </Badge>
    )
  }

  const getNextStatus = (currentStatus: OrderStatus): OrderStatus => {
    switch (currentStatus) {
      case 'PENDING':
        return 'ORDERED'
      case 'ORDERED':
        return 'ARRIVED'
      case 'ARRIVED':
        return 'PENDING'
      default:
        return 'PENDING'
    }
  }

  const getNextStatusLabel = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'Отметить как заказанное'
      case 'ORDERED':
        return 'Отметить как на складе'
      case 'ARRIVED':
        return 'Вернуть к нужно заказать'
      default:
        return ''
    }
  }

  const filteredOrders = orders.filter(
    (order) =>
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.fabricName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-2 flex items-baseline gap-x-2">
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">
            HARISMA
          </h1>
          <p className="text-xs text-slate-500">Система отслеживания тканей</p>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-4">
        <div className="space-y-3">
          {/* Input Form */}
          <div className="bg-white rounded-xl shadow-lg p-3 border border-slate-200">
            <form onSubmit={handleAddOrder} className="flex items-end gap-2 flex-wrap">
              <div className="flex-grow min-w-[150px]">
                <div className="flex gap-2">
                  <Input
                    id="crmId"
                    type="text"
                    placeholder="ID из CRM"
                    value={newOrder.crmId}
                    onChange={(e) => setNewOrder({ ...newOrder, crmId: e.target.value })}
                    disabled={submitting || isFetchingCrm}
                    className="h-9"
                  />
                  <Button
                    type="button"
                    onClick={handleFetchCrmDeal}
                    disabled={submitting || isFetchingCrm}
                    className="h-9"
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
                  disabled={submitting}
                  className="h-9"
                />
              </div>
              <div className="flex-grow min-w-[100px] max-w-[120px]">
                <Input
                  id="meters"
                  type="number"
                  step="0.1"
                  placeholder="Метраж"
                  value={newOrder.meters}
                  onChange={(e) => setNewOrder({ ...newOrder, meters: e.target.value })}
                  disabled={submitting}
                  className="h-9"
                />
              </div>
              <Button 
                type="submit" 
                className="h-9 bg-slate-800 hover:bg-slate-900 flex-grow sm:flex-grow-0"
                disabled={submitting || isFetchingCrm || !crmOrderTitle}
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </form>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-800">
                Все заказы
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Поиск по номеру или ткани..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 max-w-xs"
                />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-50 z-10">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700">Номер заказа</TableHead>
                    <TableHead className="font-semibold text-slate-700">Название ткани</TableHead>
                    <TableHead className="font-semibold text-slate-700">Метраж</TableHead>
                    <TableHead className="font-semibold text-slate-700">Статус</TableHead>
                    <TableHead className="font-semibold text-slate-700">Комментарий</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        Загрузка...
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        {orders.length === 0 ? 'Нет заказов' : 'Ничего не найдено'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow 
                        key={order.id} 
                        className={order.comment ? 'bg-amber-500/10 hover:bg-amber-500/20' : ''}
                      >
                        <TableCell className="font-medium text-slate-800">{order.orderNumber}</TableCell>
                        <TableCell className="text-slate-700">{order.fabricName}</TableCell>
                        <TableCell className="text-slate-700">{order.meters} м</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(order.status)}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleStatusChange(order.id, getNextStatus(order.status))}
                                    className="h-7 text-xs"
                                  >
                                    {getNextStatusLabel(order.status)}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Нажмите, чтобы изменить статус</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {order.comment ? (
                            <div className="flex items-center gap-2">
                              <span className="line-clamp-1 max-w-[200px]">{order.comment}</span>
                              <span className="text-amber-600 text-xs font-medium">(есть комментарий)</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">Нет</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleCopy(order)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Скопировать</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleOpenComment(order)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Редактировать комментарий</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteOrder(order.id)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Удалить</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </main>

      {/* Comment Modal */}
      <Dialog open={!!editingComment} onOpenChange={() => setEditingComment(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Редактировать комментарий
            </DialogTitle>
            <DialogDescription>
              Добавьте или измените комментарий для заказа {editingComment?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Введите комментарий..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setEditingComment(null)
                setCommentText('')
              }}
            >
              Отмена
            </Button>
            <Button onClick={handleSaveComment}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
