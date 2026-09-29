import { useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ChatPriority, Conversation } from '@/lib/types'
import { useAssignConversation, useChatQueue } from '@/lib/hooks/useInbox'
import { useInboxStore, type QueueFilter } from '@/store/ui-store'

/* ------------------------------------------------------------------ */
/* PRIORITY STYLES                                                    */
/* ------------------------------------------------------------------ */

export const PRIORITY_BORDER: Record<ChatPriority, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-amber-500',
  normal: 'border-l-slate-300',
}

const PRIORITY_BADGE: Record<ChatPriority, { label: string; className: string }> = {
  urgent: {
    label: 'Urgent',
    className: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  },
  high: {
    label: 'High',
    className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
  normal: {
    label: 'Normal',
    className: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
  },
}

/* ------------------------------------------------------------------ */
/* FILTER OPTIONS                                                     */
/* ------------------------------------------------------------------ */

const FILTERS: { id: QueueFilter; label: string; dot?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'urgent', label: 'Urgent', dot: 'bg-red-500' },
  { id: 'high', label: 'High', dot: 'bg-amber-500' },
  { id: 'normal', label: 'Normal', dot: 'bg-slate-300' },
  { id: 'unassigned', label: 'Unassigned', dot: 'bg-indigo-500' },
]

/** How many conversations to render before showing "Load more". */
const PAGE_SIZE = 20

/** Column 1 — priority filters rail */
export function QueueFilters() {
  const queueFilter = useInboxStore((s) => s.queueFilter)
  const setQueueFilter = useInboxStore((s) => s.setQueueFilter)
  const { data: conversations } = useChatQueue()

  const countFor = (f: QueueFilter) =>
    f === 'all'
      ? conversations?.length ?? 0
      : f === 'unassigned'
        ? (conversations ?? []).filter((c) => !c.assigned_agent_id).length
        : (conversations ?? []).filter((c) => c.priority === f).length

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Queue
        </p>

        {FILTERS.map((f) => {
          const active = queueFilter === f.id

          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setQueueFilter(f.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {f.dot && (
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    f.dot
                  )}
                />
              )}

              <span className="flex-1 truncate text-left">{f.label}</span>

              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs tabular-nums',
                  active ? 'bg-white/20' : 'bg-muted text-muted-foreground'
                )}
              >
                {countFor(f.id)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Column 2 — live conversations list (sorted: urgent pinned on top) */
export function ConversationList({ onSelect }: { onSelect?: (waId: string) => void }) {
  const { data: conversations, isLoading } = useChatQueue()

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const queueFilter = useInboxStore((s) => s.queueFilter)
  const selectedWaId = useInboxStore((s) => s.selectedWaId)
  const selectConversation = useInboxStore((s) => s.selectConversation)
  const assign = useAssignConversation()

  /* -------------------------------------------------------------- */
  /* Filtering (queue query already sorts urgent-first)             */
  /* -------------------------------------------------------------- */

  const filtered = (conversations ?? []).filter((c) => {
    if (queueFilter === 'all') return true
    if (queueFilter === 'unassigned') return !c.assigned_agent_id
    return c.priority === queueFilter
  })

  /*
   * Reset pagination whenever the active filter changes so switching
   * tabs always starts from the top of the (new) list.
   */
  const prevFilter = useRef(queueFilter)
  if (prevFilter.current !== queueFilter) {
    prevFilter.current = queueFilter
    setVisibleCount(PAGE_SIZE)
  }

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const handleSelect = (c: Conversation) => {
    /*
     * Claiming: clicking an unassigned chat assigns it to the
     * current admin automatically.
     */
    if (!c.assigned_agent_id && !assign.isPending) {
      assign.mutate(c.wa_id)
    }

    selectConversation(c.wa_id)
    onSelect?.(c.wa_id)
  }

  /* -------------------------------------------------------------- */
  /* Render                                                         */
  /* -------------------------------------------------------------- */

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Conversations
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {isLoading && (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Loading queue...
            </p>
          )}

          {!isLoading && visible.length === 0 && (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Nothing here right now.
            </p>
          )}

          {visible.map((c) => {
            const badge = PRIORITY_BADGE[c.priority ?? 'normal']
            const selected = selectedWaId === c.wa_id

            return (
              <button
                key={c.wa_id}
                type="button"
                onClick={() => handleSelect(c)}
                className={cn(
                  `
                    w-full rounded-lg border border-l-4 bg-card p-3 text-left
                    transition-all hover:shadow-sm
                  `,
                  PRIORITY_BORDER[c.priority ?? 'normal'],
                  selected ? 'ring-2 ring-indigo-400' : 'hover:bg-accent/40'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {c.name || c.wa_id}
                    </p>

                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.last_message || 'No messages yet'}
                    </p>
                  </div>

                  {!!c.unread_count && c.unread_count > 0 && (
                    <span className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                      {c.unread_count}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      badge.className
                    )}
                  >
                    {badge.label}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {c.last_message_at && (
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.last_message_at), {
                          addSuffix: true,
                        })}
                      </span>
                    )}

                    {c.assigned_agent_name || c.assigned_agent_id ? (
                      <span
                        title={c.assigned_agent_name ?? c.assigned_agent_id ?? ''}
                        className="
                          flex h-6 w-6 items-center justify-center rounded-full
                          bg-gradient-to-br from-sky-500 to-blue-600
                          text-[10px] font-bold text-white
                        "
                      >
                        {(c.assigned_agent_name ?? c.assigned_agent_id ?? '?')
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    ) : (
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                        Unassigned
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}

          {hasMore && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="w-full rounded-md border border-dashed py-2 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Show more ({filtered.length - visibleCount} more)
            </button>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
