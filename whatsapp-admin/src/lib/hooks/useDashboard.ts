import { useQuery } from '@tanstack/react-query'

import { http } from '@/lib/http'

/* ------------------------------------------------------------------ */
/* TYPES                                                              */
/* ------------------------------------------------------------------ */

export interface DashboardStats {
  kb_files: number
  faq_files: number
  products: number
  total_customers: number
  total_orders: number
  orders_solved: number
  total_complaints: number
  complaints_solved: number
  top_questions?: { query: string; count: number }[]
}

/* ------------------------------------------------------------------ */
/* CONTENT STATS                                                      */
/* ------------------------------------------------------------------ */

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/admin/dashboard/stats', { signal })
      return res.data
    },
    staleTime: 60_000,
  })
}
