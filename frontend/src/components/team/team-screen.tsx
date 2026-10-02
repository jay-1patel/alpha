import { useState } from 'react'
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserRound, X } from 'lucide-react'
import { adminsApi, type AdminRecord } from '@/lib/admins'
import { ALL_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_LABELS, usePermissions } from '@/lib/permissions'
import { useAction, useAsync } from '@/lib/hooks'
import { formatDate, initials } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, SectionTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, EmptyState, LoadingBlock } from '@/components/ui/feedback'
import { PageHeader } from '@/components/layout/page-header'
import { useToast } from '@/components/ui/toast'

type Draft = {
  username: string
  email: string
  password: string
  role: 'super_admin' | 'sub_admin'
  permissions: Record<string, boolean>
}

const emptyDraft = (): Draft => ({
  username: '',
  email: '',
  password: '',
  role: 'sub_admin',
  permissions: Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, false])),
})

export function TeamScreen() {
  const { identity, isSuperAdmin, canManageTeam } = usePermissions()
  const admins = useAsync(() => adminsApi.list(), [])
  const action = useAction()
  const toast = useToast()

  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editing, setEditing] = useState<string | null>(null)
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({})
  const [resetting, setResetting] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  if (!canManageTeam) {
    return (
      <Alert tone="warning" title="Not permitted">
        Your account does not hold the manage_admins permission, so the team screen is not available.
      </Alert>
    )
  }

  const create = async () => {
    const result = await action.run(() =>
      adminsApi.create({
        username: draft.username.trim(),
        password: draft.password,
        role: draft.role,
        permissions: draft.role === 'super_admin' ? null : draft.permissions,
        email: draft.email.trim() || null,
      }),
    )
    if (result) {
      toast.push(`Created ${result.username}`)
      setCreating(false)
      setDraft(emptyDraft())
      admins.reload()
    }
  }

  const startEdit = (admin: AdminRecord) => {
    setEditing(admin.username)
    setEditPerms({ ...admin.permissions })
  }

  const savePerms = async (username: string) => {
    const result = await action.run(() => adminsApi.update(username, { permissions: editPerms }))
    if (result) {
      toast.push(`Permissions updated for ${username}`)
      setEditing(null)
      admins.reload()
    }
  }

  const saveRole = async (username: string, role: string) => {
    const result = await action.run(() => adminsApi.update(username, { role }))
    if (result) {
      toast.push(`${username} is now a ${role.replace('_', ' ')}`)
      admins.reload()
    }
  }

  const reset = async (username: string) => {
    const result = await action.run(() => adminsApi.resetPassword(username, newPassword))
    if (result) {
      toast.push(`Password reset for ${username}`)
      setResetting(null)
      setNewPassword('')
    }
  }

  const remove = async (username: string) => {
    const result = await action.run(() => adminsApi.remove(username))
    if (result) {
      toast.push(`Removed ${username}`)
      setDeleting(null)
      admins.reload()
    }
  }

  return (
    <div>
      <PageHeader
        title="Team & permissions"
        description="Every admin sees this console through their own permissions: a screen or an action they do not hold is never offered. The server re-checks all of it — this is the operator's view, not the enforcement point."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setCreating((v) => !v)
              setDraft(emptyDraft())
            }}
          >
            New admin
          </Button>
        }
        meta={
          <Badge tone="accent">
            {isSuperAdmin ? 'You are a super admin — full control' : 'You are a sub admin'}
          </Badge>
        }
      />

      {action.error && (
        <Alert tone="danger" title="Action failed" className="mb-4">
          {action.error}
        </Alert>
      )}

      {creating && (
        <Card className="mb-4">
          <CardHeader
            title="New admin"
            description="A sub admin gets exactly the switches you turn on here."
            icon={<UserRound className="h-4 w-4" />}
            actions={
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)} icon={<X className="h-4 w-4" />} />
            }
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Username"
                value={draft.username}
                onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                autoFocus
              />
              <Input
                label="Email (optional)"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
              <Input
                label="Password"
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                hint="At least 12 characters."
              />
            </div>
            <Select
              label="Role"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as Draft['role'] })}
              hint={isSuperAdmin ? undefined : 'Only a super admin can grant the super admin role.'}
              disabled={!isSuperAdmin}
            >
              <option value="sub_admin">Sub admin — permissions apply</option>
              <option value="super_admin">Super admin — everything</option>
            </Select>

            {draft.role === 'sub_admin' && (
              <PermissionMatrix
                value={draft.permissions}
                onChange={(permissions) => setDraft({ ...draft, permissions })}
              />
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={action.busy}
                disabled={!draft.username.trim() || draft.password.length < 12}
                onClick={create}
              >
                Create admin
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {admins.loading ? (
        <LoadingBlock label="Loading the team…" />
      ) : (admins.data ?? []).length === 0 ? (
        <Card>
          <EmptyState title="No admins" description="Create the first account to sign in." />
        </Card>
      ) : (
        <div className="space-y-3">
          {admins.data!.map((admin) => {
            const isSelf = admin.username === identity?.username
            const isEditing = editing === admin.username
            const granted = ALL_PERMISSIONS.filter((p) => admin.permissions?.[p])

            return (
              <Card key={admin.username} className="p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-50 text-sm font-semibold text-accent-700 ring-1 ring-inset ring-accent-200">
                    {initials(admin.username)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-slate-100">{admin.username}</span>
                      {admin.role === 'super_admin' ? (
                        <Badge tone="accent">
                          <ShieldCheck className="h-3 w-3" />
                          super admin
                        </Badge>
                      ) : (
                        <Badge tone="neutral">sub admin</Badge>
                      )}
                      {isSelf && <Badge tone="muted">you</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {admin.email || 'no email'} · joined {formatDate(admin.created_at)}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {admin.role === 'super_admin' ? (
                        <span className="text-xs text-slate-500">All permissions, by role.</span>
                      ) : granted.length ? (
                        granted.map((p) => (
                          <Badge key={p} tone="muted">
                            {PERMISSION_LABELS[p]}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-amber-700">No permissions — this admin cannot do anything.</span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {admin.role === 'sub_admin' && !isSelf && (
                      <Button size="sm" variant="secondary" onClick={() => startEdit(admin)} icon={<Pencil className="h-4 w-4" />}>
                        Permissions
                      </Button>
                    )}
                    {resetting === admin.username ? (
                      <>
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password"
                          className="w-48"
                        />
                        <Button size="sm" variant="primary" loading={action.busy} disabled={newPassword.length < 12} onClick={() => reset(admin.username)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setResetting(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      !isSelf && (
                        <Button size="sm" variant="ghost" onClick={() => setResetting(admin.username)} icon={<KeyRound className="h-4 w-4" />}>
                          Password
                        </Button>
                      )
                    )}
                    {admin.role === 'sub_admin' &&
                      (deleting === admin.username ? (
                        <>
                          <Button size="sm" variant="danger" loading={action.busy} onClick={() => remove(admin.username)}>
                            Confirm
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleting(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        !isSelf && (
                          <Button size="sm" variant="ghost" onClick={() => setDeleting(admin.username)} icon={<Trash2 className="h-4 w-4" />} />
                        )
                      ))}
                  </div>
                </div>

                {isSelf && (
                  <p className="mt-4 text-xs text-slate-500">
                    Your own role and permissions are locked — ask another admin with manage_admins to change them.
                  </p>
                )}

                {admin.role === 'sub_admin' && !isSelf && isSuperAdmin && !isEditing && (
                  <div className="mt-4 flex items-center gap-2 border-t border-surface-line pt-3">
                    <span className="text-xs text-slate-500">Role:</span>
                    <Select
                      value={admin.role}
                      onChange={(e) => saveRole(admin.username, e.target.value)}
                      className="w-40"
                    >
                      <option value="sub_admin">sub admin</option>
                      <option value="super_admin">super admin</option>
                    </Select>
                  </div>
                )}

                {isEditing && (
                  <div className="mt-4 border-t border-surface-line pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <SectionTitle>Permissions for {admin.username}</SectionTitle>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditPerms(Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, true])))}>
                          All on
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditPerms(Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, false])))}>
                          All off
                        </Button>
                      </div>
                    </div>
                    <PermissionMatrix value={editPerms} onChange={setEditPerms} />
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                      <Button variant="primary" loading={action.busy} onClick={() => savePerms(admin.username)}>
                        Save permissions
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PermissionMatrix({
  value,
  onChange,
}: {
  value: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
}) {
  return (
    <div className="grid gap-4 rounded-lg bg-surface-panel p-4 ring-1 ring-inset ring-surface-line sm:grid-cols-2 lg:grid-cols-3">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.label}>
          <SectionTitle>{group.label}</SectionTitle>
          <div className="space-y-2">
            {group.permissions.map((permission) => (
              <Switch
                key={permission}
                size="sm"
                checked={Boolean(value[permission])}
                onChange={(next) => onChange({ ...value, [permission]: next })}
                label={PERMISSION_LABELS[permission]}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
