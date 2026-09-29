'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Users, Plus, Pencil, Trash2, Loader2, ShieldCheck, Shield, Mail,
  Search, KeyRound, Check, X, UserPlus, Crown, User, Lock, Eye, EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getCurrentUsername } from '@/lib/api'
import {
  useAdmins,
  useCreateAdmin,
  useUpdateAdmin,
  useDeleteAdmin,
  useResetAdminPassword,
} from '@/lib/hooks/useAdmins'

interface Admin {
  username: string
  email?: string | null
  role: string
  permissions?: Record<string, boolean>
  created_at?: string
}

const ALL_PERMISSIONS: { key: string; label: string }[] = [
  { key: 'manage_admins', label: 'Manage Admins' },
  { key: 'upload_faq', label: 'Upload FAQ' },
  { key: 'upload_kb', label: 'Upload KB' },
  { key: 'view_files', label: 'View Files' },
  { key: 'delete_files', label: 'Delete Files' },
  { key: 'view_products', label: 'View Products' },
  { key: 'edit_delete_products', label: 'Edit/Delete Products' },
  { key: 'chat', label: 'Chat' },
  { key: 'chat_history', label: 'Chat History' },
  { key: 'catalogue_new_arrival', label: 'Catalogue New Arrival' },
  { key: 'view_orders', label: 'View Orders' },
  { key: 'manage_orders', label: 'Manage Orders' },
  { key: 'view_complaints', label: 'View Complaints' },
  { key: 'manage_complaints', label: 'Manage Complaints' },
  { key: 'view_customers', label: 'View Customers' },
  { key: 'view_analytics', label: 'View Analytics' },
  { key: 'view_inbox', label: 'Live Inbox' },
  { key: 'view_campaigns', label: 'Campaigns' },
  { key: 'view_distributors', label: 'Distributors' },
]

const emptyAdmin = { username: '', password: '', role: 'sub_admin', email: '', permissions: {} as Record<string, boolean> }

const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-sky-600',
]

function avatarGradient(username: string) {
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) >>> 0
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}

