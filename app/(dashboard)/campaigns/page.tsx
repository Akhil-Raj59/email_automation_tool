'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Plus, Pencil, Trash2, RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { formatDateTime, truncate } from '@/utils/helpers';

type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'paused';

interface Campaign {
  _id: string;
  title: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  provider: string;
  scheduledAt: string;
  sentCount: number;
  failedCount: number;
  totalCount: number;
  createdAt: string;
}

const STATUS_STYLES: Record<CampaignStatus, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  sending: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  scheduled: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

/* ─── Create Campaign Modal ─── */
function CreateCampaignModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: '',
    subject: '',
    body: '',
    scheduledAt: '',
    provider: 'gmail',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors(data.errors || [data.error || 'Failed to create campaign']);
        return;
      }

      onCreated();
      onClose();
    } catch {
      setErrors(['Network error. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl glass rounded-2xl border border-border/60 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/40">
          <div>
            <h2 className="text-lg font-bold text-foreground">Create New Campaign</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use {'{{name}}'}, {'{{email}}'}, or any CSV column name as template variables.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Errors */}
          {errors.length > 0 && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {e}
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Campaign Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Q2 Outreach Wave"
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/40 border border-border/60 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
                required
              />
            </div>

            {/* Subject */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Email Subject
              </label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g. {{name}}, we have something for you"
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/40 border border-border/60 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
                required
              />
            </div>

            {/* Schedule Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Schedule Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/40 border border-border/60 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
                required
              />
            </div>

            {/* Provider */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Email Provider
              </label>
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/40 border border-border/60 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
              >
                <option value="gmail">Google Workspace (SMTP)</option>
                <option value="resend">Resend (future)</option>
                <option value="ses">Amazon SES (future)</option>
              </select>
            </div>
          </div>

          {/* Body / Template Editor */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Email Body (HTML Supported)
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={10}
              placeholder={`<p>Hi {{name}},</p>\n<p>We wanted to reach out about...</p>`}
              className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-border/60 text-foreground text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all resize-y min-h-[160px]"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Use <code className="text-primary bg-primary/10 px-1 rounded">{'{{name}}'}</code>,{' '}
              <code className="text-primary bg-primary/10 px-1 rounded">{'{{email}}'}</code>, or any CSV column header as variables.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Campaigns Page ─── */
export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (err) {
      console.error('Failed to fetch campaigns', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      await fetch(`/api/campaigns/${id}/retry`, { method: 'POST' });
      await fetchCampaigns();
    } finally {
      setRetrying(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign and all related leads & logs?')) return;
    setDeleting(id);
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      setCampaigns((prev) => prev.filter((c) => c._id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const handleSchedule = async (id: string) => {
    await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'scheduled' }),
    });
    await fetchCampaigns();
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Create campaigns, write templates, schedule sends, and retry failures.
          </p>
        </div>
        <button
          id="create-campaign-btn"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Create Campaign
        </button>
      </div>

      {/* Campaigns Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-4 rounded-2xl glass text-center space-y-4">
          <div className="p-4 bg-primary/10 rounded-full border border-primary/20 text-primary">
            <Mail className="h-8 w-8" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h3 className="text-lg font-bold text-foreground">No Campaigns Yet</h3>
            <p className="text-sm text-muted-foreground">
              Create your first campaign. Upload leads after creation and schedule when ready.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all"
          >
            <Plus className="h-4 w-4" />
            Create First Campaign
          </button>
        </div>
      ) : (
        <div className="rounded-2xl glass overflow-hidden border border-border/40">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-border/40 bg-secondary/20">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Campaign</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Subject</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Progress</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Actions</span>
          </div>

          <div className="divide-y divide-border/20">
            {campaigns.map((camp) => (
              <div
                key={camp._id}
                className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 items-center px-6 py-4 hover:bg-secondary/10 transition-colors"
              >
                {/* Campaign Info */}
                <div>
                  <p className="text-sm font-bold text-foreground">{camp.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {formatDateTime(camp.scheduledAt)}
                  </p>
                </div>

                {/* Subject */}
                <p className="text-sm text-muted-foreground hidden md:block">
                  {truncate(camp.subject, 50)}
                </p>

                {/* Progress */}
                <div className="hidden md:block">
                  <p className="text-xs font-semibold text-foreground">
                    {camp.sentCount}/{camp.totalCount}
                    {camp.failedCount > 0 && (
                      <span className="text-red-400 ml-1">({camp.failedCount} failed)</span>
                    )}
                  </p>
                  <div className="w-full bg-border/40 h-1.5 rounded-full mt-1 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{
                        width: `${camp.totalCount > 0 ? (camp.sentCount / camp.totalCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Status Badge */}
                <div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[camp.status]}`}
                  >
                    {camp.status === 'sending' && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse mr-1.5" />}
                    {camp.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {camp.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                    {camp.status}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Schedule button for drafts */}
                  {camp.status === 'draft' && (
                    <button
                      onClick={() => handleSchedule(camp._id)}
                      title="Schedule Campaign"
                      className="p-2 rounded-lg text-violet-400 hover:bg-violet-500/10 transition-colors text-xs font-semibold flex items-center gap-1"
                    >
                      <Clock className="h-4 w-4" />
                      <span className="hidden lg:inline">Schedule</span>
                    </button>
                  )}

                  {/* Retry failed */}
                  {(camp.status === 'failed' || camp.failedCount > 0) && (
                    <button
                      onClick={() => handleRetry(camp._id)}
                      disabled={retrying === camp._id}
                      title="Retry Failed Emails"
                      className="p-2 rounded-lg text-yellow-400 hover:bg-yellow-500/10 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${retrying === camp._id ? 'animate-spin' : ''}`} />
                    </button>
                  )}

                  {/* Edit */}
                  <button
                    title="Edit Campaign"
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(camp._id)}
                    disabled={deleting === camp._id}
                    title="Delete Campaign"
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchCampaigns}
        />
      )}
    </div>
  );
}
