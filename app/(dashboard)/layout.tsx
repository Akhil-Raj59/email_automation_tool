'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Mail, 
  Users, 
  History, 
  Menu, 
  X, 
  LogOut,
  SendHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
}

const navItems: NavItem[] = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard }, // Ye sahi hai kyunki andar ek 'dashboard' folder hai
  { name: 'Campaigns', href: '/campaigns', icon: Mail },          // '/dashboard/campaigns' se '/campaigns' kiya
  { name: 'Leads & Lists', href: '/leads', icon: Users },         // '/dashboard/leads' se '/leads' kiya
  { name: 'Sending Logs', href: '/logs', icon: History },          // '/dashboard/logs' se '/logs' kiya
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 glass border-b border-border z-40 w-full sticky top-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg border border-primary/20">
            <SendHorizontal className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            VANGUARD
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-muted-foreground hover:text-foreground focus:outline-none"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 glass border-r border-border flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen sticky top-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-border/40">
          <div className="p-1.5 bg-primary/10 rounded-lg border border-primary/20">
            <SendHorizontal className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            VANGUARD
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                )}
              >
                <Icon className={cn(
                  "h-4 w-4 transition-transform group-hover:scale-110",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer / Account Section */}
        <div className="p-4 border-t border-border/40 space-y-2">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl glass-panel">
            <div className="h-8 w-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">Admin Console</p>
              <p className="text-[10px] text-muted-foreground truncate">internal use only</p>
            </div>
          </div>
          <button
            onClick={() => {
              // Sign out flow will remove cookie session
              window.location.href = '/login';
            }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-xs font-medium rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Header bar for desktop */}
        <header className="hidden md:flex items-center justify-between h-16 px-8 glass-panel border-b border-border/20 sticky top-0 z-30 font-sans">
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {navItems.find((item) => pathname === item.href || pathname.startsWith(item.href + '/'))?.name || 'Overview'}
          </h2>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          </div>
        </header>

        {/* Dashboard Pages Content */}
        <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </div>
      </main>
    </div>
  );
}
