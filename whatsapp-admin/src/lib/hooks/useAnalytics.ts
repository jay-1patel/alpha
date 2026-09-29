import { useQuery } from '@tanstack/react-query'

import { http } from '@/lib/http'

/* ------------------------------------------------------------------ */
/* TYPES                                                              */
/* ------------------------------------------------------------------ */

export interface AnalyticsOverview {
  days: number
  total_messages: number
  unique_users: number
  avg_response_ms: number
  route_breakdown: { route: string; count: number }[]
}

export interface ResponseTimePoint {
  date: string
  avg_ms: number
  count: number
}

export interface QuestionStat {
  query: string
  count: number
  last_asked?: string
}

export interface UnansweredQuery {
  query: string
  response: string
  count: number
  last_asked?: string
}

/* ------------------------------------------------------------------ */
/* OVERVIEW                                                           */
/* ------------------------------------------------------------------ */

export function useAnalyticsOverview(days: number) {
  return useQuery<AnalyticsOverview>({
    queryKey: ['analytics', 'overview', days],
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/admin/analytics/overview', {
        params: { days },
        signal,
      })
      return res.data
    },
    staleTime: 30_000,
  })
}

/* ------------------------------------------------------------------ */
/* RESPONSE TIME                                                      */
/* ------------------------------------------------------------------ */

export function useResponseTime(days: number) {
  return useQuery<{ days: number; data: ResponseTimePoint[] }>({
    queryKey: ['analytics', 'response-time', days],
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/admin/analytics/response-time', {
        params: { days },
        signal,
      })
      return res.data
    },
    staleTime: 30_000,
  })
}

/* ------------------------------------------------------------------ */
/* TOP QUESTIONS                                                      */
/* ------------------------------------------------------------------ */

export function useTopQuestions(days: number, limit = 10) {
  return useQuery<{ days: number; total: number; questions: QuestionStat[] }>({
    queryKey: ['analytics', 'top-questions', days, limit],
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/admin/analytics/top-questions', {
        params: { days, limit },
        signal,
      })
      return res.data
    },
    staleTime: 30_000,
  })
}

/* ------------------------------------------------------------------ */
/* FREQUENT QUESTIONS                                                 */
/* ------------------------------------------------------------------ */

export function useFrequentQuestions(days: number, limit = 20) {
  return useQuery<{
    days: number
    total_unique: number
    questions: QuestionStat[]
  }>({
    queryKey: ['analytics', 'frequent-questions', days, limit],
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/admin/analytics/frequent-questions', {
        params: { days, limit },
        signal,
      })
      return res.data
    },
    staleTime: 30_000,
  })
}

/* ------------------------------------------------------------------ */
/* UNANSWERED QUERIES                                                 */
/* ------------------------------------------------------------------ */

export function useUnansweredQueries(days: number, limit = 20) {
  return useQuery<{ days: number; total: number; queries: UnansweredQuery[] }>({
    queryKey: ['analytics', 'unanswered', days, limit],
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/admin/analytics/unanswered', {
        params: { days, limit },
        signal,
      })
      return res.data
    },
    staleTime: 30_000,
  })
}
