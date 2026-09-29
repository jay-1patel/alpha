/* ------------------------------------------------------------------ */
/* INBOX                                                              */
/* ------------------------------------------------------------------ */

export type ChatPriority = 'normal'

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
/* COMPLAINTS                                                         */
/* ------------------------------------------------------------------ */

export interface Complaint {
  id?: number
  ticket_id: string
  wa_id?: string
  name?: string
  complaint_type?: string
  subject?: string
  description?: string
  status?: string
  priority?: string
  assigned_to?: string
  created_at?: string
  updated_at?: string
  resolved_at?: string
  last_user_message?: string
}

export interface ComplaintsResponse {
  complaints: Complaint[]
  count: number
  open_count: number
}

/* ------------------------------------------------------------------ */
/* ORDERS                                                             */
/* ------------------------------------------------------------------ */

export interface OrderItem {
  name?: string
  product_id?: string | number
  product_name?: string
  qty?: number
  quantity?: number
  price?: number
  unit_price?: number
  amount?: number
}

export interface Order {
  id: number | string
  order_number: string
  wa_id?: string
  items?: OrderItem[]
  total_amount?: number
  status?: string
  payment_status?: string
  payment_method?: string
  order_type?: string
  source?: string
  tier?: string
  discount_applied?: number
  delivery_date?: string
  customer_name?: string
  customer_mobile?: string
  customer_address?: string
  customer_pincode?: string
  idempotency_key?: string
  created_at?: string
}

export interface OrderCounts {
  total: number
  placed: number
  delivered: number
  cancelled: number
  revenue: number
}

export interface OrdersResponse {
  orders: Order[]
  count: number
  counts: OrderCounts
}

export interface OrderStats {
  total: number
  revenue: number
  placed: number
  cancelled: number
  delivered: number
  by_status: Record<string, number>
  by_type: Record<string, number>
}

/* ------------------------------------------------------------------ */
/* CUSTOMERS                                                          */
/* ------------------------------------------------------------------ */

export interface Customer {
  wa_id: string
  name?: string
  mobile?: string
  total_orders: number
  total_complaints: number
  open_complaints: number
  total_spent: number
  last_active?: string
}

export interface CustomersResponse {
  customers: Customer[]
  count: number
}

/* ------------------------------------------------------------------ */
/* MENUS (admin-editable WhatsApp menus)                               */
/* ------------------------------------------------------------------ */

export interface MenuItemRow {
  item_id: string
  title: string
  description: string
  section: string
  icon: string
  sort_order: number
  is_active: boolean
}

export interface MenuSettings {
  header: string
  body: string
  button_text: string
}

export interface MenuData {
  menu_key: string
  items: MenuItemRow[]
  settings: MenuSettings
}

export interface MenusResponse {
  menus: { menu_key: string; items: MenuItemRow[] }[]
}
