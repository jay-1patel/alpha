import { useState } from 'react'

import {
  Banknote,
  CheckCircle2,
  Eye,
  IndianRupee,
  Loader2,
  Package,
  ShoppingCart,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import {
  useOrders,
  useOrderStats,
  useUpdateOrder,
  useDeleteOrder,
} from '@/lib/hooks/useOrders'
import type { Order, OrderItem } from '@/lib/types'

/* ------------------------------------------------------------------ */
/* PRESENTATION HELPERS                                                */
/* ------------------------------------------------------------------ */

const ORDER_STATUS_STYLE: Record<string, string> = {
  placed: 'bg-sky-50 text-sky-700 ring-sky-200',
  confirmed: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  processing: 'bg-amber-50 text-amber-700 ring-amber-200',
  shipped: 'bg-violet-50 text-violet-700 ring-violet-200',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-teal-50 text-teal-700 ring-teal-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
  returned: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  returned: 'Returned',
}

const PAYMENT_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  cod: 'bg-slate-100 text-slate-700 ring-slate-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  refunded: 'bg-violet-50 text-violet-700 ring-violet-200',
}

const PAYMENT_LABEL: Record<string, string> = {
  pending: 'Pending',
  cod: 'COD',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
}

function StatusBadge({ status }: { status?: string }) {
  const s = status || 'placed'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
        ORDER_STATUS_STYLE[s] ?? ORDER_STATUS_STYLE.placed
      )}
    >
      {ORDER_STATUS_LABEL[s] ?? s}
    </span>
  )
}

function PaymentBadge({ status }: { status?: string }) {
  const s = status || 'pending'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
        PAYMENT_STYLE[s] ?? PAYMENT_STYLE.pending
      )}
    >
      {PAYMENT_LABEL[s] ?? s}
    </span>
  )
}

function TypeBadge({ type }: { type?: string }) {
  const t = type || 'b2c'
  return (
    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 uppercase">
      {t}
    </span>
  )
}

