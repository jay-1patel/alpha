'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyRound, Loader2, Eye, EyeOff, Lock, ShieldCheck, CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 text-sm transition-colors', met ? 'text-secondary-500' : 'text-gray-500')}>
      {met ? <CheckCircle2 className="h-4 w-4 text-secondary-500" /> : <Circle className="h-3.5 w-3.5 text-gray-300" />}
      {label}
    </div>
  )
}

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const rules = useMemo(() => ({
    length: newPassword.length >= 6,
    number: /\d/.test(newPassword),
    letter: /[a-zA-Z]/.test(newPassword),
  }), [newPassword])

  const strength = Object.values(rules).filter(Boolean).length
  const strengthLabel = ['Too weak', 'Weak', 'Good', 'Strong'][strength]
  const strengthColor = [
    'bg-red-400',
    'bg-orange-400',
    'bg-yellow-400',
    'bg-secondary-500',
  ][strength]

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword.trim() || !newPassword.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      await api.post('/api/auth/change-password', { current_password: currentPassword, new_password: newPassword })
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-start justify-center py-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <img
            src="/leeway_logo.png"
            alt="Leeway Softech"
            className="mx-auto h-20 w-20 object-contain rounded-full border-4 border-primary-500 bg-white p-2 shadow-lg shadow-primary-500/25"
          />
          <h1 className="text-2xl font-bold text-primary-500">Change Password</h1>
          <p className="text-base text-gray-600 font-medium">
            Choose a strong password you don't use anywhere else
          </p>
        </div>

        <Card className="shadow-lg border-border/60 overflow-hidden leeway-card">
          <div className="h-1 bg-gradient-to-r from-primary-500 to-primary-600" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl text-primary-500">
              <ShieldCheck className="h-5 w-5 text-secondary-500" />
              Security
            </CardTitle>
            <CardDescription className="text-base text-gray-600">Your password is encrypted and never stored in plain text</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700">
                  Current Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-400 pointer-events-none" />
                  <Input
                    id="currentPassword"
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pl-12 pr-12 h-11 text-base border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500 transition-colors"
                    tabIndex={-1}
                    aria-label={showCurrent ? 'Hide password' : 'Show password'}
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-400 pointer-events-none" />
                  <Input
                    id="newPassword"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pl-12 pr-12 h-11 text-base border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500 transition-colors"
                    tabIndex={-1}
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {newPassword.length > 0 && (
                  <div className="pt-1 space-y-2">
                    {/* Strength Meter */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-300', strengthColor)}
                          style={{ width: `${(strength / 3) * 100}%` }}
                        />
                      </div>
                      <span className={cn(
                        'text-sm font-medium w-16',
                        strength === 3 ? 'text-secondary-500' : 
                        strength === 2 ? 'text-yellow-500' : 
                        strength === 1 ? 'text-orange-500' : 'text-red-500'
                      )}>
                        {strengthLabel}
                      </span>
                    </div>
                    
                    {/* Password Rules */}
                    <div className="grid grid-cols-1 gap-1 pt-0.5">
                      <PasswordRule met={rules.length} label="At least 6 characters" />
                      <PasswordRule met={rules.letter} label="Contains a letter" />
                      <PasswordRule met={rules.number} label="Contains a number" />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-400 pointer-events-none" />
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className={cn(
                      'pl-12 pr-12 h-11 text-base border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
                      confirmPassword.length > 0 && (passwordsMatch
                        ? 'border-secondary-400 ring-2 ring-secondary-500/20'
                        : 'border-red-400 ring-2 ring-red-500/20')
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500 transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" /> Passwords do not match
                  </p>
                )}
                {passwordsMatch && confirmPassword.length > 0 && (
                  <p className="text-sm text-secondary-500 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Passwords match
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/25 h-12 text-lg font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-5 w-5 mr-2" />
                    Update Password
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
