import { useState } from 'react'

import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  MessageSquare,
  MessageSquareWarning,
  Send,
  Trash2,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  useComplaints,
  useDeleteComplaint,
  useReplyComplaint,
  useResolveComplaint,
  useUpdateComplaint,
} from '@/lib/hooks/useComplaints'
import type { Complaint } from '@/lib/types'

/* ------------------------------------------------------------------ */
/* PRESENTATION HELPERS                                                */
/* ------------------------------------------------------------------ */

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-red-50 text-red-700 ring-red-200',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-200',
  awaiting_info: 'bg-violet-50 text-violet-700 ring-violet-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  awaiting_info: 'Awaiting Info',
  resolved: 'Resolved',
  closed: 'Closed',
}

const PRIORITY_STYLE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 ring-slate-200',
  normal: 'bg-sky-50 text-sky-700 ring-sky-200',
  high: 'bg-amber-50 text-amber-700 ring-amber-200',
  urgent: 'bg-red-50 text-red-700 ring-red-200',
}

function StatusBadge({ status }: { status?: string }) {
  const s = status || 'open'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
        STATUS_STYLE[s] ?? STATUS_STYLE.open
      )}
    >
      {STATUS_LABEL[s] ?? s}
    </span>
  )
}

function PriorityBadge({ priority }: { priority?: string }) {
  const p = priority || 'normal'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
        PRIORITY_STYLE[p] ?? PRIORITY_STYLE.normal
      )}
    >
      {p}
    </span>
  )
}

