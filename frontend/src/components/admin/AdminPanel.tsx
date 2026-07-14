import { useState } from 'react';
import { LayoutGrid, School, Calendar, Users, Upload as UploadIcon, List, Image } from 'lucide-react';
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

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', height: '100vh', background: '#FFFFFF' }}>
      <Navbar role="admin" />
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Sidebar Nav */}
        <aside style={{
          width: '260px',
          borderRight: '1px solid #E4E4E7',
          display: 'flex',
          flexDirection: 'column',
          background: '#FAFAFA',
        }}>
          <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    width: '100%', padding: '12px 16px',
                    background: isActive ? '#FFFFFF' : 'transparent',
                    border: '1px solid',
                    borderColor: isActive ? '#E4E4E7' : 'transparent',
                    borderRadius: '8px',
                    color: isActive ? '#1A4B77' : '#71717A',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
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
