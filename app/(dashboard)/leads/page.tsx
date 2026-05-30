'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Upload, Search, Mail, Trash2, AlertTriangle } from 'lucide-react';
import { formatDate } from '@/utils/helpers';

interface Campaign {
  _id: string;
  title: string;
  status: string;
}

interface Lead {
  _id: string;
  name: string;
  email: string;
  status: 'active' | 'unsubscribed';
  createdAt: string;
  variables: Record<string, string>;
}

interface UploadResult {
  inserted: number;
  skipped: number;
  errors: string[];
  message: string;
}

/* ─── CSV Upload Zone ─── */
function UploadZone({
  campaignId,
  onUploaded,
}: {
  campaignId: string;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('campaignId', campaignId);

    try {
      const res = await fetch('/api/leads/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Upload failed');
        return;
      }

      setResult(data);
      onUploaded();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-4 py-12 px-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
          dragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border/60 hover:border-primary/40 hover:bg-secondary/20'
        }`}
      >
        <div className={`p-4 rounded-full border transition-all ${dragging ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-secondary/40 border-border/40 text-muted-foreground'}`}>
          <Upload className="h-7 w-7" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-semibold text-foreground">
            {uploading ? 'Uploading…' : 'Drop your CSV here or click to browse'}
          </p>
          <p className="text-xs text-muted-foreground">
            Required columns: <code className="text-primary bg-primary/10 px-1 rounded">email</code>,{' '}
            <code className="text-primary bg-primary/10 px-1 rounded">name</code>. Any other columns become template variables.
          </p>
          <p className="text-[11px] text-muted-foreground">Max 5MB · CSV only</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {/* Upload Result */}
      {result && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
          <p className="text-sm font-semibold text-emerald-400">{result.message}</p>
          {result.errors.length > 0 && (
            <div className="space-y-1">
              {result.errors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-xs text-yellow-400">⚠ {e}</p>
              ))}
              {result.errors.length > 5 && (
                <p className="text-xs text-muted-foreground">+ {result.errors.length - 5} more errors</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upload Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

/* ─── Main Leads Page ─── */
export default function LeadsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Fetch campaigns on mount
  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then((d) => {
        setCampaigns(d.campaigns || []);
        if (d.campaigns?.length > 0) setSelectedCampaign(d.campaigns[0]._id);
      });
  }, []);

  const fetchLeads = useCallback(async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/leads?campaignId=${selectedCampaign}&page=${page}&limit=50`);
      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [selectedCampaign, page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Client-side search filter
  const filteredLeads = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Leads &amp; Lists</h1>
          <p className="text-sm text-muted-foreground">
            Upload subscriber CSVs, preview contacts, and manage recipient profiles per campaign.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 border border-border/40 rounded-xl px-3 py-2">
          <Users className="h-4 w-4" />
          <span className="font-semibold text-foreground">{total}</span> total leads
        </div>
      </div>

      {/* Campaign Selector */}
      <div className="p-5 rounded-2xl glass-panel space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Select Campaign
            </label>
            <select
              value={selectedCampaign}
              onChange={(e) => { setSelectedCampaign(e.target.value); setPage(1); }}
              className="w-full px-4 py-2.5 rounded-xl bg-secondary/40 border border-border/60 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            >
              <option value="">— Select a campaign —</option>
              {campaigns.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title} ({c.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Upload Zone */}
        {selectedCampaign && (
          <UploadZone campaignId={selectedCampaign} onUploaded={fetchLeads} />
        )}

        {!selectedCampaign && campaigns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
            <Mail className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">No campaigns found</p>
            <p className="text-xs text-muted-foreground">Create a campaign first, then upload leads for it.</p>
          </div>
        )}
      </div>

      {/* Leads Table */}
      {selectedCampaign && (
        <div className="rounded-2xl glass overflow-hidden border border-border/40 space-y-0">
          {/* Search Bar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40 bg-secondary/10">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-xs text-muted-foreground hover:text-foreground">
                Clear
              </button>
            )}
          </div>

          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[2fr_3fr_1fr_1fr] gap-4 px-5 py-3 border-b border-border/40 bg-secondary/20">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Name</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Email</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Added</span>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-secondary/30 animate-pulse" />
              ))}
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="p-3 bg-secondary/40 rounded-full border border-border/40 text-muted-foreground">
                <Users className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-foreground">
                {search ? 'No matching leads' : 'No leads yet'}
              </p>
              <p className="text-xs text-muted-foreground">
                {search ? 'Try a different search term.' : 'Upload a CSV above to import leads.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {filteredLeads.map((lead) => (
                <div
                  key={lead._id}
                  className="grid grid-cols-1 md:grid-cols-[2fr_3fr_1fr_1fr] gap-3 items-center px-5 py-3.5 hover:bg-secondary/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-foreground">{lead.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{lead.email}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border w-fit ${
                      lead.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                    }`}
                  >
                    {lead.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(lead.createdAt)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 disabled:opacity-40 transition-colors"
                >
                  Prev
                </button>
                <span className="text-xs text-foreground font-semibold">Page {page}</span>
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
      )}

      {/* Sample CSV Download */}
      <div className="p-4 rounded-xl glass-panel flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-foreground">Need a sample CSV?</p>
          <p className="text-xs text-muted-foreground">Download our template with required columns.</p>
        </div>
        <button
          onClick={() => {
            const csv = 'email,name,company,role\nexample@company.com,Jane Doe,Acme Corp,CEO\njohn@startup.io,John Smith,Startup Inc,CTO';
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'leads_template.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border/60 text-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5 rotate-180" />
          Download Template
        </button>
      </div>
    </div>
  );
}
