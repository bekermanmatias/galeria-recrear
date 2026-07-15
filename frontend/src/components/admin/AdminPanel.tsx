import { useState } from 'react';
import { LayoutGrid, School, Calendar, Users, Upload as UploadIcon, List, Image } from 'lucide-react';
import DashboardLayout from '../layout/DashboardLayout';
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
    <DashboardLayout 
      role="admin" 
      tabs={TABS as any} 
      activeTab={activeTab} 
      onTabChange={(id) => setActiveTab(id as TabId)}
    >
      {activeTab === 'moderacion' && <AdminModeration />}
      {activeTab === 'galeria' && <AdminGaleria />}
      {activeTab === 'colegios' && <AdminColegios />}
      {activeTab === 'actividades' && <AdminActividades />}
      {activeTab === 'turnos' && <AdminTurnos />}
      {activeTab === 'usuarios' && <AdminUsuarios />}
      {activeTab === 'carga' && <AdminCargaManual />}
    </DashboardLayout>
  );
}
