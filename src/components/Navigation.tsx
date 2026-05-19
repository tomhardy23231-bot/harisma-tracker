'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Package, Truck, CheckCircle, Archive, BarChart3, Inbox } from 'lucide-react'
import type { OrderStatus } from './OrderList'

interface FabricOrderLite { status: OrderStatus }

interface NavItem {
  href: string
  label: string
  shortLabel: string
  icon: typeof Package
  status?: OrderStatus
  countKey?: 'UNSORTED'
}

const navItems: NavItem[] = [
  { href: '/unsorted', label: 'Не разобранные', shortLabel: 'Импорт', icon: Inbox, countKey: 'UNSORTED' },
  { href: '/', label: 'Нужно заказать', shortLabel: 'Заказать', icon: Package, status: 'PENDING' },
  { href: '/ordered', label: 'Заказано', shortLabel: 'Заказано', icon: Truck, status: 'ORDERED' },
  { href: '/arrived', label: 'На складе', shortLabel: 'Склад', icon: CheckCircle, status: 'ARRIVED' },
  { href: '/archive', label: 'Архив', shortLabel: 'Архив', icon: Archive, status: 'ARCHIVED' },
  { href: '/dashboard', label: 'Аналитика', shortLabel: 'Аналитика', icon: BarChart3 },
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

  const { data: unsorted = [] } = useQuery<Array<{ id: string }>>({
    queryKey: ['unsorted-deals'],
    queryFn: async () => {
      const response = await fetch('/api/unsorted')
      if (!response.ok) return []
      return response.json()
    },
    refetchOnWindowFocus: false,
  })

  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {})
  const unsortedCount = unsorted.length

  return (
    <>
      {/* Десктоп: верхняя навигация */}
      <nav className="hidden md:flex items-center space-x-1 border-b border-slate-200 px-4 bg-white sticky top-[44px] z-10 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          const count = item.countKey === 'UNSORTED'
            ? unsortedCount
            : item.status ? counts[item.status] ?? 0 : null

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
              <span>{item.label}</span>
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

      {/* Мобайл: нижняя навигация */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(15,23,42,0.06)] z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch justify-around px-1 py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const count = item.countKey === 'UNSORTED'
              ? unsortedCount
              : item.status ? counts[item.status] ?? 0 : null

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-end flex-1 min-w-0 gap-1 py-1"
              >
                <div className={cn(
                  "relative flex items-center justify-center transition-all rounded-full",
                  isActive
                    ? "bg-emerald-500 text-white px-5 py-1.5 shadow-sm"
                    : "text-slate-500 px-2 py-1"
                )}>
                  <Icon className="w-[18px] h-[18px]" />
                  {count !== null && count > 0 && !isActive && (
                    <span className="absolute -top-1 -right-1.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold leading-none tabular-nums">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] leading-none truncate max-w-full px-0.5",
                  isActive ? "text-emerald-600 font-semibold" : "text-slate-500 font-medium"
                )}>
                  {item.shortLabel}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