function formatDate(value?: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* ------------------------------------------------------------------ */
/* DETAIL DIALOG                                                       */
/* ------------------------------------------------------------------ */

function ComplaintDetail({
  complaint,
  onClose,
}: {
  complaint: Complaint
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageSquareWarning className="h-5 w-5 text-red-500" />
            {complaint.ticket_id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-base">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {complaint.complaint_type || 'Other'}
            </span>
            {complaint.assigned_to && (
              <span className="text-xs text-muted-foreground">
                👤 {complaint.assigned_to}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
            <div>
              <div className="font-medium text-foreground">{complaint.name || '—'}</div>
              <div className="font-mono text-xs">{complaint.wa_id}</div>
            </div>
            <div className="text-right">
              <div>Raised {formatDate(complaint.created_at)}</div>
              {complaint.resolved_at && (
                <div>Resolved {formatDate(complaint.resolved_at)}</div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subject
            </div>
            <p className="rounded-lg bg-slate-50 p-3 font-medium">
              {complaint.subject || '—'}
            </p>
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </div>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed">
              {complaint.description || '—'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* REPLY DIALOG                                                        */
/* ------------------------------------------------------------------ */

const REPLY_TEMPLATES = [
  {
    key: 'resolved',
    label: '✅ Mark Resolved & Notify',
    status: 'resolved',
    text: (ticket: string) =>
      `Hello! Your complaint (${ticket}) has been resolved ✅. Thank you for your patience. If you need anything else, feel free to reach out. Have a great day! 🙏`,
  },
  {
    key: 'more_info',
    label: 'ℹ️ Request More Info',
    status: 'awaiting_info',
    text: (ticket: string) =>
      `Hello! To resolve your complaint (${ticket}), we need a little more information from you. Could you please share your order number and any additional details about the issue? 🙏`,
  },
  {
    key: 'custom',
    label: '✍️ Custom Reply',
    status: undefined,
    text: () => '',
  },
]

function ReplyDialog({
  complaint,
  onClose,
}: {
  complaint: Complaint
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [statusFlag, setStatusFlag] = useState<string | undefined>(undefined)

  const reply = useReplyComplaint()

  const applyTemplate = (t: (typeof REPLY_TEMPLATES)[number]) => {
    setText(t.text(complaint.ticket_id))
    setStatusFlag(t.status)
  }

  const send = () => {
    if (!text.trim()) return
    reply.mutate(
      {
        ticket_id: complaint.ticket_id,
        message: text.trim(),
        ...(statusFlag ? { status: statusFlag } : {}),
      },
      { onSuccess: () => onClose() }
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageSquare className="h-5 w-5 text-sky-600" />
            Reply to {complaint.name || complaint.wa_id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-mono font-semibold text-foreground">
              {complaint.ticket_id}
            </span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {complaint.subject || complaint.complaint_type || 'Complaint'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {REPLY_TEMPLATES.map((t) => (
              <Button
                key={t.key}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => applyTemplate(t)}
              >
                {t.label}
              </Button>
            ))}
          </div>

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Type your reply to the customer..."
            className="mt-1"
          />

          {statusFlag && statusFlag !== 'custom' && (
            <p className="text-xs text-muted-foreground">
              This reply will also update the complaint status to{' '}
              <span className="font-semibold text-foreground">
                {STATUS_LABEL[statusFlag] ?? statusFlag}
              </span>
              .
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>

            <Button
              disabled={!text.trim() || reply.isPending}
              onClick={send}
              className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700"
            >
              {reply.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Reply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* MAIN TAB                                                            */
/* ------------------------------------------------------------------ */

export function ComplaintsTab() {
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<Complaint | null>(null)
  const [replying, setReplying] = useState<Complaint | null>(null)
  const [deleting, setDeleting] = useState<Complaint | null>(null)

  const { data, isLoading } = useComplaints({
    status: statusFilter || undefined,
  })

  const updateStatus = useUpdateComplaint()
  const resolve = useResolveComplaint()
  const remove = useDeleteComplaint()

  const complaints =
    data?.complaints.filter(
      (c) =>
        !search ||
        [c.ticket_id, c.wa_id, c.name, c.subject, c.complaint_type]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search.toLowerCase()))
    ) ?? []

  const busy = updateStatus.isPending || resolve.isPending || remove.isPending

  return (
    <div className="space-y-5 text-base">
      {/* TOP ROW: stats */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-base text-muted-foreground">
          <MessageSquareWarning className="h-4 w-4" />
          <span className="font-medium text-foreground">{complaints.length}</span>
          complaints
          {statusFilter && <span>(filtered)</span>}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            <AlertCircle className="h-4 w-4" />
            {(data?.open_count ?? 0)} open
          </span>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket, name, WA ID, subject..."
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
            {['open', 'in_progress', 'awaiting_info', 'resolved', 'closed'].map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {statusFilter && (
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter('')}>
            Clear
          </Button>
        )}
      </div>

      {/* TABLE */}
      {isLoading && !data ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-base text-muted-foreground">
          Loading complaints...
        </div>
      ) : complaints.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-muted-foreground">
          <MessageSquareWarning className="h-10 w-10 opacity-30" />
          <p className="text-base">
            {search || statusFilter
              ? 'No complaints match your filters.'
              : 'No complaints yet — they will appear here when users raise them.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Ticket</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {complaints.map((c) => (
                <TableRow key={c.ticket_id}>
                  <TableCell className="font-mono text-small whitespace-nowrap">
                    {c.ticket_id}
                  </TableCell>

                  <TableCell className="font-medium text-small">
                    <div>{c.name || '—'}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {c.wa_id}
                    </div>
                  </TableCell>

                  <TableCell className="text-small">
                    {c.complaint_type || 'Other'}
                  </TableCell>

                  <TableCell className="max-w-[220px] truncate text-small">
                    <div className="truncate">
                      {c.subject || <span className="text-muted-foreground italic">—</span>}
                    </div>
                    {c.last_user_message && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        <span className="font-semibold text-sky-600">Reply: </span>
                        {String(c.last_user_message).replace(/^\[[^\]]*\]\s*/, '')}
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="text-small">
                    <PriorityBadge priority={c.priority} />
                  </TableCell>

                  <TableCell className="text-small">
                    <StatusBadge status={c.status} />
                  </TableCell>

                  <TableCell className="whitespace-nowrap text-small text-muted-foreground">
                    {formatDate(c.created_at)}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="View details"
                        className="h-8 w-8"
                        onClick={() => setViewing(c)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        title="Reply to customer"
                        className="h-8 w-8 text-sky-600 hover:text-sky-700"
                        disabled={busy}
                        onClick={() => setReplying(c)}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>

                      {c.status !== 'resolved' && c.status !== 'closed' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Mark resolved"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                          disabled={busy}
                          onClick={() => resolve.mutate(c.ticket_id)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}

                      {c.status === 'resolved' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Reopen"
                          className="h-8 text-xs text-amber-600 hover:text-amber-700"
                          disabled={busy}
                          onClick={() =>
                            updateStatus.mutate({ ticket_id: c.ticket_id, status: 'open' })
                          }
                        >
                          Reopen
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        disabled={busy}
                        onClick={() => setDeleting(c)}
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

      {(updateStatus.isPending || resolve.isPending) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Updating complaint...
        </div>
      )}

      {/* DETAIL DIALOG */}
      {viewing && (
        <ComplaintDetail
          complaint={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      {/* REPLY DIALOG */}
      {replying && (
        <ReplyDialog
          complaint={replying}
          onClose={() => setReplying(null)}
        />
      )}

      {/* DELETE CONFIRMATION */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete Complaint</AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-relaxed">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-foreground">
                {deleting?.ticket_id}
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
                  remove.mutate(deleting.ticket_id)
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

export default ComplaintsTab