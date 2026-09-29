import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { http } from '@/lib/http'
import type {
  OrderStats,
  OrdersResponse,
} from '@/lib/types'

/* ------------------------------------------------------------------ */
/* LIST                                                               */
/* ------------------------------------------------------------------ */

export function useOrders(filters?: {
  status?: string
  orderType?: string
  paymentStatus?: string
  q?: string
}) {
  return useQuery<OrdersResponse>({
    queryKey: ['orders', 'list', filters],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.orderType) params.set('order_type', filters.orderType)
      if (filters?.paymentStatus) params.set('payment_status', filters.paymentStatus)
      if (filters?.q) params.set('q', filters.q)
      const qs = params.toString()
      const res = await http.get(`/api/orders${qs ? `?${qs}` : ''}`, { signal })
      return res.data
    },
    staleTime: 5000,
    refetchInterval: 15000,
  })
}

/* ------------------------------------------------------------------ */
/* STATS                                                              */
/* ------------------------------------------------------------------ */

export function useOrderStats() {
  return useQuery<OrderStats>({
    queryKey: ['orders', 'stats'],
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/orders/stats', { signal })
      return res.data
    },
    staleTime: 10000,
    refetchInterval: 15000,
  })
}

/* ------------------------------------------------------------------ */
/* UPDATE                                                             */
/* ------------------------------------------------------------------ */

export function useUpdateOrder(onDone?: () => void) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      orderId,
      ...payload
    }: {
      orderId: string
      status?: string
      payment_status?: string
      payment_method?: string
      delivery_date?: string
      tier?: string
      discount_applied?: number
      total_amount?: number
    }) => {
      const res = await http.put(`/api/orders/${orderId}`, payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Order updated')
      onDone?.()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update order')
    },
  })
}

/* ------------------------------------------------------------------ */
/* DELETE                                                             */
/* ------------------------------------------------------------------ */

export function useDeleteOrder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (orderId: string) => {
      const res = await http.delete(`/api/orders/${orderId}`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Order deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete order')
    },
  })
}