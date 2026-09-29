import { create } from 'zustand'

import type { AgentStatus, ChatPriority } from '@/lib/types'

export type QueueFilter = 'all' | 'normal' | 'unassigned'

interface InboxUiState {
  /* Agent presence (client-side until backend persists it) */
  agentStatus: AgentStatus
  setAgentStatus: (s: AgentStatus) => void

  /* Queue filter: all | normal | unassigned */
  queueFilter: QueueFilter
  setQueueFilter: (f: QueueFilter) => void

  /* Currently open conversation */
  selectedWaId: string | null
  selectConversation: (waId: string | null) => void

  /* Context drawer visibility */
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
}

export const useInboxStore = create<InboxUiState>((set) => ({
  agentStatus: 'online',
  setAgentStatus: (agentStatus) => set({ agentStatus }),

  queueFilter: 'all',
  setQueueFilter: (queueFilter) =>
    set({
      queueFilter,
      /* Reset selection if it no longer matches the filter is left to UI logic */
    }),

  selectedWaId: null,
  selectConversation: (selectedWaId) => set({ selectedWaId }),

  drawerOpen: false,
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
}))
