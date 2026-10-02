import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getActiveTenantId, setActiveTenantId } from './api'
import type {
  Features,
  LayerDetail,
  ProfileSnapshot,
  ResolvedProfile,
  SmokeReport,
  Tenant,
  TenantToken,
  TestQuestionResult,
  VersionRecord,
} from './types'

/** Every call the tenant console makes against `/api/admin/tenants`. */
export const tenantsApi = {
  list: () => api.get<{ tenants: Tenant[] }>('/api/admin/tenants').then((r) => r.tenants),

  create: (body: {
    tenant_id: string
    slug?: string
    vertical: string
    display_name?: string
    waba_phone_id?: string
    status?: string
  }) => api.post<{ ok: boolean; tenant: Tenant }>('/api/admin/tenants', body),

  remove: (id: string) => api.del<{ ok: boolean }>(`/api/admin/tenants/${encodeURIComponent(id)}`),

  bindPhone: (id: string, waba_phone_id: string) =>
    api.post<{ ok: boolean }>(`/api/admin/tenants/${encodeURIComponent(id)}/phone-id`, {
      waba_phone_id,
    }),

  detail: (id: string, signal?: AbortSignal) =>
    api.get<LayerDetail>(`/api/admin/tenants/${encodeURIComponent(id)}/detail`, signal),

  resolved: (id: string, signal?: AbortSignal) =>
    api.get<ResolvedProfile>(`/api/admin/tenants/${encodeURIComponent(id)}/resolved`, signal),

  saveDraft: (id: string, snapshot: ProfileSnapshot) =>
    api.put<{ ok: boolean; validation: string[] }>(
      `/api/admin/tenants/${encodeURIComponent(id)}/profile`,
      { snapshot },
    ),

  publish: (id: string) =>
    api.post<{ ok: boolean; version: number; active_intents: string[]; visible_buttons: string[] }>(
      `/api/admin/tenants/${encodeURIComponent(id)}/publish`,
    ),

  versions: (id: string) =>
    api.get<{ tenant_id: string; current_version: number; versions: VersionRecord[] }>(
      `/api/admin/tenants/${encodeURIComponent(id)}/versions`,
    ),

  version: (id: string, version: number) =>
    api.get<Record<string, unknown>>(
      `/api/admin/tenants/${encodeURIComponent(id)}/versions/${version}`,
    ),

  rollback: (id: string, version: number) =>
    api.post<{ ok: boolean; version: number; active: number }>(
      `/api/admin/tenants/${encodeURIComponent(id)}/rollback`,
      { version },
    ),

  tokens: (id: string) =>
    api.get<{ tenant_id: string; tokens: TenantToken[] }>(
      `/api/admin/tenants/${encodeURIComponent(id)}/tokens`,
    ),

  mintToken: (id: string, label: string) =>
    api.post<{ ok: boolean; id: number; token: string; warning: string }>(
      `/api/admin/tenants/${encodeURIComponent(id)}/tokens`,
      { label },
    ),

  revokeToken: (id: string, tokenId: number) =>
    api.del<{ ok: boolean }>(`/api/admin/tenants/${encodeURIComponent(id)}/tokens/${tokenId}`),

  testQuestion: (id: string, message: string) =>
    api.post<TestQuestionResult>(`/api/admin/tenants/${encodeURIComponent(id)}/test-question`, {
      message,
    }),

  smoke: (id: string) =>
    api.get<SmokeReport>(`/api/admin/tenants/${encodeURIComponent(id)}/smoke`),
}

// ── context ────────────────────────────────────────────────────────────────

interface TenantState {
  tenants: Tenant[]
  loading: boolean
  error: string | null
  reload: () => void
  activeId: string | null
  setActive: (id: string | null) => void
  active: Tenant | null
}

const TenantContext = createContext<TenantState | null>(null)

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(getActiveTenantId())

  const reload = useCallback(() => {
    let cancelled = false
    setLoading(true)
    tenantsApi
      .list()
      .then((rows) => {
        if (cancelled) return
        setTenants(rows)
        setError(null)
        setActiveId((current) => {
          if (current && rows.some((t) => t.id === current)) return current
          const next = rows[0]?.id ?? null
          setActiveTenantId(next)
          return next
        })
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => reload(), [reload])

  const setActive = useCallback((id: string | null) => {
    setActiveId(id)
    setActiveTenantId(id)
  }, [])

  const value = useMemo<TenantState>(
    () => ({
      tenants,
      loading,
      error,
      reload,
      activeId,
      setActive,
      active: tenants.find((t) => t.id === activeId) ?? null,
    }),
    [tenants, loading, error, reload, activeId, setActive],
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenants(): TenantState {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenants must be used inside <TenantProvider>')
  return ctx
}

/**
 * The tenant's resolved feature flags, for gating the sidebar.
 *
 * Null means "not known yet" (still loading, or this admin cannot read the
 * resolved profile) — callers treat that as "do not hide anything on account of
 * a feature".
 */
export function useTenantFeatures(tenantId: string | null): Features | null {
  const [features, setFeatures] = useState<Features | null>(null)

  useEffect(() => {
    if (!tenantId) {
      setFeatures(null)
      return
    }
    const controller = new AbortController()
    setFeatures(null)
    tenantsApi
      .resolved(tenantId, controller.signal)
      .then((profile) => setFeatures(profile.features))
      .catch(() => setFeatures(null))
    return () => controller.abort()
  }, [tenantId])

  return features
}
