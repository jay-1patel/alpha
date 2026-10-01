'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft, MailCheck, User } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useBranding } from '@/lib/hooks/useBranding'

const CHIKKI_STYLES = `
  /* ---------- Staggered entrance ---------- */
  @keyframes chikki-in-left {
    0%   { opacity: 0; transform: translateX(-52px) translateY(24px) scale(0.8) rotate(-10deg); }
    100% { opacity: 1; transform: translateX(0) translateY(0) scale(1) rotate(0deg); }
  }
  @keyframes chikki-in-right {
    0%   { opacity: 0; transform: translateX(52px) translateY(24px) scale(0.8) rotate(10deg); }
    100% { opacity: 1; transform: translateX(0) translateY(0) scale(1) rotate(0deg); }
  }
  @keyframes chikki-in-crumb {
    0%   { opacity: 0; transform: translateY(-30px) scale(0.4); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ---------- Organic float + sway ---------- */
  @keyframes bob-left {
    0%   { transform: translateY(0) rotate(-3deg); }
    30%  { transform: translateY(-16px) rotate(2deg); }
    55%  { transform: translateY(5px) rotate(-2deg); }
    80%  { transform: translateY(-10px) rotate(3deg); }
    100% { transform: translateY(0) rotate(-3deg); }
  }
  @keyframes bob-right {
    0%   { transform: translateY(0) rotate(3deg); }
    30%  { transform: translateY(-16px) rotate(-2deg); }
    55%  { transform: translateY(5px) rotate(2deg); }
    80%  { transform: translateY(-10px) rotate(-3deg); }
    100% { transform: translateY(0) rotate(3deg); }
  }
  @keyframes bob-crumb {
    0%, 100% { transform: translateY(0) rotate(-6deg); }
    50%      { transform: translateY(-22px) rotate(8deg); }
  }

  /* ---------- Glow + sparkles ---------- */
  @keyframes glow-pulse {
    0%, 100% { opacity: 0.55; transform: scale(1); }
    50%      { opacity: 0.9;  transform: scale(1.15); }
  }
  @keyframes sparkle-rise {
    0%   { transform: translateY(0) scale(0.3); opacity: 0; }
    25%  { opacity: 1; }
    100% { transform: translateY(-60px) scale(1); opacity: 0; }
  }

  .chikki { will-change: transform, opacity; }
  .in-left  { animation: chikki-in-left  0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both; }
  .in-right { animation: chikki-in-right 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.35s both; }
  .in-crumb { animation: chikki-in-crumb 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.55s both; }
  .bob-left  { animation: bob-left  5.5s ease-in-out 1s infinite; }
  .bob-right { animation: bob-right 6s   ease-in-out 1.2s infinite; }
  .bob-crumb { animation: bob-crumb 4.5s ease-in-out 1.5s infinite; }

  .chikki-glow {
    position: absolute; border-radius: 9999px; filter: blur(30px);
    animation: glow-pulse 5s ease-in-out infinite;
  }
  .sparkle {
    position: absolute; border-radius: 9999px; background: #ffffff;
    box-shadow: 0 0 12px 2px rgba(255, 255, 255, 0.9);
    animation: sparkle-rise 3.4s ease-in-out infinite;
  }

  /* ---------- 3D tilt + hover ---------- */
  .chikki-img {
    will-change: transform, filter;
    transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), filter 0.5s ease;
  }
  .left-inner  { transform: perspective(700px) rotateY(15deg) rotate(5deg);  filter: drop-shadow(0 22px 26px rgba(15, 23, 42, 0.30)); }
  .right-inner { transform: perspective(700px) rotateY(-15deg) rotate(-5deg); filter: drop-shadow(0 22px 26px rgba(15, 23, 42, 0.32)); }
  .group:hover .left-inner  { transform: perspective(700px) rotateY(4deg) rotate(-2deg) scale(1.08);  filter: drop-shadow(0 32px 36px rgba(15, 23, 42, 0.45)); }
  .group:hover .right-inner { transform: perspective(700px) rotateY(-4deg) rotate(2deg) scale(1.08);  filter: drop-shadow(0 32px 36px rgba(15, 23, 42, 0.45)); }
`

