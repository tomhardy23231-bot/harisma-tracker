'use client'

import * as React from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useQuery } from "@tanstack/react-query"
import { FabricOrder, OrderStatus } from "./OrderList"
import { Badge } from "./ui/badge"
import { Search } from "lucide-react"
import { OrderTimelineModal } from "./OrderTimelineModal"

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const [selectedOrder, setSelectedOrder] = React.useState<FabricOrder | null>(null)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const { data: orders = [] } = useQuery<FabricOrder[]>({
    queryKey: ['fabric-orders'],
    queryFn: async () => {
      const response = await fetch('/api/fabric-orders')
      if (!response.ok) throw new Error('Failed to fetch orders')
      return response.json()
    },
    enabled: open, // Only fetch when search is opened
  })

  const getStatusBadge = (status: OrderStatus) => {
    const config = {
      PENDING: { label: 'Нужно заказать', color: 'bg-red-500 text-white' },
      ORDERED: { label: 'Заказано', color: 'bg-yellow-500 text-white' },
      ARRIVED: { label: 'На складе', color: 'bg-green-500 text-white' },
      ARCHIVED: { label: 'Архив', color: 'bg-slate-500 text-white' },
    }
    const { label, color } = config[status]
    return <Badge className={`${color} text-[10px] px-1.5 h-4`}>{label}</Badge>
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex items-center justify-start h-9 px-4 py-2 text-sm font-medium transition-colors border rounded-md border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 w-full md:w-64"
      >
        <Search className="w-4 h-4 mr-2" />
        <span>Поиск по заказам...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-white px-1.5 font-mono text-[10px] font-medium opacity-100 md:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Введите номер заказа или название ткани..." />
        <CommandList>
          <CommandEmpty>Ничего не найдено.</CommandEmpty>
          <CommandGroup heading="Заказы">
            {orders.map((order) => (
              <CommandItem
                key={order.id}
                onSelect={() => {
                  setSelectedOrder(order)
                  setOpen(false)
                }}
                className="flex items-center justify-between py-3 cursor-pointer"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-900">#{order.orderNumber}</span>
                  <span className="text-sm text-slate-500">{order.fabricName}</span>
                </div>
                {getStatusBadge(order.status)}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <OrderTimelineModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </>
  )
}
