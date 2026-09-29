import { useState } from 'react'

import {
  IndianRupee,
  Loader2,
  MessageSquareWarning,
  Phone,
  Search,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { useCustomers } from '@/lib/hooks/useCustomers'
import { useOrders } from '@/lib/hooks/useOrders'
import { useComplaints } from '@/lib/hooks/useComplaints'
import type { Customer } from '@/lib/types'

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-red-50 text-red-700 ring-red-200',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-200',
  awaiting_info: 'bg-violet-50 text-violet-700 ring-violet-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const ORDER_STYLE: Record<string, string> = {
  placed: 'bg-sky-50 text-sky-700 ring-sky-200',
  confirmed: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  processing: 'bg-amber-50 text-amber-700 ring-amber-200',
  shipped: 'bg-violet-50 text-violet-700 ring-violet-200',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-teal-50 text-teal-700 ring-teal-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
  returned: 'bg-rose-50 text-rose-700 ring-rose-200',
}

function initials(name: string): string {
  const clean = (name || '').trim()
  if (!clean) return '?'
  const parts = clean.split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
}

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  gradient: string
}) {
  return (
    <Card className={`border-none shadow-md text-white ${gradient}`}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-white/80">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function CustomerDetails({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const orders = useOrders({ q: customer.wa_id })
  const complaints = useComplaints({ waId: customer.wa_id })

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white">
              {initials(customer.name || customer.wa_id)}
            </div>
            <span className="truncate">{customer.name || customer.wa_id}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Badge variant="secondary" className="justify-center py-2">
            {customer.total_orders} order{customer.total_orders === 1 ? '' : 's'}
          </Badge>
          <Badge variant="secondary" className="justify-center py-2">
            {customer.total_complaints} complaint{customer.total_complaints === 1 ? '' : 's'}
          </Badge>
          <Badge variant="secondary" className="justify-center py-2">
            ₹{(customer.total_spent ?? 0).toLocaleString()}
          </Badge>
          <Badge variant="secondary" className="justify-center py-2">
            {formatDate(customer.last_active)}
          </Badge>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <ShoppingCart className="h-4 w-4" /> Orders ({orders.data?.orders?.length ?? 0})
            </h3>
            {orders.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (orders.data?.orders?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No orders for this customer.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.data?.orders?.slice(0, 20).map((o) => (
                      <TableRow key={String(o.id)}>
                        <TableCell className="font-medium">{o.order_number}</TableCell>
                        <TableCell>{formatDate(o.created_at)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ORDER_STYLE[o.status || ''] || ORDER_STYLE.placed}`}>
                            {(o.status || 'placed').replace(/_/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">₹{(o.total_amount ?? 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <MessageSquareWarning className="h-4 w-4" /> Complaints ({complaints.data?.complaints?.length ?? 0})
            </h3>
            {complaints.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (complaints.data?.complaints?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No complaints for this customer.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complaints.data?.complaints?.slice(0, 20).map((c) => (
                      <TableRow key={c.ticket_id}>
                        <TableCell className="font-medium">{c.ticket_id}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{c.subject || c.description || '—'}</TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[c.status || ''] || STATUS_STYLE.open}`}>
                            {(c.status || 'open').replace(/_/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(c.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function CustomersTab() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)

  const customers = useCustomers(search ? { q: search } : undefined)

  const list = customers.data?.customers ?? []
  const totalSpent = list.reduce((sum, c) => sum + (c.total_spent ?? 0), 0)
  const openComplaints = list.reduce((sum, c) => sum + (c.open_complaints ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
            <p className="text-sm text-muted-foreground">
              Everyone who has interacted through WhatsApp
            </p>
          </div>
        </div>
        <div className="relative max-w-md w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by WA ID or name..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Customers" value={customers.data?.count ?? '—'} gradient="bg-gradient-to-br from-sky-500 to-blue-600 shadow-blue-500/10" />
        <StatCard icon={ShoppingCart} label="Total Orders" value={list.reduce((s, c) => s + c.total_orders, 0) || '—'} gradient="bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/10" />
        <StatCard icon={MessageSquareWarning} label="Open Complaints" value={openComplaints || '—'} gradient="bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/10" />
        <StatCard icon={Wallet} label="Total Spend" value={`₹${totalSpent.toLocaleString()}`} gradient="bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/10" />
      </div>

      {/* Customer list */}
      <Card className="overflow-hidden rounded-2xl border shadow-sm">
        <CardContent className="p-0">
          {customers.isLoading ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading customers...</p>
            </div>
          ) : list.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-4 py-16 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">
                {search ? 'No matching customers' : 'No customers yet'}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {search
                  ? 'Try a different WA ID or name.'
                  : 'Customers will appear here once they message the bot.'}
              </p>
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader className="bg-muted/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-14 min-w-[240px]">Customer</TableHead>
                    <TableHead className="h-14 min-w-[100px]">Orders</TableHead>
                    <TableHead className="h-14 min-w-[120px]">Complaints</TableHead>
                    <TableHead className="h-14 min-w-[120px] text-right">Total Spent</TableHead>
                    <TableHead className="h-14 min-w-[120px]">Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((c) => (
                    <TableRow key={c.wa_id} className="group cursor-pointer transition-colors hover:bg-muted/30" onClick={() => setSelected(c)}>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white">
                            {initials(c.name || c.wa_id)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{c.name || c.wa_id}</p>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="truncate">{c.mobile || c.wa_id}</span>
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="secondary">{c.total_orders}</Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        {c.open_complaints > 0 ? (
                          <Badge className="bg-red-50 text-red-700 ring-red-200 ring-1 ring-inset">
                            {c.open_complaints} open
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{c.total_complaints}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-right font-semibold">
                        <span className="inline-flex items-center gap-1">
                          <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
                          {(c.total_spent ?? 0).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-muted-foreground">
                        {formatDate(c.last_active)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!customers.isLoading && list.length > 0 && (
            <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>
                  <span className="font-semibold text-foreground">{list.length}</span>{' '}
                  {list.length === 1 ? 'customer' : 'customers'}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                Clear search
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && <CustomerDetails customer={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}