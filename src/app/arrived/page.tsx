'use client'

import { OrderList } from '@/components/OrderList'

export default function ArrivedOrdersPage() {
  return (
    <div className="space-y-6">
      <OrderList status="ARRIVED" />
    </div>
  )
}
