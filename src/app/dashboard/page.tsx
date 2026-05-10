'use client'

import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts'
import {
  Package, Truck, CheckCircle, Archive, Layers, Clock, AlertTriangle,
  TrendingUp, Sparkles, Ruler,
} from 'lucide-react'
import {
  startOfMonth, format, parseISO, differenceInDays, subMonths, isAfter,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { FabricOrder } from '@/components/OrderList'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#ef4444',
  ORDERED: '#eab308',
  ARRIVED: '#10b981',
  ARCHIVED: '#64748b',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Нужно заказать',
  ORDERED: 'Заказано',
  ARRIVED: 'На складе',
  ARCHIVED: 'Архив',
}

const STATUS_HREFS: Record<string, string> = {
  PENDING: '/',
  ORDERED: '/ordered',
  ARRIVED: '/arrived',
  ARCHIVED: '/archive',
}

const STUCK_DAYS = {
  PENDING: 7,   // в "нужно заказать" висит больше недели
  ORDERED: 21,  // заказано больше 3 недель — должно было прийти
  ARRIVED: 30,  // на складе больше месяца — наверное забыли архивировать
}

export default function DashboardPage() {
  const { data: orders = [], isLoading } = useQuery<FabricOrder[]>({
    queryKey: ['fabric-orders'],
    queryFn: async () => {
      const r = await fetch('/api/fabric-orders')
      if (!r.ok) throw new Error('Failed to fetch')
      return r.json()
    },
  })

  if (isLoading) {
    return <DashboardSkeleton />
  }

  // ============ KPI ============
  const total = orders.length
  const active = orders.filter(o => o.status !== 'ARCHIVED').length
  const archived = orders.filter(o => o.status === 'ARCHIVED').length

  const now = new Date()
  const monthStart = startOfMonth(now)
  const ordersThisMonth = orders.filter(o => isAfter(parseISO(o.createdAt), monthStart))
  const metersThisMonth = ordersThisMonth.reduce((s, o) => s + (o.meters || 0), 0)

  // Среднее время от создания до архивации (по архивированным)
  const archivedWithDates = orders.filter(o => o.status === 'ARCHIVED' && o.archivedAt)
  const avgLeadDays = archivedWithDates.length > 0
    ? archivedWithDates.reduce((s, o) => s + differenceInDays(parseISO(o.archivedAt!), parseISO(o.createdAt)), 0) / archivedWithDates.length
    : null

  // ============ Распределение по статусам ============
  const byStatusActive = (['PENDING', 'ORDERED', 'ARRIVED'] as const).map(s => ({
    name: STATUS_LABELS[s],
    status: s,
    value: orders.filter(o => o.status === s).length,
    color: STATUS_COLORS[s],
  })).filter(x => x.value > 0)

  // ============ Тренд по месяцам (последние 6 месяцев) ============
  const monthsData = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    const start = startOfMonth(d)
    const end = startOfMonth(subMonths(d, -1))
    const monthOrders = orders.filter(o => {
      const created = parseISO(o.createdAt)
      return created >= start && created < end
    })
    return {
      month: format(d, 'LLL', { locale: ru }),
      orders: monthOrders.length,
      meters: Math.round(monthOrders.reduce((s, o) => s + (o.meters || 0), 0)),
    }
  })

  // ============ Топ тканей ============
  const fabricMap = new Map<string, { meters: number; count: number }>()
  for (const o of orders) {
    const key = (o.fabricName || '').trim()
    if (!key) continue
    const cur = fabricMap.get(key) ?? { meters: 0, count: 0 }
    cur.meters += o.meters || 0
    cur.count += 1
    fabricMap.set(key, cur)
  }
  const topFabrics = Array.from(fabricMap.entries())
    .map(([name, v]) => ({ name, meters: Math.round(v.meters * 10) / 10, count: v.count }))
    .sort((a, b) => b.meters - a.meters)
    .slice(0, 8)

  // ============ Зависшие ============
  const stuck = orders.flatMap(o => {
    if (o.status === 'ARCHIVED') return []
    const limit = STUCK_DAYS[o.status as keyof typeof STUCK_DAYS]
    const refDate = o.status === 'PENDING' ? o.createdAt
      : o.status === 'ORDERED' ? (o.orderedAt ?? o.createdAt)
      : (o.arrivedAt ?? o.createdAt)
    const days = differenceInDays(now, parseISO(refDate))
    if (days >= limit) {
      return [{ ...o, daysStuck: days, limit }]
    }
    return []
  }).sort((a, b) => b.daysStuck - a.daysStuck).slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">Аналитика</h1>
          <p className="text-sm text-slate-600">Обзор работы по заказам тканей</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Layers className="w-5 h-5" />}
          label="Всего заказов"
          value={total}
          tone="bg-slate-100 text-slate-700"
        />
        <KpiCard
          icon={<Clock className="w-5 h-5" />}
          label="В работе"
          value={active}
          hint={`${archived} в архиве`}
          tone="bg-blue-100 text-blue-700"
        />
        <KpiCard
          icon={<Ruler className="w-5 h-5" />}
          label="Метров за месяц"
          value={`${metersThisMonth.toFixed(1)} м`}
          hint={`${ordersThisMonth.length} заказ(ов)`}
          tone="bg-emerald-100 text-emerald-700"
        />
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Среднее время"
          value={avgLeadDays !== null ? `${avgLeadDays.toFixed(1)} дн` : '—'}
          hint="от создания до архива"
          tone="bg-violet-100 text-violet-700"
        />
      </div>

      {/* Status pie + Monthly trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="По статусам (активные)" icon={<Layers className="w-4 h-4" />}>
          {byStatusActive.length === 0 ? (
            <EmptyChart text="Нет активных заказов" />
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={byStatusActive}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {byStatusActive.map((d) => (
                      <Cell key={d.status} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'white',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 sm:min-w-[180px]">
                {byStatusActive.map((d) => (
                  <Link
                    key={d.status}
                    href={STATUS_HREFS[d.status]}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
                      <span className="text-sm text-slate-700">{d.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">{d.value}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Заказы по месяцам" icon={<TrendingUp className="w-4 h-4" />}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="fillOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f172a" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  fontSize: 13,
                }}
                formatter={(v: number, name: string) => [v, name === 'orders' ? 'Заказов' : 'Метров']}
              />
              <Area
                type="monotone"
                dataKey="orders"
                stroke="#0f172a"
                strokeWidth={2}
                fill="url(#fillOrders)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top fabrics */}
      <Card title="Топ тканей по метражу" icon={<Package className="w-4 h-4" />}>
        {topFabrics.length === 0 ? (
          <EmptyChart text="Нет данных" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, topFabrics.length * 32)}>
            <BarChart data={topFabrics} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: '#334155' }}
                axisLine={false}
                tickLine={false}
                width={140}
              />
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  fontSize: 13,
                }}
                formatter={(v: number, _: string, p: any) => [`${v} м (${p.payload.count} зак.)`, 'Метраж']}
              />
              <Bar dataKey="meters" fill="#0f172a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Stuck orders */}
      <Card
        title="Зависшие заказы"
        icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
        subtitle={`PENDING > ${STUCK_DAYS.PENDING} дн · ORDERED > ${STUCK_DAYS.ORDERED} дн · ARRIVED > ${STUCK_DAYS.ARRIVED} дн`}
      >
        {stuck.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-slate-500 text-sm gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Всё в норме — зависших заказов нет
          </div>
        ) : (
          <div className="space-y-1.5">
            {stuck.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200"
              >
                <div className="font-mono text-sm font-semibold text-slate-900 shrink-0">
                  #{o.orderNumber}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: STATUS_COLORS[o.status] }}
                  />
                  <span className="text-xs text-slate-600">{STATUS_LABELS[o.status]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-700 truncate block">{o.fabricName}</span>
                </div>
                <div className="shrink-0 text-xs font-semibold text-amber-800 tabular-nums">
                  {o.daysStuck} дн
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ============ Helper components ============

function KpiCard({
  icon, label, value, hint, tone,
}: { icon: React.ReactNode; label: string; value: string | number; hint?: string; tone: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-300 shadow-md p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
          {label}
        </span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", tone)}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

function Card({
  title, icon, subtitle, children,
}: { title: string; icon?: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-300 shadow-md overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
        {subtitle && <span className="text-[11px] text-slate-500 ml-auto">{subtitle}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-[180px] text-slate-400 text-sm italic">
      {text}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}