export default function ManageAdminsPage() {
  const { data: admins = [], isLoading } = useAdmins()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyAdmin)
  const [search, setSearch] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const createAdmin = useCreateAdmin()
  const updateAdmin = useUpdateAdmin()
  const deleteAdmin = useDeleteAdmin()
  const resetAdminPassword = useResetAdminPassword()

  const [resetPw, setResetPw] = useState('')

  const saving = createAdmin.isPending || updateAdmin.isPending

  const filteredAdmins = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return admins
    return admins.filter(a =>
      a.username.toLowerCase().includes(s) ||
      (a.email || '').toLowerCase().includes(s) ||
      a.role.toLowerCase().includes(s)
    )
  }, [admins, search])

  const superCount = admins.filter(a => a.role === 'super_admin').length
  const subCount = admins.length - superCount

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.username.trim() || !formData.password.trim()) {
      toast.error('Username and password are required')
      return
    }
    const permissions: Record<string, boolean> = {}
    ALL_PERMISSIONS.forEach(p => {
      permissions[p.key] = !!formData.permissions[p.key]
    })
    createAdmin.mutate(
      {
        username: formData.username.trim(),
        password: formData.password,
        role: formData.role,
        permissions,
        email: formData.email.trim() || undefined,
      },
      {
        onSuccess: () => {
          setDialogOpen(false)
          setFormData(emptyAdmin)
        },
      }
    )
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAdmin) return
    const permissions: Record<string, boolean> = {}
    ALL_PERMISSIONS.forEach(p => {
      permissions[p.key] = !!formData.permissions[p.key]
    })
    updateAdmin.mutate(
      {
        username: editingAdmin,
        data: {
          role: formData.role,
          permissions,
          email: formData.email.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setDialogOpen(false)
          setEditingAdmin(null)
          setFormData(emptyAdmin)
        },
      }
    )
  }

  const handleDelete = async (username: string) => {
    deleteAdmin.mutate(username)
  }

  const openCreateDialog = () => {
    setEditingAdmin(null)
    setShowPassword(false)
    setFormData({ ...emptyAdmin, permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.key]: false }), {}) })
    setDialogOpen(true)
  }

  const openEditDialog = (admin: Admin) => {
    setEditingAdmin(admin.username)
    setFormData({
      username: admin.username,
      password: '',
      role: admin.role,
      email: admin.email || '',
      permissions: admin.permissions || {},
    })
    setDialogOpen(true)
  }

  const togglePermission = (key: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key],
      },
    }))
  }

  const enabledPermissionCount = (admin: Admin) =>
    ALL_PERMISSIONS.filter(p => admin.permissions?.[p.key]).length

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Users className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Manage Admins</h1>
            <p className="text-base text-muted-foreground">Create accounts and control what each admin can access</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingAdmin(null) }}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white shadow-md shadow-blue-500/20">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  {editingAdmin ? <Pencil className="h-4 w-4 text-white" /> : <UserPlus className="h-4 w-4 text-white" />}
                </div>
                {editingAdmin ? `Edit ${editingAdmin}` : 'Create New Admin'}
              </DialogTitle>
              <DialogDescription>
                {editingAdmin ? 'Update role, permissions and email' : 'Set up an account and pick what it can access'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={editingAdmin ? handleUpdate : handleCreate} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="flex items-center gap-1.5 text-sm uppercase tracking-wide text-muted-foreground">
                    <User className="h-3 w-3" /> Username
                  </Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    disabled={!!editingAdmin}
                    placeholder="e.g. admin1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="flex items-center gap-1.5 text-sm uppercase tracking-wide text-muted-foreground">
                    <Shield className="h-3 w-3" /> Role
                  </Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sub_admin">
                        <span className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> Sub Admin</span>
                      </SelectItem>
                      <SelectItem value="super_admin">
                        <span className="flex items-center gap-2"><Crown className="h-3.5 w-3.5 text-amber-500" /> Super Admin</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!editingAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-1.5 text-sm uppercase tracking-wide text-muted-foreground">
                    <Lock className="h-3 w-3" /> Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Minimum 6 characters"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1.5 text-sm uppercase tracking-wide text-muted-foreground">
                  <Mail className="h-3 w-3" /> Email <span className="normal-case text-muted-foreground/60">(for password reset OTP)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="admin@example.com"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 text-sm uppercase tracking-wide text-muted-foreground">
                    <KeyRound className="h-3 w-3" /> Permissions
                  </Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-sm"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.key]: true }), {}),
                      }))}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-sm"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.key]: false }), {}),
                      }))}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                {formData.role === 'super_admin' && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Crown className="h-3.5 w-3.5" /> Super admins automatically get every permission.
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map(perm => {
                    const active = !!formData.permissions[perm.key]
                    return (
                      <button
                        key={perm.key}
                        type="button"
                        onClick={() => togglePermission(perm.key)}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-base transition-all duration-150',
                          active
                            ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-foreground shadow-sm'
                            : 'border-border bg-card text-muted-foreground hover:border-blue-200 hover:bg-accent/50'
                        )}
                      >
                        <span>{perm.label}</span>
                        <span className={cn(
                          'h-[18px] w-[18px] shrink-0 rounded-full border flex items-center justify-center transition-colors',
                          active ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-input'
                        )}>
                          {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {editingAdmin && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                    <KeyRound className="h-4 w-4" />
                    Reset Password
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Set a new password for this admin.
                  </p>
                  <div className="flex items-end gap-2">
                    <Input
                      type="password"
                      placeholder="New password (min 6 chars)"
                      value={resetPw}
                      onChange={(e) => setResetPw(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      disabled={resetAdminPassword.isPending || resetPw.length < 6}
                      onClick={() => {
                        if (!editingAdmin || resetPw.length < 6) return
                        resetAdminPassword.mutate(
                          { username: editingAdmin, newPassword: resetPw },
                          { onSuccess: () => setResetPw('') }
                        )
                      }}
                    >
                      {resetAdminPassword.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      Reset
                    </Button>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingAdmin ? 'Save Changes' : 'Create Admin'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-gradient-to-br from-blue-500 to-indigo-600 text-white overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-white/80">Total Admins</p>
              <p className="text-3xl font-bold mt-1">{admins.length}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-amber-400 to-orange-500 text-white overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-white/80">Super Admins</p>
              <p className="text-3xl font-bold mt-1">{superCount}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center">
              <Crown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-sky-500 to-blue-600 text-white overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-white/80">Sub Admins</p>
              <p className="text-3xl font-bold mt-1">{subCount}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin List */}
      <Card className="overflow-hidden rounded-2xl border shadow-sm">
        <CardContent className="p-0">

          {/* Search Bar */}
          <div className="border-b bg-muted/10 p-4 sm:p-5">
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email or role..."
                className="
            h-11
            rounded-xl
            bg-background
            pl-10
            text-base
            shadow-sm
            placeholder:text-sm
            focus-visible:ring-2
          "
              />
            </div>
          </div>

          {/* Loading */}
          {isLoading ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>

              <p className="text-sm text-muted-foreground">
                Loading administrators...
              </p>
            </div>
          ) : filteredAdmins.length === 0 ? (

            /* Empty State */
            <div className="flex min-h-[320px] flex-col items-center justify-center px-4 py-16 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10">
                <Users className="h-7 w-7 text-primary" />
              </div>

              <h3 className="text-lg font-semibold">
                {search ? "No matching admins" : "No admins found"}
              </h3>

              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {search
                  ? "Try changing your search query to find an administrator."
                  : "Administrators will appear here once they are added."}
              </p>
            </div>

          ) : (

            <div className="overflow-auto">
            <Table>
  {/* Header */}
  <TableHeader className="bg-muted/60">
    <TableRow className="hover:bg-transparent">
      <TableHead className="h-14 min-w-[260px]">
        <div className="flex items-center gap-2 text-base font-semibold uppercase tracking-wider text-muted-foreground">
          <User className="h-5 w-5" />
          Admin
        </div>
      </TableHead>

      <TableHead className="h-14 min-w-[160px]">
        <div className="flex items-center gap-2 text-base font-semibold uppercase tracking-wider text-muted-foreground">
          <Crown className="h-5 w-5" />
          Role
        </div>
      </TableHead>

      <TableHead className="h-14 min-w-[320px]">
        <div className="flex items-center gap-2 text-base font-semibold uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-5 w-5" />
          Permissions
        </div>
      </TableHead>

      <TableHead className="h-14 min-w-[110px] text-right">
        <span className="text-base font-semibold uppercase tracking-wider text-muted-foreground">
          Actions
        </span>
      </TableHead>
    </TableRow>
  </TableHeader>

  <TableBody>
    {filteredAdmins.map((admin) => {
      const perms = ALL_PERMISSIONS.filter(
        (p) => admin.permissions?.[p.key]
      );

      const isSuper = admin.role === "super_admin";
      const isSelf = admin.username === getCurrentUsername();

      return (
        <TableRow
          key={admin.username}
          className="group border-border/50 transition-colors hover:bg-muted/30"
        >
          {/* ADMIN */}
          <TableCell className="py-4">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div
                  className={cn(
                    `
                      flex h-11 w-11
                      items-center justify-center
                      rounded-xl
                      bg-gradient-to-br
                      text-base
                      font-bold
                      text-white
                      shadow-sm
                    `,
                    avatarGradient(admin.username)
                  )}
                >
                  {admin.username.charAt(0).toUpperCase()}
                </div>

                <span
                  className="
                    absolute -bottom-0.5 -right-0.5
                    h-3 w-3
                    rounded-full
                    border-2 border-background
                    bg-emerald-500
                  "
                />
              </div>

              <div className="min-w-0">
                {/* Username */}
                <div className="flex items-center gap-2">
                  <p
                    className="max-w-[180px] truncate text-base font-semibold text-foreground"
                    title={admin.username}
                  >
                    {admin.username}
                  </p>

                  {isSelf && (
                    <Badge
                      variant="outline"
                      className="
                        border-blue-500/20
                        bg-blue-500/10
                        px-2 py-0.5
                        text-base
                        font-medium
                        text-blue-600
                        dark:text-blue-400
                      "
                    >
                      You
                    </Badge>
                  )}
                </div>

                {/* Email */}
                <div className="mt-1 flex items-center gap-1.5 text-base text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />

                  <span
                    className="max-w-[240px] truncate"
                    title={admin.email ?? undefined}
                  >
                    {admin.email || "No email linked"}
                  </span>
                </div>
              </div>
            </div>
          </TableCell>

          {/* ROLE */}
          <TableCell className="py-4">
            {isSuper ? (
              <Badge
                className="
                  gap-1.5
                  border-0
                  bg-gradient-to-r
                  from-amber-400 to-orange-500
                  px-3 py-1.5
                  text-base
                  font-semibold
                  text-white
                  shadow-sm
                  hover:from-amber-400
                  hover:to-orange-500
                "
              >
                <Crown className="h-4 w-4" />
                Super Admin
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="gap-1.5 px-3 py-1.5 text-base font-medium"
              >
                <User className="h-4 w-4" />
                Sub Admin
              </Badge>
            )}
          </TableCell>

          {/* PERMISSIONS */}
          <TableCell className="py-4">
            {isSuper ? (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                </div>

                <span className="text-base font-medium text-emerald-600 dark:text-emerald-400">
                  All permissions
                </span>
              </div>
            ) : perms.length === 0 ? (
              <span className="text-base italic text-muted-foreground">
                None assigned
              </span>
            ) : (
              <div className="flex max-w-[450px] flex-wrap items-center gap-1.5">
                {perms.slice(0, 3).map((p) => (
                  <Badge
                    key={p.key}
                    variant="outline"
                    className="bg-background px-2.5 py-1 text-base font-medium"
                  >
                    {p.label}
                  </Badge>
                ))}

                {perms.length > 3 && (
                  <Badge
                    variant="outline"
                    className="
                      bg-primary/5
                      px-2.5 py-1
                      text-base
                      font-semibold
                      text-primary
                    "
                  >
                    +{perms.length - 3} more
                  </Badge>
                )}
              </div>
            )}
          </TableCell>

          {/* ACTIONS */}
          <TableCell className="py-4 text-right">
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="
                  h-10 w-10
                  rounded-lg
                  text-muted-foreground
                  transition-colors
                  hover:bg-primary/10
                  hover:text-primary
                "
                disabled={isSelf}
                title={
                  isSelf
                    ? "You cannot edit your own account"
                    : "Edit admin"
                }
                onClick={() => openEditDialog(admin)}
              >
                <Pencil className="h-5 w-5" />
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="
                      h-10 w-10
                      rounded-lg
                      text-destructive
                      transition-colors
                      hover:bg-destructive/10
                      hover:text-destructive
                    "
                    disabled={isSuper || isSelf}
                    title={
                      isSelf
                        ? "You cannot delete your own account"
                        : isSuper
                          ? "Super admins cannot be deleted"
                          : "Delete admin"
                    }
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent className="sm:max-w-md">
                  <AlertDialogHeader>
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
                      <Trash2 className="h-6 w-6 text-destructive" />
                    </div>

                    <AlertDialogTitle className="text-xl">
                      Delete Admin?
                    </AlertDialogTitle>

                    <AlertDialogDescription className="text-base leading-relaxed">
                      Are you sure you want to delete{" "}
                      <span className="font-semibold text-foreground">
                        {admin.username}
                      </span>
                      ? This administrator will immediately lose access.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <AlertDialogFooter>
                    <AlertDialogCancel className="text-base">
                      Cancel
                    </AlertDialogCancel>

                    <AlertDialogAction
                      onClick={() => handleDelete(admin.username)}
                      className="
                        bg-destructive
                        text-base
                        text-destructive-foreground
                        hover:bg-destructive/90
                      "
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Admin
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TableCell>
        </TableRow>
      );
    })}
  </TableBody>
</Table>
            </div>
          )}

          {/* Footer */}
          {!isLoading && filteredAdmins.length > 0 && (
            <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />

                <span>
                  <span className="font-semibold text-foreground">
                    {filteredAdmins.length}
                  </span>{" "}
                  {filteredAdmins.length === 1
                    ? "administrator"
                    : "administrators"}
                </span>
              </div>

              {search && (
                <span className="text-xs text-muted-foreground">
                  Filtered results
                </span>
              )}
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
