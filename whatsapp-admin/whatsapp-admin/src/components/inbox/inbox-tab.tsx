import { useEffect } from 'react'

import {
  useAgents,
  useChatQueue,
  useSetAgentStatus,
} from '@/lib/hooks/useInbox'
import { getQueryParam } from '@/lib/navigation'
import { useInboxStore } from '@/store/ui-store'
import { Inbox as InboxIcon } from 'lucide-react'

import ChatWindow from './chat-window'
import ContextDrawer from './context-drawer'
import { ConversationList, QueueFilters } from './queue-list'
import { AgentStatusDropdown } from './inbox-widgets'

/* ------------------------------------------------------------------ */
/* INBOX PAGE — 4-COLUMN LAYOUT                                       */
/* ------------------------------------------------------------------ */

export function InboxTab() {
  const selectedWaId = useInboxStore((s) => s.selectedWaId)
  const selectConversation = useInboxStore((s) => s.selectConversation)

  const drawerOpen = useInboxStore((s) => s.drawerOpen)
  const setDrawerOpen = useInboxStore((s) => s.setDrawerOpen)

  const agentStatus = useInboxStore((s) => s.agentStatus)
  const setAgentStatus = useInboxStore((s) => s.setAgentStatus)

  const { data: agents } = useAgents()
  const setStatusMutation = useSetAgentStatus()
  const { data: conversations } = useChatQueue()

  /* -------------------------------------------------------------- */
  /* DEEP LINK: /inbox?wa_id=12345 (jump from Campaign replies)     */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    const waId = getQueryParam('wa_id')

    if (waId) {
      selectConversation(waId)
      window.history.replaceState(null, '', '/inbox')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* -------------------------------------------------------------- */
  /* Render                                                         */
  /* -------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-3">
      {/* TOP BAR — presence + agent status */}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>

          <p className="text-sm font-medium">
            {agents?.length ?? 0} agents online ·{' '}
            <span className="text-muted-foreground">
              {(conversations ?? []).filter((c) => !c.assigned_agent_id).length}{' '}
              waiting for a human
            </span>
          </p>
        </div>

        <AgentStatusDropdown
          status={agentStatus}
          onChange={(s) => {
            setAgentStatus(s)
            setStatusMutation.mutate(s)
          }}
        />
      </div>

      {/* WORKSPACE */}

      <div className="relative flex h-[calc(100vh-14rem)] min-h-[480px] overflow-hidden rounded-xl border bg-card shadow-sm">
        {/* COL 1 — QUEUE & FILTERS */}

        <div className="w-52 shrink-0 border-r max-md:hidden">
          <QueueFilters />
        </div>

        {/* COL 2 — CONVERSATIONS LIST */}

        <div className="w-72 shrink-0 border-r max-lg:hidden">
          <ConversationList />
        </div>

        {/* COL 3 — CHAT WINDOW */}

        <div className="min-w-0 flex-1">
          <ChatWindowWithQueue />
        </div>

        {/* COL 4 — CONTEXT DRAWER (slide-over) */}

        <ContextDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          waId={selectedWaId}
        />
      </div>

      {/* MOBILE FALLBACK LIST (below workspace on small screens) */}
      <div className="h-72 rounded-xl border bg-card lg:hidden">
        <ConversationList />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* CHAT WINDOW WRAPPER                                                */
/* ------------------------------------------------------------------ */

function ChatWindowWithQueue() {
  const selectedWaId = useInboxStore((s) => s.selectedWaId)
  const setDrawerOpen = useInboxStore((s) => s.setDrawerOpen)

  const { data: conversations, isLoading } = useChatQueue()

  const conversation =
    conversations?.find((c) => c.wa_id === selectedWaId) ?? null

  if (!selectedWaId || (!conversation && !isLoading)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <InboxIcon className="h-10 w-10 opacity-30" />

        <p className="text-sm">
          Select a conversation to start chatting
        </p>
      </div>
    )
  }

  return (
    <ChatWindow
      conversation={conversation}
      onOpenDrawer={() => setDrawerOpen(true)}
    />
  )
}

export default InboxTab
