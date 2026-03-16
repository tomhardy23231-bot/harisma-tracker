'use client'

import { OrderList } from '@/components/OrderList'

export default function OrderedOrdersPage() {
  return (
    <div className="space-y-6">
      <OrderList status="ORDERED" />
    </div>
  )
}
