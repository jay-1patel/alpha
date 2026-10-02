/**
 * Permissions, mirrored from `ALL_PERMISSIONS` in `backend/routes/auth.py`.
 *
 * Two separate things use this:
 *   - the console decides which screens and buttons a signed-in admin sees, and
 *   - the Team screen renders one switch per permission, grouped for readability.
 *
 * The server re-checks every one of these. Hiding a button is politeness; the
 * authorisation that matters is in `require_permission` / `require_tenant_access`.
 */

import { useAuth } from './auth'

export const PERMISSION_GROUPS: { label: string; permissions: string[] }[] = [
  {
    label: 'Tenant configuration',
    permissions: ['manage_operations'],
  },
  {
    label: 'Team',
    permissions: ['manage_admins'],
  },
  {
    label: 'Content',
    permissions: ['upload_faq', 'upload_kb', 'view_files', 'delete_files'],
  },
  {
    label: 'Products & brochure',
    permissions: [
      'view_products',
      'edit_delete_products',
      'catalogue_new_arrival',
      'view_distributors',
      'manage_distributors',
    ],
  },
  {
    label: 'Conversations',
    permissions: ['chat', 'chat_history', 'view_inbox'],
  },
  {
    label: 'Operations',
    permissions: ['view_orders', 'manage_orders', 'view_complaints', 'manage_complaints', 'view_customers'],
  },
  {
    label: 'Growth',
    permissions: ['view_campaigns', 'manage_campaigns', 'view_analytics'],
  },
]

export const PERMISSION_LABELS: Record<string, string> = {
  manage_admins: 'Manage admins',
  upload_faq: 'Upload FAQ files',
  upload_kb: 'Upload KB files',
  view_files: 'View uploaded files',
  delete_files: 'Delete uploaded files',
  view_products: 'View products',
  edit_delete_products: 'Edit/delete products',
  manage_operations: 'Manage operations (profiles, menus, tenants)',
  chat: 'Use admin chat',
  chat_history: 'View chat history',
  catalogue_new_arrival: 'Manage brochure and new releases',
  view_orders: 'View orders',
  manage_orders: 'Edit/delete orders',
  view_complaints: 'View complaints',
  manage_complaints: 'Handle complaints',
  view_customers: 'View customers',
  view_analytics: 'View analytics',
  view_inbox: 'Live inbox',
  view_campaigns: 'Campaigns',
  manage_campaigns: 'Edit/delete campaigns',
  view_distributors: 'Distributors',
  manage_distributors: 'Add/edit/delete distributors',
}

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS)

/** Reading or changing anything tenant-scoped needs manage_operations. */
export const TENANT_PERMISSION = 'manage_operations'
/** The team screen needs manage_admins. */
export const TEAM_PERMISSION = 'manage_admins'

export function usePermissions() {
  const { can, identity } = useAuth()
  return {
    identity,
    isSuperAdmin: identity?.role === 'super_admin',
    can,
    canManageTenants: can(TENANT_PERMISSION),
    canManageTeam: can(TEAM_PERMISSION),
  }
}
