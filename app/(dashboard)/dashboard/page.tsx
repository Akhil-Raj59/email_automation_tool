'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  MailOpen,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { formatDate } from '@/utils/helpers';

interface DashboardMetrics {
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  todaySent: number;
  dailyCap: number;
}

interface CampaignRow {
  _id: string;
  title: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'paused';
  sentCount: number;
  totalCount: number;
  scheduledAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse',
  scheduled: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export default function DashboardOverview() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentCampaigns, setRecentCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      setMetrics(data.metrics);
      setRecentCampaigns(data.recentCampaigns);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const todayProgress = metrics
    ? Math.min((metrics.todaySent / metrics.dailyCap) * 100, 100)
    : 0;

  return (
    <div className="space-y-8 font-sans">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel relative overflow-hidden">
        <div className="space-y-1 z-10">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Welcome to Vanguard
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg">
            Your internal B2B email dispatch platform. Monitor queues, create campaigns, and track delivery.
          </p>
        </div>
        <div className="flex gap-3 z-10">
          <Link
            href="/campaigns"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </Link>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-primary/5 to-transparent blur-3xl pointer-events-none" />
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error} — Check MongoDB connection in .env.local
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Pending */}
        <MetricCard
          label="Pending Queue"
          value={loading ? '—' : String(metrics?.totalPending ?? 0)}
          sub="Awaiting delivery"
          icon={<Clock className="h-5 w-5" />}
          iconClass="bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
          barClass="bg-yellow-500/40"
        />
        {/* Sent */}
        <MetricCard
          label="Emails Sent"
          value={loading ? '—' : String(metrics?.totalSent ?? 0)}
          sub="All-time delivered"
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconClass="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          barClass="bg-emerald-500/40"
        />
        {/* Failed */}
        <MetricCard
          label="Failed"
          value={loading ? '—' : String(metrics?.totalFailed ?? 0)}
          sub="Bounces or errors"
          icon={<XCircle className="h-5 w-5" />}
          iconClass="bg-red-500/10 border-red-500/20 text-red-400"
          barClass="bg-red-500/40"
        />
        {/* Today's Usage */}
        <div className="p-6 rounded-2xl glass transition-all hover:border-white/15 hover:translate-y-[-2px] relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Today&apos;s Usage</span>
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <span className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
              {loading ? '—' : `${metrics?.todaySent ?? 0}/${metrics?.dailyCap ?? 50}`}
            </span>
            <p className="text-[11px] text-muted-foreground">Daily cap usage</p>
            {/* Progress bar */}
            <div className="w-full bg-border/40 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-700 ${todayProgress > 80 ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${todayProgress}%` }}
              />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500/30" />
        </div>
      </div>

      {/* Recent Campaigns Table */}
      <div className="p-6 rounded-2xl glass-panel space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-foreground">Recent Campaigns</h2>
            <p className="text-xs text-muted-foreground">Latest 5 campaigns and their delivery status</p>
          </div>
          <Link
            href="/dashboard/campaigns"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline group"
          >
            View All
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-secondary/30 animate-pulse" />
            ))}
          </div>
        ) : recentCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-border/60 text-center space-y-3">
            <div className="p-3 bg-secondary/40 rounded-full border border-border/20 text-muted-foreground">
              <MailOpen className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">No Campaigns Yet</h4>
              <p className="text-xs text-muted-foreground max-w-xs">
                Create your first campaign to start sending automated emails.
              </p>
            </div>
            <Link
              href="/dashboard/campaigns"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 border border-border transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Campaign
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/20 overflow-hidden rounded-xl border border-border/40">
            {recentCampaigns.map((camp) => (
              <div
                key={camp._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary mt-0.5">
                    <MailOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{camp.title}</h4>
                    <p className="text-xs text-muted-foreground truncate max-w-md">
                      {camp.subject} • {formatDate(camp.scheduledAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-end">
                  {/* Progress */}
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-foreground">
                      {camp.sentCount} / {camp.totalCount} sent
                    </p>
                    <div className="w-24 bg-border/40 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all"
                        style={{
                          width: `${camp.totalCount > 0 ? (camp.sentCount / camp.totalCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[camp.status] ?? STATUS_STYLES.draft}`}
                  >
                    {camp.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Reusable Metric Card ─── */
function MetricCard({
  label,
  value,
  sub,
  icon,
  iconClass,
  barClass,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  iconClass: string;
  barClass: string;
}) {
  return (
    <div className="p-6 rounded-2xl glass transition-all hover:border-white/15 hover:translate-y-[-2px] relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={`p-2 rounded-xl border group-hover:scale-110 transition-transform ${iconClass}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 space-y-1">
        <span className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
          {value}
        </span>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <div className={`absolute inset-x-0 bottom-0 h-1 ${barClass}`} />
    </div>
  );
}
