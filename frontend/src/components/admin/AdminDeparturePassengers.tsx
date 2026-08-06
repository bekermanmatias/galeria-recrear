import { useEffect, useMemo, useState } from 'react';
import { Bus, ContactRound, Image, LayoutGrid, List, School, Upload as UploadIcon, Users } from 'lucide-react';
import { api } from '../../lib/api';
import DashboardLayout from '../layout/DashboardLayout';
import DeparturePassengers from '../passengers/DeparturePassengers';

const tabs = [
  { id:'moderacion', label:'Moderación', icon:LayoutGrid }, { id:'lotes', label:'Lotes', icon:List }, { id:'galeria', label:'Galería', icon:Image }, { id:'salidas', label:'Salidas', icon:Bus }, { id:'colegios', label:'Colegios', icon:School }, { id:'actividades', label:'Actividades', icon:List }, { id:'usuarios', label:'Usuarios', icon:Users }, { id:'carga', label:'Carga Manual', icon:UploadIcon }, { id:'pasajeros', label:'Pasajeros', icon:ContactRound },
] as const;
export default function AdminDeparturePassengers() {
  const [authorized,setAuthorized] = useState(false);
  const [userRole,setUserRole] = useState<'admin'|'coordinator'|'parent'>('admin');
  const departureId = useMemo(() => new URLSearchParams(window.location.search).get('departureId') ?? '', []);
  useEffect(() => { void api.me().then(({user}) => { if (user.role === 'PARENT') window.location.href = '/parent'; else { setAuthorized(true); setUserRole(user.role === 'ADMIN' ? 'admin' : 'coordinator'); } }).catch(() => { window.location.href = '/login'; }); }, []);
  if (!authorized) return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',color:'#64748B'}}>Cargando…</div>;
  if (!departureId) return <div style={{padding:36,color:'#B91C1C'}}>Falta identificar la salida.</div>;
  return <DashboardLayout role={userRole} tabs={tabs as any} activeTab="salidas" onTabChange={() => { window.location.href='/admin#salidas'; }}><DeparturePassengers departureId={departureId} onBack={() => { window.location.href='/admin#salidas'; }}/></DashboardLayout>;
}