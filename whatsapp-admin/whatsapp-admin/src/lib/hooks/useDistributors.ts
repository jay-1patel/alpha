import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { http } from '@/lib/http'
import type { Distributor, DistributorsResponse } from '@/lib/types'

/* ------------------------------------------------------------------ */
/* LIST                                                               */
/* ------------------------------------------------------------------ */

export function useDistributors(filters?: {
  q?: string
  region?: string
  tier?: string
}) {
  return useQuery<DistributorsResponse>({
    queryKey: ['distributors', 'list', filters],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams()

      if (filters?.q) params.set('q', filters.q)
      if (filters?.region) params.set('region', filters.region)
      if (filters?.tier) params.set('tier', filters.tier)

      const qs = params.toString()
      const res = await http.get(`/api/distributors${qs ? `?${qs}` : ''}`, { signal })
      return res.data
    },
    staleTime: 10000,
  })
}

/* ------------------------------------------------------------------ */
/* CREATE                                                             */
/* ------------------------------------------------------------------ */

export function useCreateDistributor(onDone?: () => void) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      wa_id: string
      name: string
      phone?: string
      email?: string
      region?: string
      tier?: string
      product_interests?: string[]
      sales_volume?: number
      last_order_value?: number
      outstanding_payments?: number
      notes?: string
    }) => {
      const res = await http.post('/api/distributors', payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distributors'] })
      toast.success('Distributor added')
      onDone?.()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to add distributor')
    },
  })
}

/* ------------------------------------------------------------------ */
/* UPDATE                                                             */
/* ------------------------------------------------------------------ */

export function useUpdateDistributor(onDone?: () => void) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      wa_id,
      ...payload
    }: {
      wa_id: string
      name?: string
      phone?: string
      email?: string
      region?: string
      tier?: string
      product_interests?: string[]
      sales_volume?: number
      last_order_value?: number
      outstanding_payments?: number
      notes?: string
    }) => {
      const res = await http.put(`/api/distributors/${wa_id}`, payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distributors'] })
      toast.success('Distributor updated')
      onDone?.()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update distributor')
    },
  })
}

/* ------------------------------------------------------------------ */
/* DELETE                                                             */
/* ------------------------------------------------------------------ */

export function useDeleteDistributor() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (wa_id: string) => {
      const res = await http.delete(`/api/distributors/${wa_id}`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distributors'] })
      toast.success('Distributor deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete distributor')
    },
  })
}