export default function ForgotPasswordPage() {
  const { data: branding } = useBranding()
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-background to-blue-100 dark:from-background dark:via-background dark:to-blue-950/30 p-4 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl pointer-events-none" />

        <style>{CHIKKI_STYLES}</style>

        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-3">
            {branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt={branding.company_name}
                className="mx-auto h-30 w-60 object-contain drop-shadow-lg"
              />
            ) : null}
            <h1 className="text-3xl font-semibold tracking-tight">Check your email</h1>
          </div>

          <div className="group relative">
            {/* Half Chikki — peeking from behind the BOTTOM-LEFT */}
            <div className="chikki absolute inset-0 z-0 hidden md:flex items-end justify-start pointer-events-none">
              <div className="in-left">
                <div className="bob-left">
                  <div className="relative -ml-40 -mb-10">
                    <div
                      className="chikki-glow -inset-6"
                      style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.5), rgba(245, 158, 11, 0))' }}
                    />
                    <img
                      src="/chikki-crumb.png"
                      alt="Half Chikki"
                      className="chikki-img left-inner relative h-38 w-auto object-contain"
                    />
                    <span className="sparkle" style={{ width: 7, height: 7, left: '14%', top: '8%', animationDelay: '0s' }} />
                    <span className="sparkle" style={{ width: 5, height: 5, left: '70%', top: '4%', animationDelay: '1.3s' }} />
                  </div>
                </div>
              </div>
            </div>
            {/* Full Chikki — standing on the RIGHT side, in front */}
            <div className="chikki absolute inset-0 z-30 hidden md:flex items-center justify-end pointer-events-none">
              <div className="in-right">
                <div className="bob-right">
                  <div className="relative mr-[-170px] -mt-10">
                    <div
                      className="chikki-glow -inset-8"
                      style={{ background: 'radial-gradient(circle, rgba(56, 189, 248, 0.5), rgba(56, 189, 248, 0))' }}
                    />
                    <img
                      src="/chikki-full.png"
                      alt="Chikki"
                      className="chikki-img right-inner relative h-80 w-auto object-contain"
                    />
                    <span className="sparkle" style={{ width: 8, height: 8, left: '70%', top: '22%', animationDelay: '0.6s' }} />
                    <span className="sparkle" style={{ width: 6, height: 6, left: '94%', top: '10%', animationDelay: '1.8s' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Crumb — floating accent near the top-left */}
            <div className="chikki absolute inset-0 z-30 hidden md:flex items-start justify-start pointer-events-none">
              <div className="in-crumb">
                <div className="bob-crumb">
                  <div className="relative -ml-24 mt-8">
                    <img
                      src="/chikki-crumb.png"
                      alt=""
                      className="chikki-img relative h-24 w-auto object-contain drop-shadow-[0_10px_14px_rgba(15,23,42,0.28)]"
                    />
                    <span
                      className="sparkle"
                      style={{ width: 5, height: 5, left: '90%', top: '30%', animationDelay: '0.3s' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Card className="relative z-20 shadow-xl border-border/60 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />
              <CardHeader className="space-y-1 text-center pb-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mb-1">
                  <MailCheck className="h-6 w-6 text-emerald-500" />
                </div>
                <CardTitle className="text-2xl">OTP Sent</CardTitle>
                <CardDescription className="text-lg">
                  We sent a reset code to the email linked to <strong>{username}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ResetPasswordForm username={username} />
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => { window.location.href = '/login' }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to login
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-background to-blue-100 dark:from-background dark:via-background dark:to-blue-950/30 p-4 overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl pointer-events-none" />

      <style>{CHIKKI_STYLES}</style>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          {branding?.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.company_name}
              className="mx-auto h-30 w-60 object-contain drop-shadow-lg"
            />
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight">Forgot Password?</h1>
          <p className="text-lg text-muted-foreground">We will email you a reset code</p>
        </div>

        <div className="group relative">
          {/* Half Chikki — peeking from behind the BOTTOM-LEFT */}
          <div className="chikki absolute inset-0 z-0 hidden md:flex items-end justify-start pointer-events-none">
            <div className="in-left">
              <div className="bob-left">
                <div className="relative -ml-40 -mb-10">
                  <div
                    className="chikki-glow -inset-6"
                    style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.5), rgba(245, 158, 11, 0))' }}
                  />
                  <img
                    src="/chikki-crumb.png"
                    alt="Half Chikki"
                    className="chikki-img left-inner relative h-38 w-auto object-contain"
                  />
                  <span className="sparkle" style={{ width: 7, height: 7, left: '14%', top: '8%', animationDelay: '0s' }} />
                  <span className="sparkle" style={{ width: 5, height: 5, left: '70%', top: '4%', animationDelay: '1.3s' }} />
                </div>
              </div>
            </div>
          </div>
          {/* Full Chikki — standing on the RIGHT side, in front */}
          <div className="chikki absolute inset-0 z-30 hidden md:flex items-center justify-end pointer-events-none">
            <div className="in-right">
              <div className="bob-right">
                <div className="relative mr-[-170px] -mt-10">
                  <div
                    className="chikki-glow -inset-8"
                    style={{ background: 'radial-gradient(circle, rgba(56, 189, 248, 0.5), rgba(56, 189, 248, 0))' }}
                  />
                  <img
                    src="/chikki-full.png"
                    alt="Chikki"
                    className="chikki-img right-inner relative h-80 w-auto object-contain"
                  />
                  <span className="sparkle" style={{ width: 8, height: 8, left: '70%', top: '22%', animationDelay: '0.6s' }} />
                  <span className="sparkle" style={{ width: 6, height: 6, left: '94%', top: '10%', animationDelay: '1.8s' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Crumb — floating accent near the top-left */}
          <div className="chikki absolute inset-0 z-30 hidden md:flex items-start justify-start pointer-events-none">
            <div className="in-crumb">
              <div className="bob-crumb">
                <div className="relative -ml-24 mt-8">
                  <img
                    src="/chikki-crumb.png"
                    alt=""
                    className="chikki-img relative h-24 w-auto object-contain drop-shadow-[0_10px_14px_rgba(15,23,42,0.28)]"
                  />
                  <span
                    className="sparkle"
                    style={{ width: 5, height: 5, left: '90%', top: '30%', animationDelay: '0.3s' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <Card className="relative z-20 shadow-xl border-border/60 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">Reset Password</CardTitle>
              <CardDescription className="text-lg">Enter your username to receive a reset OTP via email</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-base uppercase tracking-wide text-muted-foreground">Username</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground pointer-events-none" />
                    <Input
                      id="username"
                      placeholder="admin"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-12 h-14 text-lg"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white shadow-md shadow-blue-500/20 h-14 text-xl"
                >
                  {loading && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                  Send OTP
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
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
      <div className="space-y-2">
        <Label htmlFor="otp" className="text-base uppercase tracking-wide text-muted-foreground">OTP Code</Label>
        <Input
          id="otp"
          placeholder="123456"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          maxLength={6}
          className="text-center font-mono tracking-[0.4em] h-14 text-xl"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword" className="text-base uppercase tracking-wide text-muted-foreground">New Password</Label>
        <Input
          id="newPassword"
          type="password"
          placeholder="••••••••"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          className="h-14 text-xl"
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white shadow-md shadow-blue-500/20 h-14 text-xl"
      >
        {loading && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
        Reset Password
      </Button>
    </form>
  )
}
