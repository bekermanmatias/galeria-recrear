import { useEffect, useState } from 'react';
import { LayoutGrid, School, Users, Upload as UploadIcon, List, Image, Bus, ContactRound, Shield, QrCode } from 'lucide-react';
import { api, type SessionUser } from '../../lib/api';
import DashboardLayout from '../layout/DashboardLayout';
import AdminModeration from './AdminModeration';
import { UsersView, CatalogView, SchoolsView, GalleryView } from './ConnectedViews';
import AdminCargaManual from './AdminCargaManual';
import AdminSalidas from './AdminSalidas';
import AdminPasajeros from './AdminPasajeros';
import RolesView from './RolesView';
import AdminQRScanner from './AdminQRScanner';

type TabId = 'carga' | 'moderacion' | 'galeria' | 'salidas' | 'pasajeros' | 'colegios' | 'actividades' | 'usuarios' | 'roles' | 'escaner';

export default function AdminPanel() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  
  useEffect(() => { 
    api.me().then(({ user: me }) => { 
      if (!me) { window.location.href = '/login'; return; }
      if (me.role === 'PARENT') { window.location.href = '/parent'; return; }
      setUser(me); 
    }).catch(() => { window.location.href = '/login'; }); 
  }, []);

  if (!user) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#64748B' }}>Cargando…</div>;

  const p = user.permissions || {} as any;
  const isSysAdmin = user.isAdmin;

  const allTabs = [
    { id: 'carga', label: 'Subir material', icon: UploadIcon, allowed: isSysAdmin || p.lots?.create },
    { id: 'moderacion', label: 'Moderación', icon: LayoutGrid, allowed: isSysAdmin || p.moderation?.view },
    { id: 'galeria', label: 'Galería', icon: Image, allowed: isSysAdmin || p.gallery?.view },
    { id: 'salidas', label: 'Salidas', icon: Bus, allowed: isSysAdmin || p.departures?.view },
    { id: 'pasajeros', label: 'Pasajeros', icon: ContactRound, allowed: isSysAdmin || p.passengers?.view },
    { id: 'colegios', label: 'Colegios', icon: School, allowed: isSysAdmin || p.schools?.view },
    { id: 'actividades', label: 'Actividades', icon: List, allowed: isSysAdmin || p.activities?.view },
    { id: 'usuarios', label: 'Usuarios', icon: Users, allowed: isSysAdmin || p.users?.view },
    { id: 'roles', label: 'Roles', icon: Shield, allowed: isSysAdmin },
    { id: 'escaner', label: 'Escáner QR', icon: QrCode, allowed: isSysAdmin || p.passengers?.view },
  ];

  const allowedTabs = allTabs.filter(t => t.allowed);

  let currentTab = activeTab;
  if (!currentTab) {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/^\/admin\/(.+)$/);
      const urlTab = match ? match[1] : undefined;
      if (urlTab && allowedTabs.some(t => t.id === urlTab)) currentTab = urlTab as TabId;
      else if (window.location.hash) {
         const hash = window.location.hash.replace('#', '') as TabId;
         if (allowedTabs.some(t => t.id === hash)) {
            currentTab = hash;
            window.history.replaceState(null, '', '/admin/' + hash);
         }
      }
    }
  }
  if (!currentTab || !allowedTabs.some(t => t.id === currentTab)) {
    currentTab = allowedTabs[0]?.id as TabId;
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/admin/' + currentTab);
    }
  }

  // Effect to sync currentTab to state if we derived it
  if (currentTab !== activeTab) setActiveTab(currentTab);

  const uiRole = user.role === 'ADMIN' ? 'admin' : user.role === 'COORDINATOR' ? 'coordinator' : 'parent';

  return <DashboardLayout role={uiRole} tabs={allowedTabs as any} activeTab={currentTab || ''} onTabChange={id => { setActiveTab(id as TabId); window.history.pushState(null, '', '/admin/' + id); }}>
    {currentTab === 'carga' && <AdminCargaManual />}
    {currentTab === 'moderacion' && <AdminModeration />}
    {currentTab === 'galeria' && <GalleryView />}
    {currentTab === 'salidas' && <AdminSalidas />}
    {currentTab === 'pasajeros' && <AdminPasajeros />}
    {currentTab === 'colegios' && <SchoolsView />}
    {currentTab === 'actividades' && <CatalogView kind="activities" />}
    {currentTab === 'usuarios' && <UsersView />}
    {currentTab === 'roles' && <RolesView />}
    {currentTab === 'escaner' && <AdminQRScanner />}
  </DashboardLayout>;
}







