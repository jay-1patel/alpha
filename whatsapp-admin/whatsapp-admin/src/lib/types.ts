/* ------------------------------------------------------------------ */
/* INBOX                                                              */
/* ------------------------------------------------------------------ */

export type ChatPriority = 'urgent' | 'high' | 'normal'

export type AgentStatus = 'online' | 'away' | 'dnd'

export interface Agent {
  agent_id: string
  username: string
  status: AgentStatus
  active_chats?: number
}

export interface Conversation {
  wa_id: string
  name?: string
  last_message: string
  last_message_at?: string
  unread_count?: number
  priority: ChatPriority
  assigned_agent_id?: string | null
  assigned_agent_name?: string | null
  handover_mode?: 'bot' | 'human'
}

export interface ChatMessage {
  id?: string | number
  role: 'user' | 'agent' | 'bot' | 'system'
  sender?: string
  text?: string
  body?: string
  media_url?: string | null
  media_type?: string | null
  created_at?: string
  timestamp?: string
}

export interface DistributorInfo {
  wa_id: string
  name?: string
  region?: string
  tier?: string
  sales_volume_tier?: string
  last_order_value?: number | string
  outstanding_payments?: number | string
  bot_state?: string | null
  viewing_product?: string | null
}

/* ------------------------------------------------------------------ */
/* CAMPAIGNS                                                          */
/* ------------------------------------------------------------------ */

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'completed'
  | 'failed'

export type TemplateType =
  | 'plain_text'
  | 'interactive_button'
  | 'interactive_list'
  | 'document'

export interface AudienceSegment {
  regions?: string[]
  tiers?: string[]
  product_interests?: string[]
}

export interface Campaign {
  id: number | string
  name: string
  status: CampaignStatus
  audience_type: 'all' | 'segment'
  segment?: AudienceSegment | null
  target_count?: number
  template_type: TemplateType
  message_template: string
  template_variables?: Record<string, string>
  buttons?: { label: string; value: string }[]
  list_items?: { title: string; description?: string }[]
  media_filename?: string | null
  schedule_mode: 'now' | 'later'
  scheduled_at?: string | null
  timezone?: string
  created_at?: string
  metrics?: {
    sent?: number
    delivered?: number
    read?: number
    replied?: number
    failed?: number
  }
}

export interface CampaignsResponse {
  campaigns: Campaign[]
  stats: {
    total_sent_24h: number
    delivery_rate: number
    reply_rate: number
    active_campaigns: number
  }
}

export interface CampaignMetrics {
  campaign_id: number | string
  status: CampaignStatus
  progress: {
    sent: number
    total: number
  }
  funnel: {
    sent: number
    delivered: number
    read: number
    replied: number
  }
  replies?: CampaignReply[]
}

export interface CampaignReply {
  wa_id: string
  name?: string
  reply_text: string
  replied_at: string
}

/* ------------------------------------------------------------------ */
/* DISTRIBUTORS                                                       */
/* ------------------------------------------------------------------ */

export interface Distributor {
  wa_id: string
  name: string
  phone?: string
  email?: string
  region?: string
  tier?: 'Gold' | 'Silver' | 'Bronze'
  product_interests?: string[]
  sales_volume?: number
  last_order_value?: number
  outstanding_payments?: number
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface DistributorsResponse {
  distributors: Distributor[]
}

/* ------------------------------------------------------------------ */
/* MENU MANAGER (dynamic menus)                                        */
/* ------------------------------------------------------------------ */

export type MenuActionType = 'text' | 'rag' | 'menu'

export interface MenuItem {
  id: number
  title: string
  payload: string
  action_type: MenuActionType
  action_data: string
  parent_id: number | null
  menu_type: string
  section: string | null
  sort_order: number
  is_active: number
  created_at?: string
  updated_at?: string
  children?: MenuItem[]
}

export interface MenusResponse {
  status: string
  menus: MenuItem[]
  tree: {
    root: MenuItem[]
    flat: MenuItem[]
  }
  grouped: Record<string, MenuItem[]>
  total: number
}