function formatDate(value?: string): string {
  if (!value) return '—'
  const d = new Date(value.replace(' ', 'T'))
  if (isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMoney(value?: number): string {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function itemName(item: OrderItem): string {
  return item?.name || item?.product_name || `Item ${item?.product_id ?? '#'}`
}

function itemQty(item: OrderItem): number {
  return Number(item?.qty ?? item?.quantity ?? 1)
}

function itemPrice(item: OrderItem): number {
  return Number(item?.price ?? item?.unit_price ?? 0)
}

/* ------------------------------------------------------------------ */
/* DETAIL DIALOG                                                       */
/* ------------------------------------------------------------------ */

function OrderDetail({
  order,
  onClose,
}: {
  order: Order
  onClose: () => void
}) {
  const [status, setStatus] = useState(order.status || 'placed')
  const [paymentStatus, setPaymentStatus] = useState(
    order.payment_status || 'pending'
  )

  const update = useUpdateOrder(() => onClose())

  const items = Array.isArray(order.items) ? order.items : []

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShoppingCart className="h-5 w-5 text-sky-600" />
            <span className="font-mono">{order.order_number}</span>
            <TypeBadge type={order.order_type} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status row */}
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={status} />
            <PaymentBadge status={paymentStatus} />
            {order.delivery_date && (
              <span className="text-sm text-muted-foreground">
                <Truck className="mr-1 inline h-4 w-4" />
                Delivery {formatDate(order.delivery_date)}
              </span>
            )}
          </div>

          {/* Customer */}
          <div className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Customer
              </div>
              <div className="font-medium text-foreground">
                {order.customer_name || '—'}
              </div>
              {order.customer_mobile && (
                <div className="text-muted-foreground">{order.customer_mobile}</div>
              )}
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {order.wa_id}
              </div>
            </div>
            <div className="text-right sm:text-left">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Order details
              </div>
              <div className="text-foreground">{formatDate(order.created_at)}</div>
              {order.source && <div className="text-muted-foreground">Source: {order.source}</div>}
              {order.tier && <div className="text-muted-foreground">Tier: {order.tier}</div>}
            </div>
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {itemName(item)}
                      </TableCell>
                      <TableCell className="text-right">{itemQty(item)}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(itemPrice(item))}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(itemQty(item) * itemPrice(item))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Totals */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1 text-sm text-muted-foreground">
              {Number(order.discount_applied || 0) > 0 && (
                <div>Discount applied: {formatMoney(order.discount_applied)}</div>
              )}
              <div>
                Payment method:{' '}
                <span className="font-medium text-foreground">
                  {(order.payment_method || 'cod').toUpperCase()}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total Amount</div>
              <div className="text-2xl font-bold text-foreground">
                {formatMoney(order.total_amount)}
              </div>
            </div>
          </div>

          {/* Status update */}
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-dashed p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Order Status
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Payment Status
              </label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  orderId: String(order.id),
                  status,
                  payment_status: paymentStatus,
                })
              }
              className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700"
            >
              {update.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* STAT CARD                                                           */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xl font-bold text-foreground">{value}</div>
        <div className="truncate text-xs font-medium text-muted-foreground">
          {label}
          {sub ? ` · ${sub}` : ''}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* MAIN TAB                                                            */
/* ------------------------------------------------------------------ */

export function OrdersTab() {
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<Order | null>(null)
  const [deleting, setDeleting] = useState<Order | null>(null)

  const { data, isLoading } = useOrders({
    status: statusFilter || undefined,
    orderType: typeFilter || undefined,
    paymentStatus: paymentFilter || undefined,
    q: search || undefined,
  })

  const { data: stats, isLoading: statsLoading } = useOrderStats()
  const remove = useDeleteOrder()

  const orders = data?.orders ?? []
  const counts = data?.counts
  const busy = remove.isPending

  const hasFilters = !!(statusFilter || typeFilter || paymentFilter || search)

  return (
    <div className="space-y-5 text-base">
      {/* TOP ROW: stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ShoppingCart}
          label="Total Orders"
          value={statsLoading ? '—' : (stats?.total ?? orders.length)}
        />
        <StatCard
          icon={IndianRupee}
          label="Order Value"
          value={statsLoading ? '—' : formatMoney(stats?.revenue)}
        />
        <StatCard
          icon={Package}
          label="Placed"
          value={statsLoading ? '—' : (stats?.placed ?? 0)}
          sub={String(counts?.placed ?? 0)}
        />
        <StatCard
          icon={Truck}
          label="Delivered"
          value={statsLoading ? '—' : (stats?.delivered ?? 0)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-700 ring-1 ring-sky-200">
          {counts?.total ?? '—'} total
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {counts?.delivered ?? 0} delivered
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 font-semibold text-red-700 ring-1 ring-red-200">
          <XCircle className="h-3.5 w-3.5" />
          {counts?.cancelled ?? 0} cancelled
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700 ring-1 ring-amber-200">
          <Banknote className="h-3.5 w-3.5" />
          {counts?.revenue != null ? formatMoney(counts.revenue) : '—'} revenue
        </span>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order, WA ID, customer, mobile..."
          />
        </div>

        <Select
          value={statusFilter || '_all'}
          onValueChange={(v) => setStatusFilter(v === '_all' ? '' : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Statuses</SelectItem>
            {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter || '_all'}
          onValueChange={(v) => setTypeFilter(v === '_all' ? '' : v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Types</SelectItem>
            <SelectItem value="b2c">B2C</SelectItem>
            <SelectItem value="b2b">B2B</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={paymentFilter || '_all'}
          onValueChange={(v) => setPaymentFilter(v === '_all' ? '' : v)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Payments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Payments</SelectItem>
            {Object.entries(PAYMENT_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('')
              setTypeFilter('')
              setPaymentFilter('')
              setSearch('')
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* TABLE */}
      {isLoading && !data ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-base text-muted-foreground">
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-muted-foreground">
          <ShoppingCart className="h-10 w-10 opacity-30" />
          <p className="text-base">
            {hasFilters
              ? 'No orders match your filters.'
              : 'No orders yet — they will appear here when customers place them via WhatsApp.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {orders.map((o) => {
                const itemCount = Array.isArray(o.items)
                  ? o.items.reduce((acc, it) => acc + itemQty(it), 0)
                  : 0
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      <div className="font-semibold text-foreground">
                        {o.order_number}
                      </div>
                      {o.wa_id && (
                        <div className="text-xs text-muted-foreground">
                          {o.wa_id}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="max-w-[200px]">
                      <div className="truncate font-medium">
                        {o.customer_name || '—'}
                      </div>
                      {o.customer_mobile && (
                        <div className="text-xs text-muted-foreground">
                          {o.customer_mobile}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <TypeBadge type={o.order_type} />
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {itemCount > 0 ? `${itemCount} units` : '—'}
                    </TableCell>

                    <TableCell className="font-semibold whitespace-nowrap">
                      {formatMoney(o.total_amount)}
                    </TableCell>

                    <TableCell>
                      <PaymentBadge status={o.payment_status} />
                    </TableCell>

                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(o.created_at)}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View order"
                          className="h-8 w-8"
                          onClick={() => setViewing(o)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete order"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          disabled={busy}
                          onClick={() => setDeleting(o)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* DETAIL DIALOG */}
      {viewing && (
        <OrderDetail
          order={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      {/* DELETE CONFIRMATION */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete Order</AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-relaxed">
              Are you sure you want to delete{' '}
              <span className="font-mono font-semibold text-foreground">
                {deleting?.order_number}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel className="text-base">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-base text-white hover:bg-red-700"
              onClick={() => {
                if (deleting) {
                  remove.mutate(String(deleting.id))
                  setDeleting(null)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default OrdersTab