'use client'

import { OrderList } from '@/components/OrderList'

export default function WaitingOrdersPage() {
  return (
    <div className="space-y-6">
      <OrderList mode="waiting" />
    </div>
  )
}
