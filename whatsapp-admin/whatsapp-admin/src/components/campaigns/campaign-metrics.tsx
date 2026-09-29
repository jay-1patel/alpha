import { useState } from 'react'
import { format } from 'date-fns'
import {
  ArrowLeft,
  CheckCheck,
  Eye,
  Inbox,
  Loader2,
  MessageSquare,
  Send,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Campaign, CampaignReply } from '@/lib/types'
import {
  useCampaignMetrics,
  useCampaignReplies,
} from '@/lib/hooks/useCampaigns'
import { navigateTo } from '@/lib/navigation'

/* ------------------------------------------------------------------ */
/* FUNNEL STEP                                                        */
/* ------------------------------------------------------------------ */

function FunnelRow({
  icon: Icon,
  label,
  value,
  total,
  barColor,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  total: number
  barColor: string
}) {
  const pct =
    total > 0 ? Math.min(100, (value / total) * 100) : 0

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </span>

        <span className="tabular-nums">
          <span className="font-bold">{value}</span>{' '}
          {!!total && (
            <span className="text-xs text-muted-foreground">
              ({Math.round(pct)}%)
            </span>
          )}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* METRICS SLIDE-OVER                                                 */
/* ------------------------------------------------------------------ */

interface CampaignMetricsProps {
  campaign: Campaign | null
  onClose: () => void
}

export function CampaignMetrics({
  campaign,
  onClose,
}: CampaignMetricsProps) {
  const [tab, setTab] = useState<'funnel' | 'replies'>(
    'funnel'
  )

  const campaignId = campaign?.id ?? null

  const { data: metrics, isLoading } =
    useCampaignMetrics(campaignId)

  /* Replies poll every 5s while mounted */
  const repliesQuery = useCampaignReplies(campaignId)
  const loadingReplies = repliesQuery.isLoading
  const replies = repliesQuery.data ?? ([] as CampaignReply[])

  if (!campaign) return null

  const progress = metrics?.progress
  const funnel = metrics?.funnel
  const total = progress?.total ?? campaign.target_count ?? 0
  const sent = progress?.sent ?? funnel?.sent ?? 0

  const sendingPct =
    total > 0 ? Math.min(100, (sent / total) * 100) : 0

  const openInInbox = (waId: string) => {
    onClose()
    navigateTo(`/inbox?wa_id=${encodeURIComponent(waId)}`)
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* BACKDROP */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* PANEL */}
      <aside
        className="
          absolute right-0 top-0 flex h-full w-full max-w-xl
          translate-x-0 flex-col bg-background shadow-2xl
          transition-transform duration-300
        "
      >
        {/* HEADER */}

        <div className="border-b px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Campaign Report
              </p>

              <h2 className="truncate text-lg font-bold">
                {campaign.name}
              </h2>

              <p className="text-sm capitalize text-muted-foreground">
                Status:{' '}
                <span className="font-semibold">
                  {metrics?.status ?? campaign.status}
                </span>
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* TABS */}

        <div className="flex gap-1 border-b px-5 pt-2">
          {(
            [
              ['funnel', 'Funnel'],
              ['replies', 'Replies'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                `
                  rounded-t-lg px-4 py-2 text-sm font-semibold
                  border-b-2 transition-colors
                `,
                tab === id
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
              {id === 'replies' &&
                !!replies?.length && (
                  <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700">
                    {replies.length}
                  </span>
                )}
            </button>
          ))}
        </div>

        <ScrollArea className="min-h-0 flex-1 p-5">
          {/* ------------------------------------------------ */}
          {/* FUNNEL TAB                                      */}
          {/* ------------------------------------------------ */}

          {tab === 'funnel' && (
            <div className="space-y-6">
              {/* PROGRESS BAR */}

              {(campaign.status === 'sending' ||
                metrics?.status === 'sending') && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold text-sky-700">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </span>

                    <span className="tabular-nums">
                      {sent}/{total} messages
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-sky-100">
                    <div
                      className="h-full rounded-full bg-sky-600 transition-all duration-500"
                      style={{ width: `${sendingPct}%` }}
                    />
                  </div>
                </div>
              )}

              {isLoading && !metrics ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Loading metrics...
                </p>
              ) : (
                <div className="space-y-5 rounded-xl border p-4">
                  <FunnelRow
                    icon={Send}
                    label="Sent"
                    value={funnel?.sent ?? sent}
                    total={total}
                    barColor="bg-blue-500"
                  />

                  <FunnelRow
                    icon={CheckCheck}
                    label="Delivered"
                    value={funnel?.delivered ?? campaign.metrics?.delivered ?? 0}
                    total={total}
                    barColor="bg-sky-500"
                  />

                  <FunnelRow
                    icon={Eye}
                    label="Read"
                    value={funnel?.read ?? campaign.metrics?.read ?? 0}
                    total={total}
                    barColor="bg-violet-500"
                  />

                  <FunnelRow
                    icon={MessageSquare}
                    label="Replied"
                    value={funnel?.replied ?? campaign.metrics?.replied ?? 0}
                    total={total}
                    barColor="bg-green-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* REPLIES TAB                                     */}
          {/* ------------------------------------------------ */}

          {tab === 'replies' && (
            <div className="space-y-2">
              {loadingReplies && !replies?.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Loading replies...
                </p>
              )}

              {!loadingReplies && !replies?.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No replies yet.
                </p>
              )}

              {(replies ?? []).map((r: CampaignReply) => (
                <button
                  key={r.wa_id + r.replied_at}
                  type="button"
                  onClick={() => openInInbox(r.wa_id)}
                  className="
                    group w-full rounded-xl border bg-card p-3 text-left
                    transition-all hover:border-sky-300 hover:shadow-sm
                  "
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {r.name || r.wa_id}
                    </p>

                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {format(
                        new Date(r.replied_at),
                        'dd MMM, h:mm a'
                      )}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {r.reply_text}
                  </p>

                  <span className="
                    mt-2 inline-flex items-center gap-1 text-xs
                    font-semibold text-sky-600 opacity-0 transition-opacity
                    group-hover:opacity-100
                  ">
                    <ArrowLeft className="h-3 w-3 rotate-180" />
                    Continue in Inbox
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* FOOTER HINT */}

        <div className="border-t px-5 py-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Inbox className="h-3.5 w-3.5" />
            Click any reply to jump straight into the Inbox with that
            distributor.
          </p>
        </div>
      </aside>
    </div>
  )
}

export default CampaignMetrics
