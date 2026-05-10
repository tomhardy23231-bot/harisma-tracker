'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Package, Truck, CheckCircle, Archive, BarChart3 } from 'lucide-react'
import type { OrderStatus } from './OrderList'

interface FabricOrderLite { status: OrderStatus }

interface NavItem { href: string; label: string; icon: typeof Package; status?: OrderStatus }

const navItems: NavItem[] = [
  { href: '/', label: 'Нужно заказать', icon: Package, status: 'PENDING' },
  { href: '/ordered', label: 'Заказано', icon: Truck, status: 'ORDERED' },
  { href: '/arrived', label: 'На складе', icon: CheckCircle, status: 'ARRIVED' },
  { href: '/archive', label: 'Архив', icon: Archive, status: 'ARCHIVED' },
  { href: '/dashboard', label: 'Аналитика', icon: BarChart3 },
]

export function Navigation() {
  const pathname = usePathname()

  const { data: orders = [] } = useQuery<FabricOrderLite[]>({
    queryKey: ['fabric-orders'],
    queryFn: async () => {
      const response = await fetch('/api/fabric-orders')
      if (!response.ok) return []
      return response.json()
    },
    refetchOnWindowFocus: false,
  })

  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {})

  return (
    <nav className="flex items-center space-x-1 border-b border-slate-200 px-4 bg-white sticky top-[44px] z-10 overflow-x-auto">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        const count = item.status ? counts[item.status] ?? 0 : null

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 shrink-0",
              isActive
                ? "border-slate-800 text-slate-800"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{item.label}</span>
            {count !== null && (
              <span className={cn(
                "inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-full text-[11px] font-semibold tabular-nums leading-none",
                isActive
                  ? "bg-slate-800 text-white"
                  : count > 0
                    ? "bg-slate-200 text-slate-700"
                    : "bg-slate-100 text-slate-400"
              )}>
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
