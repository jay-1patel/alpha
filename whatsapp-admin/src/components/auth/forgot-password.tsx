'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft, MailCheck, User, Key } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      toast.error('Please enter your username')
      return
    }
    setLoading(true)
    try {
      const data = await api.post('/api/auth/request-otp', { username: username.trim() })
      setSent(true)
      toast.success(data.message || 'OTP sent to your email')
    } catch (err: any) {
      toast.error(err.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 p-4 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary-300/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-secondary-200/30 blur-3xl pointer-events-none" />

        <div className="w-full max-w-md space-y-6 z-10">
          {/* Header */}
          <div className="text-center space-y-3">
            <img
              src="/leeway_logo.png"
              alt="Leeway Softech"
              className="mx-auto h-20 w-20 object-contain rounded-full border-4 border-primary-500 bg-white p-2 shadow-lg shadow-primary-500/25"
            />
            <h1 className="text-3xl font-bold text-primary-500">Check Your Email</h1>
            <p className="text-lg text-gray-600 font-medium">Password reset code sent</p>
          </div>

          {/* Card */}
          <Card className="relative z-20 shadow-xl border-border/60 overflow-hidden leeway-card">
            <div className="h-1 bg-gradient-to-r from-primary-500 to-primary-600" />
            <CardHeader className="space-y-1 text-center pb-2">
              <div className="mx-auto h-14 w-14 rounded-full bg-secondary-50 flex items-center justify-center mb-2">
                <MailCheck className="h-7 w-7 text-secondary-500" />
              </div>
              <CardTitle className="text-2xl text-primary-500">OTP Sent</CardTitle>
              <CardDescription className="text-lg text-gray-600">
                We sent a reset code to the email linked to <strong className="text-primary-500">{username}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ResetPasswordForm username={username} />
              <Button
                variant="outline"
                className="w-full border-primary-500 text-primary-500 hover:bg-primary-50"
                onClick={() => { window.location.href = '/login' }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 p-4 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary-300/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-secondary-200/30 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 z-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <img
            src="/leeway_logo.png"
            alt="Leeway Softech"
            className="mx-auto h-20 w-20 object-contain rounded-full border-4 border-primary-500 bg-white p-2 shadow-lg shadow-primary-500/25"
          />
          <h1 className="text-3xl font-bold text-primary-500">Forgot Password?</h1>
          <p className="text-lg text-gray-600 font-medium">We will email you a reset code</p>
        </div>

        {/* Card */}
        <Card className="relative z-20 shadow-xl border-border/60 overflow-hidden leeway-card">
          <div className="h-1 bg-gradient-to-r from-primary-500 to-primary-600" />
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-primary-500">Reset Password</CardTitle>
            <CardDescription className="text-lg text-gray-600">Enter your username to receive a reset OTP via email</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-base font-medium text-gray-700">Username</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-400 pointer-events-none" />
                  <Input
                    id="username"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-12 h-12 text-base border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/25 h-12 text-lg font-semibold"
              >
                {loading && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                Send OTP
              </Button>
              
              <Button
                type="button"
                variant="outline"
                className="w-full border-primary-500 text-primary-500 hover:bg-primary-50"
                onClick={() => { window.location.href = '/login' }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ResetPasswordForm({ username }: { username: string }) {
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp.trim() || !newPassword.trim()) {
      toast.error('Please enter OTP and new password')
      return
    }
    setLoading(true)
    try {
      await api.post('/api/auth/reset-password', { username, otp: otp.trim(), new_password: newPassword })
      toast.success('Password reset successfully')
      setTimeout(() => { window.location.href = '/login' }, 1500)
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* OTP Field */}
      <div className="space-y-2">
        <Label htmlFor="otp" className="text-base font-medium text-gray-700">OTP Code</Label>
        <div className="relative">
          <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-400 pointer-events-none" />
          <Input
            id="otp"
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            className="pl-12 text-center font-mono tracking-[0.4em] h-12 text-xl border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
      </div>
      
      {/* New Password Field */}
      <div className="space-y-2">
        <Label htmlFor="newPassword" className="text-base font-medium text-gray-700">New Password</Label>
        <Input
          id="newPassword"
          type="password"
          placeholder="••••••••"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          className="h-12 text-base border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
        />
      </div>
      
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/25 h-12 text-lg font-semibold"
      >
        {loading && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
        Reset Password
      </Button>
    </form>
  )
}
