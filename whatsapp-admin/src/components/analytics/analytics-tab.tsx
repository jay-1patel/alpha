'use client'

import { useState } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import {
  BarChart3,
  Loader2,
  MessageSquare,
  Users,
  Timer,
  HelpCircle,
  TrendingUp,
  FileText,
  Package,
  ArrowRight,
  Inbox,
  Megaphone,
  Upload,
} from 'lucide-react'

import {
  useAnalyticsOverview,
  useResponseTime,
  useTopQuestions,
  useFrequentQuestions,
} from '@/lib/hooks/useAnalytics'
import { useDashboardStats } from '@/lib/hooks/useDashboard'
import { navigateTo } from '@/lib/navigation'

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

function ContentStatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  gradient,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  subtitle: string
  gradient: string
  onClick?: () => void
}) {
  return (
    <Card
      className={[
        'border-none shadow-md text-white overflow-hidden transition-transform hover:scale-[1.01]',
        onClick ? 'cursor-pointer' : '',
        gradient,
      ].join(' ')}
      onClick={onClick}
    >
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-white/80">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          <p className="text-xs text-white/70 mt-1">{subtitle}</p>
        </div>
        <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  )
}

function QuickActionCard({
  icon: Icon,
  title,
  description,
  onClick,
  colorClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  onClick: () => void
  colorClass: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-4 text-left transition-all hover:border-sky-300 hover:shadow-sm"
    >
      <div className={['flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white', colorClass].join(' ')}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}

export default function AnalyticsTab() {
  const [days, setDays] = useState(7)

  const overview = useAnalyticsOverview(days)
  const responseTime = useResponseTime(days)
  const topQuestions = useTopQuestions(days)
  const frequentQuestions = useFrequentQuestions(days)
  const dashboardStats = useDashboardStats()

  const responseData = (responseTime.data?.data ?? []).map((d) => ({
    date: d.date,
    'Avg Response (s)': d.avg_ms ? Number((d.avg_ms / 1000).toFixed(2)) : 0,
  }))

  const contentStats = dashboardStats.data ?? {
    kb_files: 0,
    faq_files: 0,
    products: 0,
    total_customers: 0,
    total_orders: 0,
    orders_solved: 0,
    total_complaints: 0,
    complaints_solved: 0,
  }
  const kpiStats = [
    { key: 'total_customers', name: 'Total Customers', count: contentStats.total_customers ?? 0 },
    { key: 'total_complaints', name: 'Total Complaints', count: contentStats.total_complaints ?? 0 },
    { key: 'complaints_solved', name: 'Complaints Solved', count: contentStats.complaints_solved ?? 0 },
    { key: 'total_orders', name: 'Total Orders', count: contentStats.total_orders ?? 0 },
    { key: 'orders_solved', name: 'Orders Solved', count: contentStats.orders_solved ?? 0 },
    { key: 'total_products', name: 'Total Products', count: contentStats.products ?? 0 },
  ]

  const contentStatsLoading = dashboardStats.isLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Overview &amp; Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Bot activity, content, and performance insights
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

      {/* Content stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {contentStatsLoading ? (
          <div className="col-span-full flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <ContentStatCard
              icon={FileText}
              label="KB Files"
              value={contentStats.kb_files}
              subtitle="Knowledge base documents"
              gradient="bg-gradient-to-br from-sky-500 to-blue-600 shadow-blue-500/10"
              onClick={() => navigateTo('/files')}
            />
            <ContentStatCard
              icon={HelpCircle}
              label="FAQ Files"
              value={contentStats.faq_files}
              subtitle="FAQ documents uploaded"
              gradient="bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/10"
              onClick={() => navigateTo('/files')}
            />
            <ContentStatCard
              icon={Package}
              label="Products"
              value={contentStats.products}
              subtitle="Active product listings"
              gradient="bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/10"
              onClick={() => navigateTo('/products')}
            />
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickActionCard
          icon={Upload}
          title="Upload Files"
          description="Add FAQ or knowledge base documents"
          onClick={() => navigateTo('/files')}
          colorClass="bg-gradient-to-br from-sky-500 to-blue-600"
        />
        <QuickActionCard
          icon={Package}
          title="Manage Products"
          description="Review and update product listings"
          onClick={() => navigateTo('/products')}
          colorClass="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
        <QuickActionCard
          icon={Inbox}
          title="Open Live Inbox"
          description="Handle human handovers and chats"
          onClick={() => navigateTo('/inbox')}
          colorClass="bg-gradient-to-br from-violet-500 to-purple-600"
        />
        <QuickActionCard
          icon={Megaphone}
          title="View Campaigns"
          description="Check broadcast performance"
          onClick={() => navigateTo('/campaigns')}
          colorClass="bg-gradient-to-br from-amber-400 to-orange-500"
        />
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
            <CardDescription>Total customers, orders, complaints &amp; those solved</CardDescription>
          </CardHeader>
          <CardContent>
            {contentStatsLoading ? (
              <LoadingCard />
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kpiStats} layout="vertical" margin={{ left: 10, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
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
