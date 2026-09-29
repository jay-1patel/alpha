import { useState } from 'react'
import {
  Megaphone,
  MessageSquareText,
  Plus,
  Radio,
  SendHorizonal,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import type { Campaign } from '@/lib/types'
import { useCampaigns, useDeleteCampaign } from '@/lib/hooks/useCampaigns'

import CampaignTable from './campaign-table'
import CampaignBuilder from './campaign-builder'
import CampaignMetrics from './campaign-metrics'

/* ------------------------------------------------------------------ */
/* STAT CARD                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  suffix?: string
  accent: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <span
        className={`
          flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white
          ${accent}
        `}
      >
        <Icon className="h-5 w-5" />
      </span>

      <div className="min-w-0">
        <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>

        <p className="text-xl font-bold tabular-nums">
          {value}
          {suffix && (
            <span className="text-sm font-medium text-muted-foreground">
              {suffix}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* CAMPAIGNS PAGE                                                     */
/* ------------------------------------------------------------------ */

export function CampaignsTab() {
  const { data, isLoading } = useCampaigns()

  const [builderOpen, setBuilderOpen] = useState(false)

  const [editing, setEditing] = useState<Campaign | null>(null)

  const [reportTarget, setReportTarget] =
    useState<Campaign | null>(null)

  const [deleting, setDeleting] = useState<Campaign | null>(null)

  const deleteMut = useDeleteCampaign(() => setDeleting(null))

  const [builderKey, setBuilderKey] = useState(0)

  const stats = data?.stats

  return (
    <div className="space-y-5">
      {/* TOP STATS BAR */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={SendHorizonal}
          label="Total Sent (24h)"
          value={stats?.total_sent_24h ?? 0}
          accent="bg-gradient-to-r from-sky-600 to-blue-600"
        />

        <StatCard
          icon={Radio}
          label="Delivery Rate"
          value={stats?.delivery_rate ?? 0}
          suffix="%"
          accent="bg-sky-500"
        />

        <StatCard
          icon={MessageSquareText}
          label="Reply Rate"
          value={stats?.reply_rate ?? 0}
          suffix="%"
          accent="bg-green-500"
        />

        <StatCard
          icon={Megaphone}
          label="Active Campaigns"
          value={stats?.active_campaigns ?? 0}
          accent="bg-amber-500"
        />
      </div>

      {/* TABLE HEADER ROW */}

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">All Campaigns</h3>

        <Button
          onClick={() => {
            setEditing(null)
            setBuilderKey((k) => k + 1)
            setBuilderOpen(true)
          }}
          className="gap-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* TABLE */}

      {isLoading && !data ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          Loading campaigns...
        </div>
      ) : (
        <CampaignTable
          campaigns={data?.campaigns ?? []}
          onViewReport={(c) => setReportTarget(c)}
          onDelete={(c) => setDeleting(c)}
        />
      )}

      {/* BUILDER MODAL */}

      <CampaignBuilder
        key={editing ? `edit-${editing.id}` : `new-${builderKey}`}
        open={builderOpen}
        initial={editing}
        onClose={() => {
          setBuilderOpen(false)
          setEditing(null)
        }}
      />

      {/* METRICS SLIDE-OVER */}

      <CampaignMetrics
        campaign={reportTarget}
        onClose={() => setReportTarget(null)}
      />

      {/* DELETE CONFIRM */}

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-relaxed">
              Are you sure you want to delete <strong>{deleting?.name}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel className="text-base">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-base text-white hover:bg-red-700"
              onClick={() => deleting && deleteMut.mutate(deleting.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default CampaignsTab
