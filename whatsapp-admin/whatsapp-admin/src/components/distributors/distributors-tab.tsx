import { useState } from 'react'

import {
  Edit,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Distributor } from '@/lib/types'
import {
  useCreateDistributor,
  useDeleteDistributor,
  useDistributors,
  useUpdateDistributor,
} from '@/lib/hooks/useDistributors'

/* ------------------------------------------------------------------ */
/* TIER BADGE                                                         */
/* ------------------------------------------------------------------ */

const TIER_STYLE: Record<string, string> = {
  Gold: 'bg-amber-50 text-amber-700 ring-amber-200',
  Silver: 'bg-slate-100 text-slate-600 ring-slate-200',
  Bronze: 'bg-orange-50 text-orange-700 ring-orange-200',
}

function TierBadge({ tier }: { tier?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
        TIER_STYLE[tier ?? 'Bronze'] ?? TIER_STYLE.Bronze
      )}
    >
      {tier || 'Bronze'}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* EMPTY FORM STATE                                                   */
/* ------------------------------------------------------------------ */

const EMPTY_FORM = {
  wa_id: '',
  name: '',
  phone: '',
  email: '',
  region: '',
  tier: 'Bronze',
  product_interests: [] as string[],
  sales_volume: 0,
  last_order_value: 0,
  outstanding_payments: 0,
  notes: '',
}

type FormData = typeof EMPTY_FORM

/* ------------------------------------------------------------------ */
/* FORM PANEL                                                         */
/* ------------------------------------------------------------------ */

