import { useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import type { Conversation } from '@/lib/types'
import { useAssignConversation, useChatQueue, useDeleteConversation } from '@/lib/hooks/useInbox'
import { useInboxStore, type QueueFilter } from '@/store/ui-store'

/* ------------------------------------------------------------------ */
/* FILTER OPTIONS                                                     */
/* ------------------------------------------------------------------ */

const FILTERS: { id: QueueFilter; label: string; dot?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'normal', label: 'Active', dot: 'bg-green-500' },
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

/** Column 2 — live conversations list */
export function ConversationList({ onSelect }: { onSelect?: (waId: string) => void }) {
  const { data: conversations, isLoading } = useChatQueue()

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const queueFilter = useInboxStore((s) => s.queueFilter)
  const selectedWaId = useInboxStore((s) => s.selectedWaId)
  const selectConversation = useInboxStore((s) => s.selectConversation)
  const assign = useAssignConversation()
  const deleteConvo = useDeleteConversation()

  const filtered = (conversations ?? []).filter((c) => {
    if (queueFilter === 'all') return true
    if (queueFilter === 'unassigned') return !c.assigned_agent_id
    return c.priority === queueFilter
  })

  const prevFilter = useRef(queueFilter)
  if (prevFilter.current !== queueFilter) {
    prevFilter.current = queueFilter
    setVisibleCount(PAGE_SIZE)
  }

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const handleSelect = (c: Conversation) => {
    if (!c.assigned_agent_id && !assign.isPending) {
      assign.mutate(c.wa_id)
    }
    selectConversation(c.wa_id)
    onSelect?.(c.wa_id)
  }

  const handleDeleteClick = (e: React.MouseEvent, waId: string) => {
    e.stopPropagation()
    setDeleteTarget(waId)
  }

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteConvo.mutate(deleteTarget)
      setDeleteTarget(null)
    }
  }

  return (
    <>
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
              const selected = selectedWaId === c.wa_id

              return (
                <button
                  key={c.wa_id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className={cn(
                    `
                      w-full rounded-lg border border-l-4 border-l-slate-300 bg-card p-3 text-left
                      transition-all hover:shadow-sm
                    `,
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

                    <div className="flex items-center gap-2">
                      {!!c.unread_count && c.unread_count > 0 && (
                        <span className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                          {c.unread_count}
                        </span>
                      )}

                      {c.handover_mode === 'human' && (
                        <span className="mt-0.5 flex h-5 shrink-0 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                          HUMAN
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, c.wa_id)}
                        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Delete conversation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                      {c.assigned_agent_id ? c.assigned_agent_name || 'Assigned' : 'Unassigned'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {c.last_message_at && (
                        <span className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(c.last_message_at), {
                            addSuffix: true,
                          })}
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the conversation with <strong>{deleteTarget}</strong> from the inbox. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
