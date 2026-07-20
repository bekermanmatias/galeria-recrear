import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, X, LogOut, Settings } from 'lucide-react';
import Navbar from './Navbar';
import { api } from '../../lib/api';

export interface TabItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface DashboardLayoutProps {
  role: 'admin' | 'coordinator' | 'parent';
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
}

export default function DashboardLayout({ role, tabs, activeTab, onTabChange, children }: DashboardLayoutProps) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', flexDirection: 'column', height: '100vh', background: '#FFFFFF' }}>
      <Navbar role={role} onMenuToggle={() => setMobileMenuOpen(true)} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Dark Sidebar Nav (hidden on parent if 1 tab? Or always show) */}
        <aside className="admin-sidebar" style={{
          width: isSidebarExpanded ? '240px' : '72px',
          background: '#1A4B77',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
          flexShrink: 0,
          color: 'white',
        }}>
          <div style={{ padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  title={!isSidebarExpanded ? tab.label : undefined}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: isSidebarExpanded ? '12px' : '0',
                    width: '100%',
                    padding: isSidebarExpanded ? '12px 16px' : '12px',
                    justifyContent: isSidebarExpanded ? 'flex-start' : 'center',
                    background: isActive ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
                    fontWeight: 500,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={e => !isActive && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                  onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}
                >
                  <Icon size={20} style={{ flexShrink: 0 }} />
                  {isSidebarExpanded && tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: isSidebarExpanded ? 'flex-end' : 'center' }}>
            <button
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              title={isSidebarExpanded ? 'Colapsar menú' : 'Expandir menú'}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '8px',
                width: '40px', height: '40px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', cursor: 'pointer',
                transition: 'background 0.2s',
                flexShrink: 0
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              {isSidebarExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
          </div>
        </aside>

        {/* Dynamic Content Area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {children}
        </main>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, background: '#FFFFFF', display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#1A4B77' }}>Menú</span>
            <button onClick={() => setMobileMenuOpen(false)} style={{ background: 'none', border: 'none', padding: '8px' }}>
              <X size={24} color="#64748B" />
            </button>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { onTabChange(tab.id); setMobileMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '16px',
                    background: isActive ? '#F1F5F9' : 'transparent',
                    border: 'none', borderRadius: '12px',
                    color: isActive ? '#1A4B77' : '#475569',
                    fontSize: '16px', fontWeight: 600,
                    textAlign: 'left'
                  }}
                >
                  <Icon size={24} color={isActive ? '#1A4B77' : '#64748B'} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div style={{ padding: '24px', borderTop: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button onClick={() => window.dispatchEvent(new Event('open-account-settings'))} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'none', border: 'none', color: '#475569', fontSize: '15px', fontWeight: 500, width: '100%', textAlign: 'left' }}>
              <Settings size={20} color="#64748B" /> Configuración
            </button>
            <button onClick={async () => { try { await api.logout(); } finally { window.location.href = '/login'; } }} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'none', border: 'none', color: '#EF4444', fontSize: '15px', fontWeight: 500, width: '100%', textAlign: 'left' }}>
              <LogOut size={20} color="#EF4444" /> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
