import { useEffect, useState } from 'react';
import { LayoutGrid, School, Users, Upload as UploadIcon, List, Image, Bus, ContactRound, Activity, Shield } from 'lucide-react';
import { api } from '../../lib/api';
import DashboardLayout from '../layout/DashboardLayout';
import AdminModeration from './AdminModeration';
import { UsersView, CatalogView, SchoolsView } from './ConnectedViews';
import AdminCargaManual from './AdminCargaManual';
import AdminEstadoCargas from './AdminEstadoCargas';
import AdminSalidas from './AdminSalidas';
import { GalleryView } from './ConnectedViews';
import AdminPasajeros from './AdminPasajeros';
import RolesView from './RolesView';

type TabId = 'moderacion' | 'galeria' | 'salidas' | 'colegios' | 'actividades' | 'usuarios' | 'roles' | 'pasajeros' | 'carga';
const TABS = [
  { id: 'moderacion', label: 'Moderación', icon: LayoutGrid },
  { id: 'galeria', label: 'Galería', icon: Image },
  { id: 'salidas', label: 'Salidas', icon: Bus },
  { id: 'colegios', label: 'Colegios', icon: School },
  { id: 'actividades', label: 'Actividades', icon: List },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'roles', label: 'Roles', icon: Shield },
  { id: 'carga', label: 'Carga Manual', icon: UploadIcon },
  { id: 'pasajeros', label: 'Pasajeros', icon: ContactRound },
] as const;

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('moderacion');
  const [authorized, setAuthorized] = useState(false);
  useEffect(() => { api.me().then(({ user }) => { if (user.role !== 'ADMIN') window.location.href = user.role === 'COORDINATOR' ? '/coordinator' : '/parent'; else setAuthorized(true); }).catch(() => { window.location.href = '/login'; }); }, []);
  if (!authorized) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#64748B' }}>Cargando…</div>;
  return <DashboardLayout role="admin" tabs={TABS as any} activeTab={activeTab} onTabChange={id => setActiveTab(id as TabId)}>
    {activeTab === 'moderacion' && <AdminModeration />}
    {activeTab === 'galeria' && <GalleryView />}
    {activeTab === 'salidas' && <AdminSalidas />}
    {activeTab === 'colegios' && <SchoolsView />}
    {activeTab === 'actividades' && <CatalogView kind="activities" />}
    {activeTab === 'usuarios' && <UsersView />}
    {activeTab === 'roles' && <RolesView />}
    {activeTab === 'carga' && <AdminCargaManual />}
    {activeTab === 'pasajeros' && <AdminPasajeros />}
  </DashboardLayout>;
}







