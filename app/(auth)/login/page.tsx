'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SendHorizontal, Eye, EyeOff, AlertTriangle, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid credentials');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 space-y-3">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
            <SendHorizontal className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
              VANGUARD
            </h1>
            <p className="text-xs text-muted-foreground mt-1 tracking-widest uppercase font-medium">
              Email Automation Platform
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl border border-border/60 overflow-hidden shadow-2xl shadow-black/40">
          {/* Card Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border/30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/60 rounded-xl border border-border/40">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Admin Access</h2>
                <p className="text-xs text-muted-foreground">Internal use only</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Admin Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your admin password"
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-secondary/40 border border-border/60 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading || !password}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Authenticating…
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="px-6 pb-5 text-center">
            <p className="text-[11px] text-muted-foreground">
              This platform is restricted to authorized personnel only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
