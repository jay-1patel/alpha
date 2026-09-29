import { useQuery } from '@tanstack/react-query'

import { http } from '@/lib/http'
import type { CustomersResponse } from '@/lib/types'

export function useCustomers(filters?: { q?: string }) {
  return useQuery<CustomersResponse>({
    queryKey: ['customers', 'list', filters],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams()
      if (filters?.q) params.set('q', filters.q)
      const qs = params.toString()
      const res = await http.get(`/api/admin/customers${qs ? `?${qs}` : ''}`, { signal })
      return res.data
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
