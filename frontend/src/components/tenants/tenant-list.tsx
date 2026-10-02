import { Building2, PlusCircle, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTenants, tenantsApi } from '@/lib/tenants'
import { navigate } from '@/lib/router'
import { usePermissions } from '@/lib/permissions'
import { getVertical } from '@/lib/verticals'
import { useAction } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, EmptyState, LoadingBlock } from '@/components/ui/feedback'
import { VerticalGlyph } from '@/components/vertical-icon'
import { PageHeader } from '@/components/layout/page-header'
import { useToast } from '@/components/ui/toast'
import type { Tenant } from '@/lib/types'

export function TenantList() {
  const { tenants, loading, error, reload } = useTenants()
  const { canManageTenants } = usePermissions()
  const [confirming, setConfirming] = useState<string | null>(null)
  const action = useAction()
  const toast = useToast()

  const remove = async (tenant: Tenant) => {
    const result = await action.run(() => tenantsApi.remove(tenant.id))
    if (result) {
      toast.push(`Tenant "${tenant.id}" deleted`)
      setConfirming(null)
      reload()
    }
  }

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="Each tenant is one business on WhatsApp. Behaviour comes from its profile — menus, intents, features and flows are all data."
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={reload} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => navigate('/register')}
              icon={<PlusCircle className="h-4 w-4" />}
            >
              Register a tenant
            </Button>
          </>
        }
      />

      {error && (
        <Alert tone="danger" title="Could not load tenants" className="mb-5">
          {error}
        </Alert>
      )}
      {action.error && (
        <Alert tone="danger" className="mb-5">
          {action.error}
        </Alert>
      )}

      {loading ? (
        <LoadingBlock label="Loading tenants…" />
      ) : tenants.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="No tenants registered yet"
            description="Registration asks for the company, the business field, its capabilities and its guardrails — then publishes a versioned profile the bot reads."
            action={
              canManageTenants ? (
                <Button variant="primary" onClick={() => navigate('/register')} icon={<PlusCircle className="h-4 w-4" />}>
                  Register your first tenant
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {tenants.map((tenant) => {
            const vertical = getVertical(tenant.vertical)
            const open = () => navigate(`/tenants/${encodeURIComponent(tenant.id)}/overview`)
            return (
              <Card key={tenant.id} className="p-5 transition hover:ring-accent-300">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200">
                    <VerticalGlyph name={vertical.icon} className="h-5 w-5" />
                  </div>

                  <button type="button" onClick={open} className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">{tenant.display_name || tenant.id}</span>
                      <Badge tone="accent">{vertical.short}</Badge>
                      {tenant.current_version ? (
                        <Badge tone="success">live v{tenant.current_version}</Badge>
                      ) : (
                        <Badge tone="warning">no published version</Badge>
                      )}
                      {tenant.status && tenant.status !== 'active' && (
                        <Badge tone="danger">{tenant.status}</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 font-mono text-xs text-slate-500">
                      {tenant.id}
                      {tenant.waba_phone_id ? ` · phone ${tenant.waba_phone_id}` : ' · no phone bound'}
                    </p>
                    <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400">{vertical.blurb}</p>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={open}>
                      {canManageTenants ? 'Configure' : 'View'}
                    </Button>
                    {canManageTenants &&
                      (confirming === tenant.id ? (
                        <>
                          <Button size="sm" variant="danger" loading={action.busy} onClick={() => remove(tenant)}>
                            Confirm
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Delete tenant"
                          onClick={() => setConfirming(tenant.id)}
                          icon={<Trash2 className="h-4 w-4" />}
                        />
                      ))}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
