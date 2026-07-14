import { useState } from 'react';
import { LayoutGrid, School, Calendar, Users, Upload as UploadIcon, List, Image, ChevronRight, ChevronLeft } from 'lucide-react';
import Navbar from '../layout/Navbar';
import AdminModeration from './AdminModeration';
import AdminColegios from './AdminColegios';
import AdminActividades from './AdminActividades';
import AdminTurnos from './AdminTurnos';
import AdminUsuarios from './AdminUsuarios';
import AdminCargaManual from './AdminCargaManual';
import AdminGaleria from './AdminGaleria';

type TabId = 'moderacion' | 'colegios' | 'actividades' | 'turnos' | 'usuarios' | 'carga' | 'galeria';

const TABS = [
  { id: 'moderacion', label: 'Moderación', icon: LayoutGrid },
  { id: 'galeria', label: 'Galería', icon: Image },
  { id: 'colegios', label: 'Colegios', icon: School },
  { id: 'actividades', label: 'Actividades', icon: List },
  { id: 'turnos', label: 'Turnos', icon: Calendar },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'carga', label: 'Carga Manual', icon: UploadIcon },
] as const;

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('moderacion');

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', height: '100vh', background: '#FFFFFF' }}>
      <Navbar role="admin" />
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Dark Sidebar Nav */}
        <aside style={{
          width: isSidebarExpanded ? '240px' : '72px',
          background: '#1A4B77',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
          flexShrink: 0,
          color: 'white',
        }}>
          <div style={{ padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabId)}
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
          {activeTab === 'moderacion' && <AdminModeration />}
          {activeTab === 'galeria' && <AdminGaleria />}
          {activeTab === 'colegios' && <AdminColegios />}
          {activeTab === 'actividades' && <AdminActividades />}
          {activeTab === 'turnos' && <AdminTurnos />}
          {activeTab === 'usuarios' && <AdminUsuarios />}
          {activeTab === 'carga' && <AdminCargaManual />}
        </main>

      </div>
    </div>
  );
}
