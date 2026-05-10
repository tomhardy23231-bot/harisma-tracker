'use client'

import { OrderList } from '@/components/OrderList'

export default function ArchiveOrdersPage() {
  return (
    <div className="space-y-6">
      <OrderList status="ARCHIVED" dateFilterField="archivedAt" />
    </div>
  )
}
