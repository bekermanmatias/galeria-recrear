import { useEffect, useMemo, useState } from 'react';
import { Bus, ContactRound, Image, LayoutGrid, List, School, Upload as UploadIcon, Users } from 'lucide-react';
import { api } from '../../lib/api';
import DashboardLayout from '../layout/DashboardLayout';
import DeparturePassengers from '../passengers/DeparturePassengers';

const tabs = [
  { id:'moderacion', label:'Moderación', icon:LayoutGrid }, { id:'galeria', label:'Galería', icon:Image }, { id:'salidas', label:'Salidas', icon:Bus }, { id:'colegios', label:'Colegios', icon:School }, { id:'actividades', label:'Actividades', icon:List }, { id:'usuarios', label:'Usuarios', icon:Users }, { id:'carga', label:'Carga Manual', icon:UploadIcon }, { id:'pasajeros', label:'Pasajeros', icon:ContactRound },
] as const;
export default function AdminDeparturePassengers() {
  const [authorized,setAuthorized] = useState(false);
  const departureId = useMemo(() => new URLSearchParams(window.location.search).get('departureId') ?? '', []);
  useEffect(() => { void api.me().then(({user}) => { if (user.role !== 'ADMIN') window.location.href = user.role === 'COORDINATOR' ? '/coordinator' : '/parent'; else setAuthorized(true); }).catch(() => { window.location.href = '/login'; }); }, []);
  if (!authorized) return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',color:'#64748B'}}>Cargando…</div>;
  if (!departureId) return <div style={{padding:36,color:'#B91C1C'}}>Falta identificar la salida.</div>;
  return <DashboardLayout role="admin" tabs={tabs as any} activeTab="salidas" onTabChange={() => { window.location.href='/admin#salidas'; }}><DeparturePassengers departureId={departureId} onBack={() => { window.location.href='/admin#salidas'; }}/></DashboardLayout>;
}