'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { History, RefreshCw, CheckCircle2, XCircle, Clock, Mail, AlertTriangle, Filter } from 'lucide-react';
import { formatDateTime, timeAgo, truncate } from '@/utils/helpers';

type LogStatus = 'pending' | 'sending' | 'sent' | 'failed';

interface EmailLog {
  _id: string;
  recipientEmail: string;
  status: LogStatus;
  sentAt?: string;
  attempts: number;
  errorReason?: string;
  createdAt: string;
  campaignId?: { _id: string; title: string };
  leadId?: { name: string; email: string };
}

interface Campaign {
  _id: string;
  title: string;
}

const STATUS_ICON: Record<LogStatus, React.ReactNode> = {
  sent: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  failed: <XCircle className="h-4 w-4 text-red-400" />,
  pending: <Clock className="h-4 w-4 text-yellow-400" />,
  sending: <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />,
};

const STATUS_BADGE: Record<LogStatus, string> = {
  sent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  sending: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Filters
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterStatus, setFilterStatus] = useState<LogStatus | ''>('');
  const [page, setPage] = useState(1);

  // Fetch campaigns for filter dropdown
  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns || []));
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filterCampaign) params.set('campaignId', filterCampaign);
      if (filterStatus) params.set('status', filterStatus);

      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [filterCampaign, filterStatus, page]);

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchLogs, 10_000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // Stats from current logs
  const sentCount = logs.filter((l) => l.status === 'sent').length;
  const failedCount = logs.filter((l) => l.status === 'failed').length;
  const pendingCount = logs.filter((l) => l.status === 'pending').length;

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sending Logs</h1>
          <p className="text-sm text-muted-foreground">
            Monitor delivery status, review error reasons, and track each email dispatch.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary border border-border/60 text-muted-foreground text-xs font-semibold hover:text-foreground hover:bg-secondary/80 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Mini Stats */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 rounded-xl glass-panel">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Sent</p>
              <p className="text-lg font-extrabold text-emerald-400">{sentCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl glass-panel">
            <XCircle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="text-lg font-extrabold text-red-400">{failedCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl glass-panel">
            <Clock className="h-5 w-5 text-yellow-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-extrabold text-yellow-400">{pendingCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-xl glass-panel">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span className="font-semibold">Filter:</span>
        </div>
        <select
          value={filterCampaign}
          onChange={(e) => { setFilterCampaign(e.target.value); setPage(1); }}
          className="flex-1 px-3 py-2 rounded-xl bg-secondary/40 border border-border/60 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
        >
          <option value="">All Campaigns</option>
          {campaigns.map((c) => (
            <option key={c._id} value={c._id}>{c.title}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as LogStatus | ''); setPage(1); }}
          className="px-3 py-2 rounded-xl bg-secondary/40 border border-border/60 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
        >
          <option value="">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
          <option value="sending">Sending</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl glass overflow-hidden border border-border/40">
        {/* Table Header */}
        <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 px-6 py-3 border-b border-border/40 bg-secondary/20">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Recipient</span>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Campaign</span>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Attempts</span>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Time</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-secondary/30 animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="p-4 bg-secondary/40 rounded-full border border-border/40 text-muted-foreground">
              <History className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-foreground">No Logs Yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Delivery logs will appear here once campaigns start sending.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {logs.map((log) => (
              <div
                key={log._id}
                className="grid grid-cols-1 lg:grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-3 items-start lg:items-center px-6 py-4 hover:bg-secondary/10 transition-colors"
              >
                {/* Recipient */}
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-secondary/60 border border-border/40 flex items-center justify-center shrink-0">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {log.leadId?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{log.recipientEmail}</p>
                  </div>
                </div>

                {/* Campaign */}
                <div>
                  <p className="text-sm text-foreground font-medium truncate">
                    {log.campaignId?.title || '—'}
                  </p>
                  {log.errorReason && (
                    <p className="text-[11px] text-red-400 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {truncate(log.errorReason, 60)}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  {STATUS_ICON[log.status]}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${STATUS_BADGE[log.status]}`}
                  >
                    {log.status}
                  </span>
                </div>

                {/* Attempts */}
                <div className="text-center hidden lg:block">
                  <span className={`text-sm font-bold ${log.attempts > 1 ? 'text-yellow-400' : 'text-foreground'}`}>
                    {log.attempts}
                  </span>
                  <p className="text-[10px] text-muted-foreground">attempt{log.attempts !== 1 ? 's' : ''}</p>
                </div>

                {/* Time */}
                <div className="hidden lg:block text-right">
                  <p className="text-xs text-foreground">
                    {log.sentAt ? formatDateTime(log.sentAt) : '—'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {timeAgo(log.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 50 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/40">
            <p className="text-xs text-muted-foreground">
              {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total} logs
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 disabled:opacity-40 transition-colors"
              >
                Prev
              </button>
              <span className="text-xs font-semibold text-foreground">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 50 >= total}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
