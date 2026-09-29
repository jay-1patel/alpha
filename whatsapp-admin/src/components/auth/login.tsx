'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, EyeOff, Lock, User } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { api, setToken } from '@/lib/api'
import { leewayColors } from '@/styles/theme'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter both username and password')
      return
    }
    setLoading(true)
    try {
      const data = await api.post('/api/auth/login', { username: username.trim(), password })
      setToken(data.token)
      toast.success('Logged in successfully')
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 p-4 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary-300/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-secondary-200/30 blur-3xl pointer-events-none" />
      
      {/* Floating particles */}
      <div className="absolute top-32 left-1/4 h-4 w-4 rounded-full bg-primary-200/40 animate-pulse pointer-events-none" style={{ animationDelay: '0s' }} />
      <div className="absolute top-48 right-1/3 h-6 w-6 rounded-full bg-secondary-200/30 animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-40 left-1/3 h-3 w-3 rounded-full bg-primary-300/25 animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-md space-y-6 z-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <img
            src="/leeway_logo.png"
            alt="Leeway Softech"
            className="mx-auto h-24 w-24 object-contain rounded-full border-4 border-primary-500 bg-white p-2 shadow-lg shadow-primary-500/25"
          />
          <h1 className="text-3xl font-bold text-primary-500">Leeway Softech</h1>
          <p className="text-lg text-gray-600 font-medium">WhatsApp Bot Admin Panel</p>
        </div>

        {/* Login Card */}
        <Card className="relative z-20 shadow-xl border-border/60 overflow-hidden leeway-card">
          <div className="h-1 bg-gradient-to-r from-primary-500 to-primary-600" />
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-primary-500">Sign In</CardTitle>
            <CardDescription className="text-lg text-gray-600">Enter your credentials to access the panel</CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Field */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-base font-medium text-gray-700">Username</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-400 pointer-events-none" />
                  <Input
                    id="username"
                    placeholder="e.g. admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className="pl-12 h-12 text-base border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-medium text-gray-700">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-400 pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pl-12 pr-12 h-12 text-base border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className={cn(
                  'w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700',
                  'text-white shadow-lg shadow-primary-500/25 h-12 text-lg font-semibold'
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              {/* Forgot Password Link */}
              <Button
                type="button"
                variant="link"
                className="w-full text-base text-gray-600 hover:text-primary-500 font-medium"
                onClick={() => {
                  window.history.pushState(null, '', '/forgot-password')
                  window.dispatchEvent(new PopStateEvent('popstate'))
                }}
              >
                Forgot password?
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Leeway Softech. All rights reserved.
        </p>
      </div>
    </div>
  )
}
