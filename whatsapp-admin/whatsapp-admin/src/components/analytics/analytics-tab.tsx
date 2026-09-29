'use client'

import { useState } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { BarChart3, Loader2, MessageSquare, Users, Timer, HelpCircle, TrendingUp, AlertTriangle } from 'lucide-react'

import {
  useAnalyticsOverview,
  useResponseTime,
  useTopQuestions,
  useFrequentQuestions,
  useUnansweredQueries,
} from '@/lib/hooks/useAnalytics'

const DAY_OPTIONS = [7, 30, 90]

function LoadingCard() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <HelpCircle className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export default function AnalyticsTab() {
  const [days, setDays] = useState(7)

  const overview = useAnalyticsOverview(days)
  const responseTime = useResponseTime(days)
  const topQuestions = useTopQuestions(days)
  const frequentQuestions = useFrequentQuestions(days)
  const unanswered = useUnansweredQueries(days)

  const responseData = (responseTime.data?.data ?? []).map((d) => ({
    date: d.date,
    'Avg Response (s)': d.avg_ms ? Number((d.avg_ms / 1000).toFixed(2)) : 0,
  }))

  const topData = (topQuestions.data?.questions ?? []).slice(0, 10)
  const routeData = (overview.data?.route_breakdown ?? []).map((r) => ({
    name: r.route || 'unknown',
    count: r.count,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Bot performance, questions, and response insights
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg border p-1">
          {DAY_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setDays(opt)}
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                days === opt
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-accent',
              ].join(' ')}
            >
              {opt}d
            </button>
          ))}
        </div>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-md shadow-violet-500/10 bg-gradient-to-br from-violet-500 to-purple-600 text-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">Messages</p>
              <p className="text-3xl font-bold mt-1">{overview.data?.total_messages ?? '—'}</p>
              <p className="text-xs text-white/70 mt-1">last {days} days</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">
              <MessageSquare className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md shadow-sky-500/10 bg-gradient-to-br from-sky-500 to-blue-600 text-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">Users</p>
              <p className="text-3xl font-bold mt-1">{overview.data?.unique_users ?? '—'}</p>
              <p className="text-xs text-white/70 mt-1">unique customers</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md shadow-emerald-500/10 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">Avg Response</p>
              <p className="text-3xl font-bold mt-1">
                {overview.data?.avg_response_ms != null
                  ? `${(overview.data.avg_response_ms / 1000).toFixed(1)}s`
                  : '—'}
              </p>
              <p className="text-xs text-white/70 mt-1">bot reply time</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">
              <Timer className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md shadow-amber-500/10 bg-gradient-to-br from-amber-400 to-orange-500 text-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">Top Qs</p>
              <p className="text-3xl font-bold mt-1">{topQuestions.data?.total ?? '—'}</p>
              <p className="text-xs text-white/70 mt-1">total asks</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Response time + route breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-border/60">
          <CardHeader>
            <CardTitle>Average Response Time</CardTitle>
            <CardDescription>Daily bot response latency (seconds)</CardDescription>
          </CardHeader>
          <CardContent>
            {responseTime.isLoading ? (
              <LoadingCard />
            ) : responseData.length === 0 ? (
              <EmptyState label="No response-time data available yet." />
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={responseData} margin={{ left: 0, right: 16, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="Avg Response (s)"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle>Route Breakdown</CardTitle>
            <CardDescription>Messages by bot route</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.isLoading ? (
              <LoadingCard />
            ) : routeData.length === 0 ? (
              <EmptyState label="No route data available." />
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={routeData} layout="vertical" margin={{ left: 10, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top questions + unanswered */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle>Top Questions</CardTitle>
            <CardDescription>Most frequently asked queries</CardDescription>
          </CardHeader>
          <CardContent>
            {topQuestions.isLoading ? (
              <LoadingCard />
            ) : topData.length === 0 ? (
              <EmptyState label="No questions data available yet." />
            ) : (
              <div className="space-y-2">
                {topData.map((q, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5"
                  >
                    <Badge variant="secondary" className="shrink-0">
                      #{i + 1}
                    </Badge>
                    <span className="flex-1 truncate text-sm">{q.query}</span>
                    <span className="text-sm font-semibold text-muted-foreground">{q.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Unanswered Queries
            </CardTitle>
            <CardDescription>Queries the bot could not answer</CardDescription>
          </CardHeader>
          <CardContent>
            {unanswered.isLoading ? (
              <LoadingCard />
            ) : (unanswered.data?.queries ?? []).length === 0 ? (
              <EmptyState label="No unanswered queries — great job!" />
            ) : (
              <div className="space-y-2">
                {(unanswered.data?.queries ?? []).map((q, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border/60 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex-1 truncate text-sm font-medium">{q.query}</span>
                      <Badge variant="destructive" className="shrink-0">
                        ×{q.count}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{q.response}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Frequent questions (longer list) */}
      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle>Frequent Questions</CardTitle>
          <CardDescription>Top {frequentQuestions.data?.total_unique ?? 0} unique queries over {days} days</CardDescription>
        </CardHeader>
        <CardContent>
          {frequentQuestions.isLoading ? (
            <LoadingCard />
          ) : (frequentQuestions.data?.questions ?? []).length === 0 ? (
            <EmptyState label="No frequent-questions data available yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">#</th>
                    <th className="py-2 pr-4 font-medium">Question</th>
                    <th className="py-2 pr-4 font-medium text-right">Count</th>
                    <th className="py-2 font-medium text-right">Last Asked</th>
                  </tr>
                </thead>
                <tbody>
                  {(frequentQuestions.data?.questions ?? []).map((q, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-4">{q.query}</td>
                      <td className="py-2 pr-4 text-right font-semibold">{q.count}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {q.last_asked ? new Date(q.last_asked).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
