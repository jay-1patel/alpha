'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { FileText, Package, HelpCircle, TrendingUp, Loader2, LayoutDashboard, MessageSquareText, PieChart as PieIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const barChartConfig = {
  count: {
    label: 'Times Asked',
    color: 'hsl(var(--chart-1))',
  },
}

const pieChartConfig = {
  kb: {
    label: 'KB Files',
    color: 'hsl(var(--chart-2))',
  },
  faq: {
    label: 'FAQ Files',
    color: 'hsl(var(--chart-4))',
  },
  products: {
    label: 'Products',
    color: 'hsl(var(--chart-5))',
  },
}

export default function DashboardTab() {
  const [stats, setStats] = useState({ totalKBFiles: 0, totalFAQFiles: 0, totalProducts: 0 })
  const [topQuestions, setTopQuestions] = useState<{ question: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const data = await api.get('/api/admin/dashboard/stats')
        if (cancelled) return
        setStats({
          totalKBFiles: data.kb_files || 0,
          totalFAQFiles: data.faq_files || 0,
          totalProducts: data.products || 0,
        })
        const questions = (data.top_questions || []).map((q: any) => ({
          question: q.query.length > 20 ? q.query.substring(0, 20) + '...' : q.query,
          count: q.count,
        }))
        setTopQuestions(questions)
      } catch {
        if (!cancelled) toast.error('Failed to load dashboard data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  const barData = topQuestions
  const pieData = [
    { name: 'kb', value: stats.totalKBFiles },
    { name: 'faq', value: stats.totalFAQFiles },
    { name: 'products', value: stats.totalProducts },
  ].filter(d => d.value > 0)

  const PIE_COLORS = ['hsl(var(--chart-2))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <LayoutDashboard className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your WhatsApp bot content and activity</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-md shadow-blue-500/10 bg-gradient-to-br from-sky-500 to-blue-600 text-white overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">KB Files</p>
              <p className="text-3xl font-bold mt-1">{stats.totalKBFiles}</p>
              <p className="text-xs text-white/70 mt-1">Knowledge base documents</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">
              <FileText className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md shadow-orange-500/10 bg-gradient-to-br from-amber-400 to-orange-500 text-white overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">FAQ Files</p>
              <p className="text-3xl font-bold mt-1">{stats.totalFAQFiles}</p>
              <p className="text-xs text-white/70 mt-1">FAQ documents uploaded</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">
              <HelpCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md shadow-emerald-500/10 bg-gradient-to-br from-emerald-500 to-teal-600 text-white overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-white/80">Products</p>
              <p className="text-3xl font-bold mt-1">{stats.totalProducts}</p>
              <p className="text-xs text-white/70 mt-1">Active product listings</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">
              <Package className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Questions Bar Chart */}
        <Card className="lg:col-span-2 shadow-sm border-border/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle>Top Questions Asked</CardTitle>
                <CardDescription>Last 7 days query frequency</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <div className="text-center py-14 space-y-2">
                <MessageSquareText className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No questions data available yet.</p>
              </div>
            ) : (
              <ChartContainer config={barChartConfig} className="h-[300px] w-full">
                <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="question" type="category" width={150} tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Distribution Pie Chart */}
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center shrink-0">
                <PieIcon className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle>Content Distribution</CardTitle>
                <CardDescription>Files &amp; data overview</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="text-center py-14 space-y-2">
                <PieIcon className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No data to display.</p>
              </div>
            ) : (
              <>
                <ChartContainer config={pieChartConfig} className="h-[300px] w-full">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      strokeWidth={2}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                      <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[index] }} />
                      <span className="text-muted-foreground">{pieChartConfig[entry.name as keyof typeof pieChartConfig]?.label}: {entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
