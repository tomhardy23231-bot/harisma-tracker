'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Package, Truck, CheckCircle, Archive } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Нужно заказать', icon: Package },
  { href: '/ordered', label: 'Заказано', icon: Truck },
  { href: '/arrived', label: 'На складе', icon: CheckCircle },
  { href: '/archive', label: 'Архив', icon: Archive },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center space-x-1 border-b border-slate-200 px-4 bg-white sticky top-[44px] z-10">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2",
              isActive 
                ? "border-slate-800 text-slate-800" 
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
