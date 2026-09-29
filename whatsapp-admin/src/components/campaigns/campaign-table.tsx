import { format } from 'date-fns'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Campaign, CampaignStatus } from '@/lib/types'
import { useDuplicateCampaign } from '@/lib/hooks/useCampaigns'

import {
  BarChart3,
  Copy,
  Megaphone,
  Trash2,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* STATUS BADGE                                                       */
/* ------------------------------------------------------------------ */

const STATUS_STYLE: Record<
  CampaignStatus,
  string
> = {
  draft: 'bg-slate-100 text-slate-600 ring-slate-200',
  scheduled:
    'bg-blue-50 text-blue-700 ring-blue-200',
  sending:
    'bg-sky-50 text-sky-700 ring-sky-200',
  completed:
    'bg-green-50 text-green-700 ring-green-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
}

export function StatusBadge({
  status,
}: {
  status: CampaignStatus | undefined
}) {
  return (
    <span
      className={cn(
        `
          inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5
          text-xs font-semibold capitalize ring-1
        `,
        STATUS_STYLE[status ?? 'draft']
      )}
    >
      {(status === 'sending' ||
        status === 'scheduled') && (
        <span
          className={cn(
            'h-1.5 w-1.5 animate-pulse rounded-full',
            status === 'sending'
              ? 'bg-sky-500'
              : 'bg-blue-500'
          )}
        />
      )}
      {status ?? 'draft'}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* AUDIENCE LABEL                                                     */
/* ------------------------------------------------------------------ */

function audienceLabel(c: Campaign) {
  if (c.audience_type === 'all') return 'All Distributors'

  const parts: string[] = []

  if (c.segment?.regions?.length) {
    parts.push(c.segment.regions.join(', '))
  }

  if (c.segment?.tiers?.length) {
    parts.push(c.segment.tiers.join(', '))
  }

  if (c.segment?.product_interests?.length) {
    parts.push(c.segment.product_interests.join(', '))
  }

  return parts.length ? parts.join(' · ') : 'Custom segment'
}

/* ------------------------------------------------------------------ */
/* TABLE                                                              */
/* ------------------------------------------------------------------ */

interface CampaignTableProps {
  campaigns: Campaign[]
  onViewReport: (c: Campaign) => void
  onDelete?: (c: Campaign) => void
}

export function CampaignTable({
  campaigns,
  onViewReport,
  onDelete,
}: CampaignTableProps) {
  const duplicate = useDuplicateCampaign()

  if (!campaigns.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-muted-foreground">
        <Megaphone className="h-10 w-10 opacity-30" />

        <p className="text-sm">
          No campaigns yet — create your first broadcast.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead>Campaign</TableHead>

            <TableHead>Status</TableHead>

            <TableHead>Target Audience</TableHead>

            <TableHead>Scheduled</TableHead>

            <TableHead>Delivered / Read / Replied</TableHead>

            <TableHead className="text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {campaigns.map((c) => (
            <TableRow
              key={String(c.id)}
              className="cursor-pointer"
              onClick={() => {
                if (
                  c.status === 'sending' ||
                  c.status === 'completed' ||
                  c.status === 'failed'
                ) {
                  onViewReport(c)
                }
              }}
            >
              {/* NAME */}

              <TableCell className="font-semibold">
                <div className="flex flex-col">
                  <span className="truncate">
                    {c.name}
                  </span>

                  <span className="text-xs font-normal text-muted-foreground">
                    {c.template_type
                      ?.replace(/_/g, ' ')
                      .replace(/^\w/, (ch) =>
                        ch.toUpperCase()
                      )}
                  </span>
                </div>
              </TableCell>

              {/* STATUS */}

              <TableCell>
                <StatusBadge status={c.status} />
              </TableCell>

              {/* AUDIENCE */}

              <TableCell>
                <div className="max-w-[220px] truncate text-sm">
                  {audienceLabel(c)}
                </div>

                {!!c.target_count && (
                  <span className="text-xs text-muted-foreground">
                    ~{c.target_count} distributors
                  </span>
                )}
              </TableCell>

              {/* SCHEDULED TIME */}

              <TableCell className="whitespace-nowrap text-sm">
                {c.schedule_mode === 'now' ? (
                  <span className="text-muted-foreground">
                    Send now
                  </span>
                ) : c.scheduled_at ? (
                  format(
                    new Date(c.scheduled_at),
                    'dd MMM yyyy, h:mm a'
                  )
                ) : (
                  '—'
                )}

                {c.timezone && (
                  <div className="text-xs text-muted-foreground">
                    {c.timezone}
                  </div>
                )}
              </TableCell>

              {/* METRICS */}

              <TableCell>
                <div className="flex items-center gap-3 text-sm tabular-nums">
                  <MetricChip
                    value={c.metrics?.sent}
                    total={c.target_count}
                    label="D"
                    color="text-blue-600"
                  />

                  <MetricChip
                    value={c.metrics?.read}
                    total={c.target_count}
                    label="R"
                    color="text-violet-600"
                  />

                  <MetricChip
                    value={c.metrics?.replied}
                    total={c.target_count}
                    label="↩"
                    color="text-green-600"
                  />
                </div>
              </TableCell>

              {/* ACTIONS */}

              <TableCell className="text-right">
                <div
                  className="
                    flex items-center justify-end gap-1
                  "
                  onClick={(e) => e.stopPropagation()}
                >
                  {(c.status === 'sending' ||
                    c.status === 'completed') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="View report"
                      className="h-8 w-8"
                      onClick={() => onViewReport(c)}
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    title="Duplicate"
                    className="h-8 w-8"
                    disabled={duplicate.isPending}
                    onClick={() => duplicate.mutate(c.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>

                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => onDelete(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* METRIC CHIP                                                        */
/* ------------------------------------------------------------------ */

function MetricChip({
  value,
  total,
  label,
  color,
}: {
  value?: number
  total?: number
  label: string
  color: string
}) {
  return (
    <span
      className="inline-flex items-baseline gap-1"
      title={`${label}: ${value ?? 0}${
        total ? ` of ${total}` : ''
      }`}
    >
      <span className={cn('font-bold', color)}>
        {value ?? 0}
      </span>

      {!!total && (
        <span className="text-[10px] text-muted-foreground">
          /{total}
        </span>
      )}
    </span>
  )
}

export default CampaignTable