function DistributorForm({
  initial,
  onClose,
}: {
  initial?: Distributor | null
  onClose: () => void
}) {
  const [form, setForm] = useState<FormData>(() =>
    initial
      ? { ...EMPTY_FORM, ...initial, product_interests: initial.product_interests ?? [] }
      : { ...EMPTY_FORM }
  )

  const [interestInput, setInterestInput] = useState('')

  const create = useCreateDistributor(onClose)
  const update = useUpdateDistributor(onClose)

  const isEdit = !!initial?.wa_id

  const set = (field: string, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }))

  const addInterest = () => {
    const val = interestInput.trim()

    if (val && !form.product_interests.includes(val)) {
      set('product_interests', [...form.product_interests, val])
    }

    setInterestInput('')
  }

  const removeInterest = (val: string) =>
    set(
      'product_interests',
      form.product_interests.filter((x) => x !== val)
    )

  const handleSave = () => {
    if (!form.wa_id.trim()) return

    if (isEdit) {
      update.mutate({ ...form, wa_id: initial!.wa_id })
    } else {
      create.mutate(form)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-background shadow-2xl text-base">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold">
            {isEdit ? 'Edit Distributor' : 'Add Distributor'}
          </h2>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          <div>
            <Label htmlFor="dist-wa">WhatsApp ID *</Label>

            <Input
              id="dist-wa"
              value={form.wa_id}
              onChange={(e) => set('wa_id', e.target.value)}
              placeholder="e.g. 919876543210"
              disabled={isEdit}
              className={cn('mt-1', isEdit && 'opacity-60')}
            />

            <p className="mt-0.5 text-xs text-muted-foreground">
              WhatsApp number without + or spaces
            </p>
          </div>

          <div>
            <Label htmlFor="dist-name">Contact / Business Name</Label>

            <Input
              id="dist-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Ravi Traders"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dist-phone">Phone</Label>

              <Input
                id="dist-phone"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="dist-email">Email</Label>

              <Input
                id="dist-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="ravi@example.com"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Region</Label>

              <Select value={form.region || '_none'} onValueChange={(v) => set('region', v === '_none' ? '' : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>

                  {['North', 'South', 'East', 'West'].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Sales Tier</Label>

              <Select value={form.tier} onValueChange={(v) => set('tier', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {['Gold', 'Silver', 'Bronze'].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Product Interests</Label>

            <div className="mt-1 flex gap-2">
              <Input
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addInterest()
                  }
                }}
                placeholder="Type and press Enter"
                className="flex-1"
              />

              <Button type="button" variant="outline" onClick={addInterest}>
                Add
              </Button>
            </div>

            {form.product_interests.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.product_interests.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700"
                  >
                    {p}

                    <button
                      type="button"
                      onClick={() => removeInterest(p)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-sky-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="dist-sales">Sales Volume (₹)</Label>

              <Input
                id="dist-sales"
                type="number"
                value={form.sales_volume || ''}
                onChange={(e) => set('sales_volume', Number(e.target.value))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="dist-last">Last Order (₹)</Label>

              <Input
                id="dist-last"
                type="number"
                value={form.last_order_value || ''}
                onChange={(e) => set('last_order_value', Number(e.target.value))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="dist-out">Outstanding (₹)</Label>

              <Input
                id="dist-out"
                type="number"
                value={form.outstanding_payments || ''}
                onChange={(e) => set('outstanding_payments', Number(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="dist-notes">Notes</Label>

            <Textarea
              id="dist-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Internal notes about this distributor..."
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <Button
            disabled={!form.wa_id.trim() || create.isPending || update.isPending}
            onClick={handleSave}
            className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700"
          >
            {(create.isPending || update.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}

            {isEdit ? 'Save Changes' : 'Add Distributor'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* MAIN TAB                                                           */
/* ------------------------------------------------------------------ */

export function DistributorsTab() {
  const [search, setSearch] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Distributor | null>(null)
  const [deleting, setDeleting] = useState<Distributor | null>(null)

  const { data, isLoading } = useDistributors({
    q: search || undefined,
    region: regionFilter || undefined,
    tier: tierFilter || undefined,
  })

  const deleteDist = useDeleteDistributor()

  const distributors = data?.distributors ?? []

  return (
    <div className="space-y-5 text-base">
      {/* TOP ROW: stats + add button */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-base text-muted-foreground">
          <Users className="h-4 w-4" />

          <span className="font-medium text-foreground">
            {distributors.length}
          </span>
          distributors
          {(search || regionFilter || tierFilter) && (
            <span>(filtered)</span>
          )}
        </div>

        <Button
          onClick={() => { setEditing(null); setFormOpen(true) }}
          className="gap-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Distributor
        </Button>
      </div>

      {/* FILTERS */}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, WA ID, phone..."
            className="pl-9"
          />
        </div>

        <Select value={regionFilter || '_all'} onValueChange={(v) => setRegionFilter(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Regions" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="_all">All Regions</SelectItem>

            {['North', 'South', 'East', 'West'].map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tierFilter || '_all'} onValueChange={(v) => setTierFilter(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Tiers" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="_all">All Tiers</SelectItem>

            {['Gold', 'Silver', 'Bronze'].map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(search || regionFilter || tierFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(''); setRegionFilter(''); setTierFilter('') }}
            className="text-base text-muted-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      {/* TABLE */}

      {isLoading && !data ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-base text-muted-foreground">
          Loading distributors...
        </div>
      ) : distributors.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-muted-foreground">
          <Users className="h-10 w-10 opacity-30" />

          <p className="text-base">
            {search || regionFilter || tierFilter
              ? 'No distributors match your filters.'
              : 'No distributors yet — add your first one.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50  text-small">
                <TableHead>WA ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Interests</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {distributors.map((d) => (
                <TableRow key={d.wa_id}>
                  <TableCell className="font-mono text-small">
                    {d.wa_id}
                  </TableCell>

                  <TableCell className="font-medium  text-small">
                    {d.name || <span className="text-muted-foreground italic">Unnamed</span>}
                  </TableCell>

                  <TableCell className='font-medium  text-small'>
                    {d.region || <span className="text-muted-foreground">—</span>}
                  </TableCell>

                  <TableCell className='font-medium  text-small'>
                    <TierBadge tier={d.tier} />
                  </TableCell>

                  <TableCell className="tabular-nums text-small">
                    {d.outstanding_payments
                      ? `₹${d.outstanding_payments.toLocaleString()}`
                      : '₹0'}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(d.product_interests ?? []).slice(0, 2).map((p) => (
                        <span
                          key={p}
                          className="rounded bg-sky-50 px-1.5 py-0.5 text-[15px] font-medium text-sky-700"
                        >
                          {p}
                        </span>
                      ))}

                      {(d.product_interests ?? []).length > 2 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{(d.product_interests ?? []).length - 2}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        className="h-8 w-8"
                        onClick={() => { setEditing(d); setFormOpen(true) }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        disabled={deleteDist.isPending}
                        onClick={() => setDeleting(d)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* FORM MODAL */}

      {formOpen && (
        <DistributorForm
          initial={editing}
          onClose={() => { setFormOpen(false); setEditing(null) }}
        />
      )}

      {/* DELETE CONFIRMATION */}

      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete Distributor</AlertDialogTitle>

            <AlertDialogDescription className="text-base leading-relaxed">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-foreground">
                {deleting?.name || deleting?.wa_id}
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
                  deleteDist.mutate(deleting.wa_id)
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

export default DistributorsTab
