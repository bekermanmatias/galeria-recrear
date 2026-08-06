import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpDown, Check, ChevronDown, ContactRound, Copy, Download, Edit2, Eye, MoreVertical, Plus, RotateCcw, Search, Trash2, Upload, X } from 'lucide-react';
import { adminRequest, api, type AdminUser, type CatalogItem, type LotSummary, type Media, type School, type Departure, type UserPermissions, type PermissionModule, type PermissionAction } from '../../lib/api';
import Lightbox from '../ui/Lightbox';
import SearchableSelect from '../ui/SearchableSelect';
import ConfirmDialog from '../ui/ConfirmDialog';
const page: React.CSSProperties = { flex: 1, padding: 32, overflowY: 'auto', background: '#fff' };
const title: React.CSSProperties = { margin: '0 0 4px', fontSize: 24, color: '#1A4B77' };
const muted: React.CSSProperties = { margin: 0, fontSize: 14, color: '#71717A' };
const primary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: '#1A4B77', color: '#fff', border: 0, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const secondary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: '#fff', color: '#1A4B77', border: '1px solid #D7E0EA', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const formatBytes = (bytes:number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const daysUntilPurge = (date?: string | null) => date ? Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)) : 0;
const input: React.CSSProperties = { padding: '10px 12px', border: '1px solid #E4E4E7', borderRadius: 6, font: 'inherit', fontSize: 13 };
const departureDateRange = (item: { event_date?: string; start_date?: string; end_date?: string }) => { const start=(item.start_date??item.event_date??'').slice(0,10); const end=(item.end_date??start).slice(0,10); const fmt=(value:string)=>value?value.split('-').reverse().join('/'):''; const a=fmt(start); const b=fmt(end); return a===b?a:a+' - '+b; };

const departureLabel = (lot: LotSummary) => {
  const name = lot.departure_name ?? lot.school_name ?? 'Salida';
  const type = lot.departure_type === 'AEREO' ? 'Aéreo' : lot.departure_type === 'MICRO' ? 'Micro' : '';
  if (type && !name.toLowerCase().startsWith(type.toLowerCase())) return `${type} - ${name}`;
  return name;
};

function ErrorMessage({ value }: { value: string }) {
  return value ? <div role="alert" style={{ margin: '16px 0', padding: '12px 16px', borderRadius: 8, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13 }}>{value}</div> : null;
}

function Empty({ children }: { children: string }) {
  return <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8' }}>{children}</div>;
}

export function ModerationView() {
  const [lots, setLots] = useState<LotSummary[]>([]);
  const [selected, setSelected] = useState<LotSummary | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loadLots = async () => { const data = await api.lots('PENDING'); setLots(data.items); setSelected(current => data.items.find(item => item.id === current?.id) ?? null); };
  useEffect(() => { loadLots().catch(reason => setError(reason.message)); }, []);
  useEffect(() => { if (!selected) return void setMedia([]); api.lot(selected.id).then(data => setMedia(data.media)).catch(reason => setError(reason.message)); }, [selected?.id]);
  const moderate = async (item: Media) => { setBusy(true); setError(''); try { await api.moderateMedia(item.id, item.status === 'REJECTED' ? 'restore' : 'reject'); const data = await api.lot(selected!.id); setMedia(data.media); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo moderar el archivo.'); } finally { setBusy(false); } };
  const approve = async () => { if (!selected) return; setBusy(true); try { await api.approveLot(selected.id); await loadLots(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo publicar el lote.'); } finally { setBusy(false); } };
  const filtered = lots.filter(item => `${departureLabel(item)} ${item.activity_name}`.toLowerCase().includes(search.toLowerCase()));
  const rejected = media.filter(item => item.status === 'REJECTED').length;
  return <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
    <aside style={{ width: 240, background: '#F8FAFC', borderRight: '1px solid #E5E7EB', overflowY: 'auto' }}>
      <div style={{ padding: 18, borderBottom: '1px solid #E5E7EB' }}><h2 style={{ ...title, fontSize: 17 }}>Moderación</h2><p style={{ ...muted, fontSize: 12 }}>{lots.length} lotes pendientes</p><div style={{ position: 'relative', marginTop: 14 }}><Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94A3B8' }}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar lote..." style={{ ...input, width: '100%', paddingLeft: 32, boxSizing: 'border-box' }}/></div></div>
      {filtered.map(lot => <button key={lot.id} onClick={() => setSelected(lot)} style={{ width: '100%', padding: '14px 16px', border: 0, borderLeft: selected?.id === lot.id ? '3px solid #1A4B77' : '3px solid transparent', background: selected?.id === lot.id ? '#EEF4F8' : 'transparent', textAlign: 'left', cursor: 'pointer' }}><strong style={{ display: 'block', color: '#1A4B77', fontSize: 13 }}>{departureLabel(lot)}</strong><span style={{ color: '#64748B', fontSize: 12 }}>{lot.activity_name} · {lot.event_date}</span>{lot.created_by_name && <span style={{ display: 'block', color: '#94A3B8', fontSize: 11, marginTop: 2 }}>por {lot.created_by_name}</span>}</button>)}
    </aside>
    <section style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
      {selected ? <><header style={{ padding: '22px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}><div><h2 style={title}>{departureLabel(selected).toUpperCase()}</h2><p style={muted}>{selected.activity_name} · {selected.event_date}{selected.created_by_name ? <> · <span style={{ color: '#94A3B8' }}>por {selected.created_by_name}</span></> : null}</p><div style={{ display: 'flex', gap: 8, marginTop: 12 }}><span style={{ padding: '4px 10px', borderRadius: 16, background: '#F1F5F9', fontSize: 12 }}>{media.length} total</span><span style={{ padding: '4px 10px', borderRadius: 16, background: '#F0FDF4', color: '#15803D', fontSize: 12 }}>{media.length - rejected} aprobables</span>{rejected > 0 && <span style={{ padding: '4px 10px', borderRadius: 16, background: '#FEF2F2', color: '#DC2626', fontSize: 12 }}>{rejected} descartadas</span>}</div></div><button disabled={busy || media.length === rejected} onClick={approve} style={{ ...primary, background: '#22C55E', opacity: busy ? .6 : 1 }}><Check size={18}/> Publicar lote</button></header><ErrorMessage value={error}/><div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 18 }}>{media.map((item, index) => <article key={item.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', opacity: item.status === 'REJECTED' ? .42 : 1, background: '#E2E8F0' }}>{item.kind === 'VIDEO' ? <video src={api.contentUrl(item.id)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <img src={api.thumbnailUrl(item.id)} alt={item.original_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>}<span style={{position:'absolute',left:8,bottom:8,zIndex:2,padding:'3px 7px',borderRadius:5,background:'rgba(15,23,42,.72)',color:'#fff',fontSize:11,fontWeight:600}}>{item.status==='REJECTED'&&item.purge_after?`Descartada · ${Math.max(0,Math.ceil((new Date(item.purge_after).getTime()-Date.now())/86400000))} días` : formatBytes(item.size_bytes)}</span><div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(0,0,0,.22)' }}><button onClick={() => setLightbox(index)} title="Ver" style={{ width: 40, height: 40, border: 0, borderRadius: '50%', cursor: 'pointer' }}><Eye size={19}/></button><button disabled={busy} onClick={() => moderate(item)} title={item.status === 'REJECTED' ? 'Restaurar' : 'Descartar'} style={{ width: 40, height: 40, border: 0, borderRadius: '50%', cursor: 'pointer', color: '#fff', background: item.status === 'REJECTED' ? '#22C55E' : '#EF4444' }}>{item.status === 'REJECTED' ? <RotateCcw size={19}/> : <Trash2 size={19}/>}</button></div></article>)}</div>{lightbox !== null && media[lightbox] && <Lightbox src={api.contentUrl(media[lightbox].id)} mediaType={media[lightbox].kind} downloadUrl={api.downloadUrl(media[lightbox].id)} downloadName={media[lightbox].original_name} info={formatBytes(media[lightbox].size_bytes)} onClose={() => setLightbox(null)} onNext={lightbox < media.length - 1 ? () => setLightbox(lightbox + 1) : undefined} onPrev={lightbox > 0 ? () => setLightbox(lightbox - 1) : undefined}/>}</> : <Empty>No hay lotes pendientes de revisión.</Empty>}
    </section>
  </div>;
}

type ResourceKind = 'activities' | 'shifts';
export function CatalogView({ kind }: { kind: ResourceKind }) {
  const [items,setItems]=useState<CatalogItem[]>([]); const [search,setSearch]=useState(''); const [editing,setEditing]=useState<CatalogItem|null>(null); const [open,setOpen]=useState(false); const [name,setName]=useState(''); const [code,setCode]=useState(''); const [error,setError]=useState('');
  const label=kind==='activities'?'Actividad':'Turno'; const pluralLabel=kind==='activities'?'Actividades':'Turnos'; const load=()=>adminRequest<{items:CatalogItem[]}>('/'+kind+'?includeInactive=true').then(data=>setItems(data.items)); useEffect(()=>{load().catch(reason=>setError(reason instanceof Error?reason.message:'No se pudo cargar el catálogo.'));},[kind]);
  const edit=(item?:CatalogItem)=>{setEditing(item??null);setName(item?.name??'');setCode(item?.bot_code??'');setOpen(true);};
  const save=async()=>{try{await adminRequest('/'+kind+(editing?'/'+editing.id:''),{method:editing?'PATCH':'POST',body:JSON.stringify({name,botCode:code})});setOpen(false);await load();}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo guardar.');}};
  const updateStatus=async(item:CatalogItem,active:boolean)=>{if(!active&&!confirm('¿Inactivar esta '+label.toLowerCase()+'? No aparecerá en nuevas cargas.'))return;const previous=item.active!==false;setItems(current=>current.map(value=>value.id===item.id?{...value,active}:value));try{await adminRequest('/'+kind+'/'+item.id,{method:'PATCH',body:JSON.stringify({active})});}catch(reason){setItems(current=>current.map(value=>value.id===item.id?{...value,active:previous}:value));setError(reason instanceof Error?reason.message:'No se pudo actualizar el estado.');}};
  const remove=async(item:CatalogItem)=>{if(kind!=='activities'||!confirm('¿Eliminar definitivamente esta actividad? Los lotes existentes conservarán su historial, pero quedarán sin actividad asociada.'))return;try{await adminRequest('/activities/'+item.id,{method:'DELETE'});setItems(current=>current.filter(value=>value.id!==item.id));}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo eliminar la actividad.');}};
  const filtered = items.filter(item=>(item.name+' '+item.bot_code).toLowerCase().includes(search.toLowerCase()));
  return <div style={page}>
    <style dangerouslySetInnerHTML={{__html: `
      @media (max-width: 768px) {
        .catalog-table-wrap { display: none; }
        .catalog-mobile { display: flex !important; }
      }
      @media (min-width: 769px) {
        .catalog-mobile { display: none !important; }
      }
    `}} />
    <PageHeader title={pluralLabel} subtitle={'Gestión del catálogo global de '+pluralLabel.toLowerCase()+'.'} action={<button onClick={()=>edit()} style={primary}><Plus size={16}/> Nuevo {label}</button>} search={search} onSearch={setSearch}/>
    <ErrorMessage value={error}/>
    {/* Desktop table */}
    <div className="catalog-table-wrap" style={{overflowX:'auto'}}>
      <DataTable headers={['Código','Nombre','Estado','Acciones']}>
        {filtered.map(item=><tr key={item.id} style={{borderBottom:'1px solid #E4E4E7'}}>
          <Td strong>{item.bot_code}</Td>
          <Td>{item.name}</Td>
          <Td><AdminStatusSelect active={item.active!==false} activeLabel={kind==='activities'?'Activa':'Activo'} inactiveLabel={kind==='activities'?'Inactiva':'Inactivo'} onChange={value=>void updateStatus(item,value)}/></Td>
          <td style={{padding:'12px 20px',textAlign:'right'}}>
            <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:8}}>
              <button onClick={()=>edit(item)} aria-label="Editar" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:30,height:30,border:0,background:'none',cursor:'pointer',color:'#64748B'}}><Edit2 size={16}/></button>
              {kind==='activities'&&<button onClick={()=>void remove(item)} title="Eliminar actividad definitivamente" aria-label="Eliminar actividad definitivamente" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:30,height:30,border:0,background:'none',cursor:'pointer',color:'#DC2626'}}><Trash2 size={16}/></button>}
            </div>
          </td>
        </tr>)}
      </DataTable>
    </div>
    {/* Mobile list */}
    <div className="catalog-mobile" style={{flexDirection:'column',gap:0}}>
      {!filtered.length && <div style={{padding:28,textAlign:'center',color:'#94A3B8',fontSize:14}}>No se encontraron {pluralLabel.toLowerCase()}.</div>}
      {filtered.map((item,idx)=><div key={item.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'12px 0',borderBottom:'1px solid #F1F5F9',opacity:item.active!==false?1:.6}}>
        <div style={{flex:1,minWidth:0,paddingRight:4}}>
          <div style={{fontWeight:600,fontSize:14,color:'#1A4B77',lineHeight:1.3,overflowWrap:'break-word'}}>{item.name}</div>
          <div style={{fontSize:12,color:'#64748B',marginTop:2}}>Cód: {item.bot_code}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
          <AdminStatusSelect compact active={item.active!==false} activeLabel={kind==='activities'?'Activa':'Activo'} inactiveLabel={kind==='activities'?'Inactiva':'Inactivo'} onChange={value=>void updateStatus(item,value)}/>
          <button onClick={()=>edit(item)} aria-label="Editar" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,border:0,background:'none',cursor:'pointer',color:'#64748B'}}><Edit2 size={15}/></button>
          {kind==='activities'&&<button onClick={()=>void remove(item)} title="Eliminar actividad definitivamente" aria-label="Eliminar actividad definitivamente" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,border:0,background:'none',cursor:'pointer',color:'#DC2626'}}><Trash2 size={15}/></button>}
        </div>
      </div>)}
    </div>
    {open&&<Modal title={(editing?'Editar ':'Nuevo ')+label} onClose={()=>setOpen(false)} onSave={save}><Field label="Nombre" value={name} onChange={setName}/><Field label="Código del bot" value={code} onChange={setCode}/></Modal>}
  </div>;
}
export function AdminStatusSelect({ active, activeLabel = "Activo", inactiveLabel = "Inactivo", onChange, fullWidth = false, compact = false, disabled = false }: { active: boolean; activeLabel?: string; inactiveLabel?: string; onChange: (next: boolean) => void; fullWidth?: boolean; compact?: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const choose = (next: boolean) => { setOpen(false); if (next !== active) onChange(next); };
  if (disabled) return <span style={{ display: fullWidth ? 'block' : 'inline-flex', padding: compact ? '4px 8px' : '6px 10px', background: '#F1F5F9', color: '#64748B', borderRadius: 6, fontSize: compact ? 11 : 12, fontWeight: 600, border: '1px solid #E2E8F0', alignItems: 'center', justifyContent: 'center' }}>{active ? activeLabel : inactiveLabel}</span>;
  return <div ref={ref} style={{ position: 'relative', display: fullWidth ? 'block' : 'inline-block', width: fullWidth ? '100%' : undefined }}>
    <button type="button" onClick={() => setOpen(value => !value)} aria-haspopup="listbox" aria-expanded={open} style={{ display: 'inline-flex', width: fullWidth ? '100%' : undefined, alignItems: 'center', justifyContent: 'space-between', gap: compact ? 4 : 14, minWidth: compact ? 'auto' : 95, padding: compact ? '4px 6px 4px 8px' : '6px 8px 6px 10px', border: '1px solid #DCE3EB', borderRadius: 6, background: '#fff', color: '#334155', fontSize: compact ? 11 : 12, fontWeight: 600, cursor: 'pointer' }}>
      {active ? activeLabel : inactiveLabel}<ChevronDown size={compact ? 12 : 14} color="#64748B" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s', flexShrink: 0 }} />
    </button>
    {open && <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 95, zIndex: 30, padding: 4, border: '1px solid #DCE3EB', borderRadius: 6, background: '#fff', boxShadow: '0 8px 20px rgba(15,23,42,.12)' }}>
      {[true, false].map(value => <button key={String(value)} type="button" role="option" aria-selected={active === value} onClick={() => choose(value)} style={{ display: 'block', width: '100%', padding: '6px 8px', border: 0, borderRadius: 4, background: active === value ? '#F8FAFC' : '#fff', color: '#334155', textAlign: 'left', font: 'inherit', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>{value ? activeLabel : inactiveLabel}</button>)}
    </div>}
  </div>;
}
export function SchoolsView() {
  const [items,setItems]=useState<School[]>([]); const [search,setSearch]=useState(''); const [editing,setEditing]=useState<School|null>(null); const [open,setOpen]=useState(false); const [form,setForm]=useState({name:'',code:'',botCode:'',startDate:'',endDate:''}); const [error,setError]=useState('');
  const [pendingDelete, setPendingDelete] = useState<School|null>(null); const [saving, setSaving] = useState(false);
  const load=()=>adminRequest<{items:School[]}>('/schools?includeInactive=true').then(data=>setItems(data.items)); useEffect(()=>{load().catch(reason=>setError(reason instanceof Error?reason.message:'No se pudieron cargar los colegios.'));},[]);
  const edit=(item?:School)=>{setEditing(item??null);setForm({name:item?.name??'',code:item?.code??'',botCode:item?.bot_code??'',startDate:item?.start_date??'',endDate:item?.end_date??''});setOpen(true);};
  const save=async()=>{try{await adminRequest('/schools'+(editing?'/'+editing.id:''),{method:editing?'PATCH':'POST',body:JSON.stringify({...form,startDate:form.startDate||null,endDate:form.endDate||null})});setOpen(false);await load();}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo guardar.');}};
  const updateStatus=async(item:School,active:boolean)=>{if(!active&&!confirm('¿Inactivar este colegio? No aparecerá al configurar nuevas salidas.'))return;const previous=item.active!==false;setItems(current=>current.map(value=>value.id===item.id?{...value,active}:value));try{await adminRequest('/schools/'+item.id,{method:'PATCH',body:JSON.stringify({active})});}catch(reason){setItems(current=>current.map(value=>value.id===item.id?{...value,active:previous}:value));setError(reason instanceof Error?reason.message:'No se pudo actualizar el estado.');}};
  const filtered = items.filter(item=>(item.name+' '+item.code).toLowerCase().includes(search.toLowerCase()));
  return <div style={page}>
    <style dangerouslySetInnerHTML={{__html: `
      @media (max-width: 768px) {
        .schools-table-wrap { display: none; }
        .schools-mobile { display: flex !important; }
      }
      @media (min-width: 769px) {
        .schools-mobile { display: none !important; }
      }
    `}} />
    <PageHeader title="Colegios" subtitle="Gestión de colegios y coordinadores que pueden integrarse a cada salida." action={<button onClick={()=>edit()} style={primary}><Plus size={16}/> Nuevo Colegio</button>} search={search} onSearch={setSearch}/>
    <ErrorMessage value={error}/>
    <div className="schools-table-wrap" style={{overflowX:'auto'}}>
      <DataTable headers={['Código','Nombre','Código bot','Estado','Acciones']}>
        {filtered.map(item=><tr key={item.id} style={{borderBottom:'1px solid #E4E4E7'}}>
          <Td strong>{item.code}</Td>
          <Td>{item.name}</Td>
          <Td>{item.bot_code}</Td>
          <Td><AdminStatusSelect active={item.active!==false} activeLabel="Activo" inactiveLabel="Inactivo" onChange={value=>void updateStatus(item,value)}/></Td>
          <td style={{padding:'12px 20px',textAlign:'right'}}>
            <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:8}}>
              <button type="button" title="Ver pasajeros" aria-label="Ver pasajeros" onClick={()=>{window.location.href='/admin/colegios-pasajeros?schoolId='+item.id}} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:30,height:30,border:0,background:'none',color:'#1A4B77',cursor:'pointer'}}><ContactRound size={16}/></button>
              <button onClick={()=>edit(item)} aria-label="Editar" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:30,height:30,border:0,background:'none',cursor:'pointer',color:'#64748B'}}><Edit2 size={16}/></button>
              <button onClick={()=>setPendingDelete(item)} aria-label="Eliminar" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:30,height:30,border:0,background:'none',cursor:'pointer',color:'#DC2626'}}><Trash2 size={16}/></button>
            </div>
          </td>
        </tr>)}
      </DataTable>
    </div>
    <div className="schools-mobile" style={{flexDirection:'column',gap:0}}>
      {!filtered.length && <div style={{padding:28,textAlign:'center',color:'#94A3B8',fontSize:14}}>No se encontraron colegios.</div>}
      {filtered.map((item,idx)=><div key={item.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'12px 0',borderBottom:'1px solid #F1F5F9',opacity:item.active!==false?1:.6}}>
        <div style={{flex:1,minWidth:0,paddingRight:4}}>
          <div style={{fontWeight:600,fontSize:14,color:'#1A4B77',lineHeight:1.3,overflowWrap:'break-word'}}>{item.name}</div>
          <div style={{fontSize:12,color:'#64748B',marginTop:2}}>Cód: {item.code}{item.bot_code ? ` · Bot: ${item.bot_code}` : ''}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
          <AdminStatusSelect compact active={item.active!==false} activeLabel="Activo" inactiveLabel="Inactivo" onChange={value=>void updateStatus(item,value)}/>
          <button type="button" title="Ver pasajeros" aria-label="Ver pasajeros" onClick={()=>{window.location.href='/admin/colegios-pasajeros?schoolId='+item.id}} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,border:0,background:'none',color:'#1A4B77',cursor:'pointer'}}><ContactRound size={15}/></button>
          <button onClick={()=>edit(item)} aria-label="Editar" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,border:0,background:'none',cursor:'pointer',color:'#64748B'}}><Edit2 size={15}/></button>
          <button onClick={()=>setPendingDelete(item)} aria-label="Eliminar" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,border:0,background:'none',cursor:'pointer',color:'#DC2626'}}><Trash2 size={15}/></button>
        </div>
      </div>)}
    </div>
    <ConfirmDialog open={pendingDelete!==null} title="¿Eliminar colegio?" description="Se eliminará de la vista, pero se conservarán los registros históricos." confirmLabel="Eliminar colegio" tone="danger" busy={saving} onCancel={()=>setPendingDelete(null)} onConfirm={async()=>{if(!pendingDelete)return;setSaving(true);try{await adminRequest(`/schools/${pendingDelete.id}`,{method:'DELETE'});setPendingDelete(null);await load();}catch(caught){setError(caught instanceof Error?caught.message:'No se pudo eliminar.');setPendingDelete(null);}finally{setSaving(false);}}}/>
    {open&&<Modal title={(editing?'Editar ':'Nuevo ')+'Colegio'} onClose={()=>setOpen(false)} onSave={save}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div style={{gridColumn:'1 / -1'}}><Field label="Nombre" value={form.name} onChange={value=>setForm({...form,name:value})}/></div><Field label="Código identificador" value={form.code} onChange={value=>setForm({...form,code:value})}/><Field label="Código del bot (opcional)" value={form.botCode} onChange={value=>setForm({...form,botCode:value})}/><div style={{gridColumn:'1 / -1'}}><p style={{margin:'10px 0',fontSize:13,color:'#64748B'}}>Rango de fechas para restringir cargas (opcional):</p><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><Field label="Desde" type="date" value={form.startDate} onChange={value=>setForm({...form,startDate:value})}/><Field label="Hasta" type="date" value={form.endDate} onChange={value=>setForm({...form,endDate:value})}/></div></div></div></Modal>}
  </div>;
}
export function UsersView() {
  const [items,setItems]=useState<AdminUser[]>([]);
  const [departures,setDepartures]=useState<Departure[]>([]);
  const [search,setSearch]=useState('');
  const [departureSearch,setDepartureSearch]=useState('');
  const [editing,setEditing]=useState<AdminUser|null>(null);
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({name:'',email:'',password:'',role:'COORDINATOR',departureIds:[] as string[]});
  const [error,setError]=useState('');
  const [deletingUser,setDeletingUser]=useState<AdminUser|null>(null);
  const [permissionOpen,setPermissionOpen]=useState(false);
  const [permissionData,setPermissionData]=useState<UserPermissions|null>(null);
  const [permissionDraft,setPermissionDraft]=useState<Partial<Record<PermissionModule,Record<PermissionAction,boolean>>>>({});
  const [permissionTouched,setPermissionTouched]=useState(false);
  const [permissionReset,setPermissionReset]=useState(false);
  const permissionLabels: Record<PermissionModule,string> = { departures:'Salidas', lots:'Lotes y carga', moderation:'Moderación', gallery:'Galería', activities:'Actividades', schools:'Colegios', passengers:'Pasajeros', users:'Usuarios', imports:'Importaciones' };
  const permissionModules: PermissionModule[] = Object.keys(permissionLabels) as PermissionModule[];

  const load=async()=>{
    const [users,departureData]=await Promise.all([
      adminRequest<{items:AdminUser[]}>('/users?includeInactive=true&q=' + encodeURIComponent(search)),
      adminRequest<{items:Departure[]}>('/departures')
    ]);
    setItems(users.items);
    setDepartures(departureData.items.filter(item=>item.active));
  };
  useEffect(()=>{load().catch(reason=>setError(reason instanceof Error?reason.message:'No se pudieron cargar los usuarios.'));},[]);
  const edit=(item?:AdminUser)=>{
    setPermissionData(null); setPermissionDraft({}); setPermissionTouched(false); setPermissionReset(false);
    setEditing(item??null);
    setDepartureSearch('');
    setForm({name:item?.name??'',email:item?.email??'',password:'',role:item?.role??'COORDINATOR',departureIds:item?.departure_ids??[]});
    if (item?.id && item.role === 'COORDINATOR') { adminRequest<UserPermissions>('/users/'+item.id+'/permissions').then(data=>{setPermissionData(data);setPermissionDraft(data.permissions);}).catch(()=>{}); }
    setError('');
    setOpen(true);
  };
  const toggleDeparture=(id:string)=>{
    setForm(current=>({...current,departureIds:current.departureIds.includes(id)?current.departureIds.filter(item=>item!==id):[...current.departureIds,id]}));
  };
  const visibleDepartures=departures.filter(item=>[item.name,item.destination,item.public_code??''].join(' ').toLowerCase().includes(departureSearch.toLowerCase()));
  const toggleAll=()=>{
    const ids=visibleDepartures.map(item=>item.id);
    const all=ids.length>0&&ids.every(id=>form.departureIds.includes(id));
    setForm(current=>({...current,departureIds:all?current.departureIds.filter(id=>!ids.includes(id)):[...new Set([...current.departureIds,...ids])]}));
  };
  const save=async()=>{
    setError('');
    try{
      const body:any={name:form.name,email:form.email,role:form.role,departureIds:form.role==='COORDINATOR'?form.departureIds:[]};
      if(form.role==='COORDINATOR' && permissionTouched) body.permissions = permissionReset ? [] : permissionModules.map(module => ({module,...(permissionDraft[module] ?? {view:false,create:false,edit:false,delete:false})}));
      if(form.password)body.password=form.password;
      if(!editing&&!form.password)throw new Error('La contraseña inicial es obligatoria.');
      const saved = await adminRequest<AdminUser>('/users' + (editing ? '/' + editing.id : ''),{method:editing?'PATCH':'POST',body:JSON.stringify(body)});
      setOpen(false); await load();
    }catch(reason){setError(reason instanceof Error?reason.message:'No se pudo guardar.');}
  };
  const openPermissions=()=>{ if(form.role!=='COORDINATOR') return; setPermissionTouched(true); setPermissionReset(false); if(!Object.keys(permissionDraft).length){ const defaults:any={}; permissionModules.forEach(module=>defaults[module]={view:module==='departures'||module==='lots'||module==='gallery'||module==='passengers'||module==='activities'||module==='schools',create:module==='lots',edit:module==='lots'||module==='passengers',delete:false}); setPermissionDraft(defaults); } setPermissionOpen(true); };
  const togglePermission=(module:PermissionModule,action:PermissionAction)=>setPermissionDraft(current=>({...current,[module]:{view:false,create:false,edit:false,delete:false,...current[module],[action]:!current[module]?.[action]}}));
  const resetPermissions=()=>{ setPermissionTouched(true); setPermissionReset(true); const defaults:any={}; permissionModules.forEach(module=>defaults[module]={view:module==='departures'||module==='lots'||module==='gallery'||module==='passengers'||module==='activities'||module==='schools',create:module==='lots',edit:module==='lots'||module==='passengers',delete:false}); setPermissionDraft(defaults); setPermissionData(data=>data?{...data,customized:false,permissions:defaults}:data); };
  const remove=(id:string)=>{const target=items.find(item=>item.id===id);if(target)setDeletingUser(target);};
  const deleteUser=async()=>{if(!deletingUser)return;try{await adminRequest('/users/' + deletingUser.id,{method:'DELETE'});setDeletingUser(null);await load();}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo eliminar definitivamente el usuario.');}};
  const updateStatus=async(item:AdminUser,nextActive:boolean)=>{
    if(!nextActive&&!confirm('¿Desactivar este usuario? Se revocarán sus sesiones y dejará de acceder a sus salidas.'))return;
    const previous=item.active;
    setItems(current=>current.map(user=>user.id===item.id?{...user,active:nextActive}:user));
    try{await adminRequest('/users/'+item.id,{method:'PATCH',body:JSON.stringify({active:nextActive})});}
    catch(reason){setItems(current=>current.map(user=>user.id===item.id?{...user,active:previous}:user));setError(reason instanceof Error?reason.message:'No se pudo actualizar el estado.');}
  };
  const filteredItems=items.filter(item=>[item.name,item.email].join(' ').toLowerCase().includes(search.toLowerCase()));
  return <div style={page}>
    <style dangerouslySetInnerHTML={{__html: `
      @media (max-width: 768px) {
        .responsive-card-table thead { display: none; }
        .responsive-card-table, .responsive-card-table tbody, .responsive-card-table tr, .responsive-card-table td { display: block; width: 100%; box-sizing: border-box; }
        .responsive-card-table { min-width: 0 !important; }
        .responsive-card-table tr { margin-bottom: 16px; border: 1px solid #E2E8F0 !important; border-radius: 8px; padding: 12px; background: #fff; display: flex; flex-direction: column; gap: 12px; }
        .responsive-card-table td { display: flex; flex-direction: column; align-items: flex-start; padding: 0 !important; border: none !important; text-align: left; width: 100%; box-sizing: border-box; gap: 4px; word-break: break-word; }
        .responsive-card-table td::before { content: attr(data-label); font-weight: 600; font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 2px; }
        .responsive-card-table td:last-child { flex-direction: row; justify-content: flex-end; gap: 8px; margin-top: 8px; padding-top: 12px !important; border-top: 1px solid #F1F5F9 !important; }
        .responsive-card-table td:last-child::before { display: none; }
      }
    `}} />
    <PageHeader title="Usuarios" subtitle="Gestión de accesos, roles y salidas asignadas." action={<button onClick={()=>edit()} style={primary}><Plus size={16}/> Nuevo Usuario</button>} search={search} onSearch={setSearch}/>
    <ErrorMessage value={error}/>
    <DataTable className="responsive-card-table" headers={['Nombre','Email','Rol','Permisos','Salidas','Estado','Acciones']}>
      {filteredItems.map(item=><tr key={item.id} style={{borderBottom:'1px solid #E4E4E7'}}>
        <Td strong dataLabel="Nombre">{item.name}</Td><Td dataLabel="Email">{item.email}</Td>
        <Td dataLabel="Rol">{item.role==='ADMIN'?'Administrador':item.role==='COORDINATOR'?'Coordinador':'Familia'}</Td>
        <Td dataLabel="Permisos">{item.has_global_access || item.permission_mode==='GLOBAL' ? 'Acceso global' : item.permission_mode==='CUSTOM' || item.custom_permission_count ? 'Personalizados' : 'Predeterminados'}</Td>
        <Td dataLabel="Salidas">{item.has_global_access || item.permission_mode==='GLOBAL' ? 'Todas las salidas' : item.departure_names?.length ? [...new Set(item.departure_names)].join(', ') : 'Sin salidas'}</Td>
        <Td dataLabel="Estado"><AdminStatusSelect active={item.active} onChange={next=>void updateStatus(item,next)}/></Td><Actions onEdit={()=>edit(item)} onDelete={()=>remove(item.id)}/>
      </tr>)}
    </DataTable>
    {open&&<Modal title={editing?'Editar Usuario':'Nuevo Usuario'} onClose={()=>setOpen(false)} onSave={save}>
      <ErrorMessage value={error}/>
      <Field label="Nombre completo" value={form.name} onChange={value=>setForm({...form,name:value})}/>
      <Field label="Email" type="email" value={form.email} onChange={value=>setForm({...form,email:value})}/>
      <Field label={editing?'Nueva contraseña (opcional)':'Contraseña inicial'} type="password" value={form.password} onChange={value=>setForm({...form,password:value})}/>
      <label style={{display:'grid',gap:7,fontSize:13,fontWeight:600}}>Rol
        <select value={form.role} onChange={event=>setForm({...form,role:event.target.value,departureIds:event.target.value==='COORDINATOR'?form.departureIds:[]})} style={input}>
          <option value="COORDINATOR">Coordinador</option><option value="ADMIN">Administrador</option>
        </select>
      </label>
      {form.role==='COORDINATOR'&&<div style={{display:'grid',gap:8}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><label style={{fontSize:13,fontWeight:600}}>Salidas asignadas</label><button type="button" onClick={toggleAll} style={{border:0,background:'none',color:'#1A4B77',fontSize:12,fontWeight:600,cursor:'pointer'}}>Marcar/desmarcar todas</button></div>
        <div style={{position:'relative'}}><Search size={14} style={{position:'absolute',left:10,top:10,color:'#94A3B8'}}/><input value={departureSearch} onChange={event=>setDepartureSearch(event.target.value)} placeholder="Buscar salida..." style={{...input,width:'100%',paddingLeft:32,boxSizing:'border-box'}}/></div>
        <div style={{maxHeight:180,overflowY:'auto',border:'1px solid #E4E4E7',borderRadius:6,padding:6,display:'grid',gap:2}}>
          {visibleDepartures.map(item=><label key={item.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'8px 7px',borderRadius:5,cursor:'pointer',fontSize:13,fontWeight:400}}>
            <input type="checkbox" checked={form.departureIds.includes(item.id)} onChange={()=>toggleDeparture(item.id)}/>
            <span><strong style={{color:'#1A4B77'}}>{item.type==='MICRO'?'Micro':'Aéreo'} · {item.name}</strong><small style={{display:'block',color:'#64748B',marginTop:2}}>{item.destination} · {departureDateRange(item)}</small></span>
          </label>)}
          {!visibleDepartures.length&&<span style={{padding:10,color:'#94A3B8',fontSize:12}}>No hay salidas activas.</span>}
        </div>
        <span style={{fontSize:12,color:'#64748B'}}>{form.departureIds.length} salida(s) seleccionada(s)</span>
      </div>}
      {form.role==='COORDINATOR'&&<button type="button" onClick={openPermissions} style={{...secondary,width:'100%',marginTop:8}}>Configurar permisos{permissionData?.customized?' · Personalizados':' · Predeterminados'}</button>}
    </Modal>}
    {permissionOpen&&<Modal width="min(100%, 820px)" title="Configurar permisos" onClose={()=>setPermissionOpen(false)} onSave={async()=>{if(!editing?.id){setPermissionOpen(false);return;}try{const permissions=permissionReset?[]:permissionModules.map(module=>({module,...(permissionDraft[module]??{view:false,create:false,edit:false,delete:false})}));await adminRequest('/users/'+editing.id+'/permissions',{method:'PUT',body:JSON.stringify({permissions})});setPermissionData(data=>data?{...data,customized:!permissionReset,permissions:permissionDraft as any}:data);setPermissionReset(false);setPermissionTouched(false);setPermissionOpen(false);await load();}catch(reason){setError(reason instanceof Error?reason.message:'No se pudieron guardar los permisos.');}}}>
      <p style={{...muted,marginTop:0}}>Definí qué puede hacer este coordinador en cada módulo.</p>
      <div style={{border:'1px solid #E2E8F0',borderRadius:8,overflow:'hidden'}}>
        <table style={{width:'100%',tableLayout:'fixed',borderCollapse:'collapse'}}><thead><tr style={{borderBottom:'1px solid #E2E8F0'}}><th style={{padding:10,textAlign:'left',fontSize:12,color:'#64748B',width:'40%'}}>Módulo</th>{(['view','create','edit','delete'] as PermissionAction[]).map(action=><th key={action} style={{padding:10,textAlign:'center',fontSize:12,color:'#64748B'}}>{action==='view'?'Ver':action==='create'?'Crear':action==='edit'?'Editar':'Eliminar'}</th>)}</tr></thead><tbody>{permissionModules.map(module=><tr key={module} style={{borderBottom:'1px solid #F1F5F9'}}><td style={{padding:10,fontSize:13,fontWeight:600,color:'#334155'}}>{permissionLabels[module]}</td>{(['view','create','edit','delete'] as PermissionAction[]).map(action=><td key={action} style={{padding:10,textAlign:'center'}}><input type="checkbox" checked={Boolean(permissionDraft[module]?.[action])} onChange={()=>togglePermission(module,action)}/></td>)}</tr>)}</tbody></table>
      </div>
      <button type="button" onClick={resetPermissions} style={{...secondary,marginTop:12}}>Restaurar permisos predeterminados</button>
    </Modal>}
    <ConfirmDialog open={deletingUser!==null} title="¿Eliminar usuario definitivamente?" description={`Se eliminará de forma permanente la cuenta de ${deletingUser?.name??''}. Esta acción no se puede deshacer y revocará su acceso.`} confirmLabel="Eliminar definitivamente" tone="danger" busy={false} onCancel={()=>setDeletingUser(null)} onConfirm={deleteUser}/>
  </div>;
}
const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

function StatusBadge({ status }: { status: string }) {
  let label = status;
  let bg = '#F1F5F9';
  let color = '#475569';
  if (status === 'PUBLISHED') { label = 'Publicado'; bg = '#DCFCE7'; color = '#15803D'; }
  else if (status === 'PENDING') { label = 'Pendiente'; bg = '#FEF3C7'; color = '#B45309'; }
  else if (status === 'DRAFT') { label = 'Borrador'; bg = '#F1F5F9'; color = '#475569'; }
  else if (status === 'UPLOADING') { label = 'Cargando'; bg = '#DBEAFE'; color = '#1D4ED8'; }
  else if (status === 'REJECTED') { label = 'Descartado'; bg = '#FEE2E2'; color = '#B91C1C'; }
  return <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 6, background: bg, color: color, fontSize: 12, fontWeight: 700 }}>{label}</span>;
}

export function GalleryView() {
  const [lots,setLots]=useState<LotSummary[]>([]);
  const [media,setMedia]=useState<Array<Media&{lot:LotSummary}>>([]);
  const [departure,setDeparture]=useState(() => {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('galleryDeparture');
      if (q) return decodeURIComponent(q);
    }
    return 'Todos';
  });
  const [activity,setActivity]=useState('Todos');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [selected,setSelected]=useState<number|null>(null);
  const [activeLot,setActiveLot]=useState('');
  const [openedLot,setOpenedLot]=useState<string|null>(null);
  const [showRejected,setShowRejected]=useState(false);
  const [sort,setSort]=useState<'newest'|'oldest'|'departure'>('newest');
  const [sortOpen,setSortOpen]=useState(false);
  const [recovering,setRecovering]=useState<string|null>(null);
  const [openMediaMenu,setOpenMediaMenu]=useState<string|null>(null);
  const [openLotMenu,setOpenLotMenu]=useState<string|null>(null);
  const [deletingLot,setDeletingLot]=useState<LotSummary|null>(null);
  const [deleteBusyId,setDeleteBusyId]=useState<string|null>(null);
  const [pendingDiscard,setPendingDiscard]=useState<(Media&{lot:LotSummary})|null>(null);
  const [error,setError]=useState('');
  const [deletingUser,setDeletingUser]=useState<AdminUser|null>(null);
  const [permissionOpen,setPermissionOpen]=useState(false);
  const [permissionData,setPermissionData]=useState<UserPermissions|null>(null);
  const [permissionDraft,setPermissionDraft]=useState<Partial<Record<PermissionModule,Record<PermissionAction,boolean>>>>({});
  const [permissionTouched,setPermissionTouched]=useState(false);
  const [permissionReset,setPermissionReset]=useState(false);
  const permissionLabels: Record<PermissionModule,string> = { departures:'Salidas', lots:'Lotes y carga', moderation:'Moderación', gallery:'Galería', activities:'Actividades', schools:'Colegios', passengers:'Pasajeros', users:'Usuarios', imports:'Importaciones' };
  const permissionModules: PermissionModule[] = Object.keys(permissionLabels) as PermissionModule[];
  const [copiedCode,setCopiedCode]=useState<string|null>(null);
  const [copiedOnlyCode,setCopiedOnlyCode]=useState<string|null>(null);
  const [editingLot,setEditingLot]=useState<LotSummary|null>(null);
  const [editForm,setEditForm]=useState({departureId:'',activityId:'',albumName:'',eventDate:'',status:''});
  const [editBusy,setEditBusy]=useState(false);
  const [departuresList,setDeparturesList]=useState<Array<{id:string;name:string;type:string}>>([]);
  const [activitiesList,setActivitiesList]=useState<Array<{id:string;name:string}>>([]);

  const copyPublicLink = async (code?: string | null) => {
    if (!code) return;
    const url = new URL(`/${encodeURIComponent(code)}`, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyPublicCode = async (code?: string | null) => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopiedOnlyCode(code);
    setTimeout(() => setCopiedOnlyCode(null), 2000);
  };

  useEffect(()=>{let mounted=true;api.lots().then(async data=>{const details=await Promise.all(data.items.map(async lot=>({lot,media:(await api.lot(lot.id)).media})));if(!mounted)return;setLots(data.items);setMedia(details.flatMap(item=>item.media.map(file=>({...file,lot:item.lot}))));}).catch(reason=>mounted&&setError(reason.message));adminRequest<{items:any[]}>('/departures').then(res=>mounted&&setDeparturesList(res.items)).catch(()=>{});adminRequest<{items:any[]}>('/activities').then(res=>mounted&&setActivitiesList(res.items)).catch(()=>{});return()=>{mounted=false;};},[]);

  const openEditModal = (lot: LotSummary) => {
    setOpenLotMenu(null);
    setEditingLot(lot);
    setEditForm({
      departureId: lot.departure_id ?? '',
      activityId: lot.activity_id ?? '',
      albumName: lot.album_name || lot.activity_name,
      eventDate: lot.event_date.slice(0, 10),
      status: lot.status,
    });
  };

  const handleSaveLotEdit = async () => {
    if (!editingLot) return;
    setEditBusy(true);
    setError('');
    try {
      await adminRequest(`/lots/${editingLot.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          departureId: editForm.departureId,
          activityId: editForm.activityId || null,
          albumName: editForm.albumName,
          eventDate: editForm.eventDate,
          status: editForm.status,
        }),
      });
      const data = await api.lots();
      setLots(data.items);
      setEditingLot(null);
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar el lote');
    } finally {
      setEditBusy(false);
    }
  };

  const departureOptions=useMemo(()=>['Todos',...Array.from(new Set(lots.map(departureLabel)))],[lots]);
  const activityOptions=useMemo(()=>['Todos',...Array.from(new Set(lots.map(item=>item.activity_name)))],[lots]);
  const filteredLots=useMemo(()=>{
    const filtered = lots.filter(lot=>(departure==='Todos'||departureLabel(lot)===departure)&&(activity==='Todos'||lot.activity_name===activity)&&(!from||lot.event_date.slice(0,10)>=from)&&(!to||lot.event_date.slice(0,10)<=to));
    return filtered.sort((a,b) => {
      if (sort === 'newest') return new Date(b.version_created_at || 0).getTime() - new Date(a.version_created_at || 0).getTime();
      if (sort === 'oldest') return new Date(a.version_created_at || 0).getTime() - new Date(b.version_created_at || 0).getTime();
      if (sort === 'departure') return departureLabel(a).localeCompare(departureLabel(b));
      return 0;
    });
  },[lots,departure,activity,from,to,sort]);
  const groups=useMemo(()=>filteredLots.map(lot=>({lot,files:media.filter(file=>file.lot.id===lot.id)})),[filteredLots,media]);
  const displayedGroups=useMemo(()=>openedLot?groups.filter(group=>group.lot.id===openedLot):groups,[groups,openedLot]);
  const filesForDisplay=(group:typeof groups[number])=>openedLot&&showRejected?group.files.filter(file=>file.status==='APPROVED'||file.status==='REJECTED'):group.files.filter(file=>file.status==='APPROVED');
  const visible=useMemo(()=>displayedGroups.flatMap(filesForDisplay),[displayedGroups,openedLot,showRejected]);
  const selectedItem=selected===null?null:visible[selected]??null;
  const currentLot=groups.find(group=>group.lot.id===activeLot)??groups.find(group=>group.lot.id===openedLot)??groups[0];
  const currentRejected=currentLot?.files.filter(file=>file.status==='REJECTED')??[];
  const nextPurgeDays=currentRejected.length?Math.min(...currentRejected.map(file=>daysUntilPurge(file.purge_after))):0;

  useEffect(()=>{const close=()=>{setOpenMediaMenu(null);setOpenLotMenu(null);};document.addEventListener('click',close);return()=>document.removeEventListener('click',close);},[]);

  const moderateGalleryMedia=async (item:Media&{lot:LotSummary},confirmed=false)=>{const restore=item.status==='REJECTED';if(!restore&&!confirmed){setOpenMediaMenu(null);setPendingDiscard(item);return;}try{setRecovering(item.id);setOpenMediaMenu(null);setError('');await api.moderateMedia(item.id,restore?'restore':'reject');setMedia(current=>current.map(file=>file.id===item.id?{...file,status:restore?'APPROVED':'REJECTED',purge_after:restore?null:new Date(Date.now()+30*86400000).toISOString()}:file));setPendingDiscard(null);}catch(reason:any){setError(reason.message||(restore?'No se pudo recuperar la foto':'No se pudo descartar la foto'));}finally{setRecovering(null);}};

  const downloadLot=async (group: typeof groups[number])=>{try{setError('');const approved=group.files.filter(file=>file.status==='APPROVED');if(!approved.length)throw new Error('El lote no tiene archivos aprobados para descargar');const blob=await api.downloadZip(approved.map(file=>file.id));const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`${departureLabel(group.lot)} - ${group.lot.activity_name}.zip`;link.click();URL.revokeObjectURL(url);}catch(reason:any){setError(reason.message||'No se pudo descargar el lote');}};

  return <div style={{flex:1,display:'flex',flexDirection:'column',padding:32,overflowY:'auto'}} className="gallery-page-container">
    <style dangerouslySetInnerHTML={{__html: `
      @media (max-width: 768px) {
        .gallery-page-container { padding: 16px !important; overflow-x: hidden !important; }
        .gallery-filters { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
        .gallery-filters > div { width: 100% !important; min-width: 0 !important; }
        .gallery-date-filter { display: grid !important; grid-template-columns: max-content 1fr !important; gap: 8px 12px !important; padding: 12px !important; }
        .gallery-date-filter input { width: 100% !important; box-sizing: border-box !important; }
        .gallery-table-header { display: none !important; }
        .gallery-table-row { grid-template-columns: 1fr !important; display: flex !important; flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
        .gallery-table-row > div { width: 100%; display: flex; flex-direction: column; gap: 4px; }
        .gallery-table-row > div::before { font-weight: 600; font-size: 11px; color: #64748B; text-transform: uppercase; }
        .gallery-table-row > div:nth-child(2)::before { content: "Álbum / Actividad"; }
        .gallery-table-row > div:nth-child(3)::before { content: "Fecha"; }
        .gallery-table-row > div:nth-child(4)::before { content: "Creador"; }
        .gallery-table-row > div:nth-child(5)::before { content: "Estado"; }
        .gallery-table-row > div:nth-child(6) { flex-direction: row !important; justify-content: space-between !important; margin-top: 8px; padding-top: 12px; border-top: 1px solid #F1F5F9; }
        .gallery-table-row > div:nth-child(6) > div { justify-content: flex-end; }
      }
    `}} />
    {!openedLot&&<div style={{display:'flex',flexDirection:'column',gap:16,marginBottom:24}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16}}>
        <div><h2 style={{margin:'0 0 4px',fontSize:24,color:'#1A4B77'}}>Galería de Lotes</h2><p style={{margin:0,fontSize:14,color:'#71717A'}}>Gestión y listado global de lotes en el sistema.</p></div>
      </div>
      <div className="gallery-filters" style={{display:'flex',flexWrap:'wrap',gap:12}}>
        <div style={{flex: 1, minWidth: 240}}><SearchableSelect value={departure} onChange={setDeparture} options={departureOptions} placeholder="Todas las salidas" style={{width:'100%'}}/></div>
        <div style={{flex: 1, minWidth: 200}}><SearchableSelect value={activity} onChange={setActivity} options={activityOptions} placeholder="Todas las actividades" style={{width:'100%'}}/></div>
        <div className="gallery-date-filter" style={{display:'flex',alignItems:'center',gap:8,background:'#F4F4F5',padding:'4px 8px',borderRadius:6}}><span style={{fontSize:12,color:'#71717A',fontWeight:500}}>Desde:</span><input type="date" value={from} onChange={event=>setFrom(event.target.value)} style={{padding:4,border:'none',background:'transparent',fontSize:13,outline:'none',color:'#09090B'}}/><span style={{fontSize:12,color:'#71717A',fontWeight:500}}>Hasta:</span><input type="date" value={to} onChange={event=>setTo(event.target.value)} style={{padding:4,border:'none',background:'transparent',fontSize:13,outline:'none',color:'#09090B'}}/></div>
        <div onMouseLeave={()=>setSortOpen(false)} style={{position:'relative', display:'flex', alignItems:'center'}}>
          <button title="Ordenar lotes" aria-label="Ordenar lotes" aria-expanded={sortOpen} onClick={()=>setSortOpen(!sortOpen)} style={{height:39,padding:'0 12px',display:'inline-flex',alignItems:'center',gap:8,border:'1px solid #DCE3EB',borderRadius:6,background:sort==='newest'?'#fff':'#EAF2F8',color:'#1A4B77',cursor:'pointer',fontSize:13,fontWeight:600}}>
            <ArrowUpDown size={15}/> {sort==='newest'?'Más recientes':sort==='oldest'?'Más antiguos':'Salida A-Z'}
          </button>
          {sortOpen&&<div style={{position:'absolute',right:0,top:43,zIndex:30,width:180,padding:5,border:'1px solid #E2E8F0',borderRadius:8,background:'#fff',boxShadow:'0 10px 24px rgba(15,23,42,.16)'}}>
            {([['newest','Más recientes primero'],['oldest','Más antiguos primero'],['departure','Salida A-Z']] as const).map(([value,label])=><button key={value} onClick={()=>{setSort(value);setSortOpen(false);}} style={{width:'100%',padding:'8px 10px',border:0,borderRadius:5,background:sort===value?'#EEF4F8':'transparent',color:sort===value?'#1A4B77':'#475569',fontSize:12,fontWeight:sort===value?700:500,textAlign:'left',cursor:'pointer'}}>{label}</button>)}
          </div>}
        </div>
      </div>
    </div>}
    <ErrorMessage value={error}/>

    {!openedLot&&(
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        <div className="gallery-table-header" style={{display:'grid',gridTemplateColumns:'2fr 1.8fr 1fr 1.2fr 1fr 180px',gap:'12px',padding:'12px 16px',background:'#F8FAFC',borderRadius:'8px',fontSize:'12px',fontWeight:600,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.04em'}}>
          <div>Salida / Código</div>
          <div>Álbum / Actividad</div>
          <div>Fecha</div>
          <div>Creador</div>
          <div>Estado</div>
          <div style={{textAlign:'right'}}>Acciones</div>
        </div>

        {filteredLots.map(lot=>{
          const group=groups.find(g=>g.lot.id===lot.id);
          const filesCount=lot.approved_count??group?.files.length??0;
          const menuOpen=openLotMenu===lot.id;
          const publicCode=lot.departure_public_code;

          return (
            <div className="gallery-table-row" key={lot.id} style={{display:'grid',gridTemplateColumns:'2fr 1.8fr 1fr 1.2fr 1fr 180px',gap:'12px',alignItems:'center',padding:'14px 16px',background:'#FFFFFF',border:'1px solid #E2E8F0',borderRadius:'8px',transition:'all 0.2s ease'}}>
              <div>
                <div style={{fontWeight:600,color:'#1A4B77',fontSize:'14px'}}>
                  {departureLabel(lot)}
                </div>
                {publicCode&&(
                  <div style={{display:'inline-flex',alignItems:'center',gap:5,marginTop:4}}>
                    <button onClick={(e)=>{e.stopPropagation();void copyPublicCode(publicCode);}} title="Copiar código" style={{fontSize:11,color:'#475569',fontWeight:600,background:'#F1F5F9',border:'1px solid #CBD5E1',padding:'1px 6px',borderRadius:4,cursor:'pointer'}}>Cód: {copiedOnlyCode===publicCode?'¡Copiado!':publicCode}</button>
                    <button onClick={(e)=>{e.stopPropagation();void copyPublicLink(publicCode);}} title="Copiar enlace público" style={{border:'none',background:'none',cursor:'pointer',padding:'1px 4px',color:copiedCode===publicCode?'#166534':'#1A4B77',fontSize:11,fontWeight:600}}>
                      {copiedCode===publicCode?'¡Copiado!':'Copiar link'}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <span style={{fontWeight:600,color:'#0F172A',fontSize:13}}>{lot.album_name||lot.activity_name}</span>
              </div>

              <div style={{color:'#64748B',fontSize:13}}>
                {formatDate(lot.event_date)}
              </div>

              <div style={{color:'#64748B',fontSize:13}}>
                {lot.created_by_name??'Coordinador'}
              </div>

              <div>
                <StatusBadge status={lot.status}/>
              </div>

              <div style={{display:'flex',gap:6,justifyContent:'flex-end',alignItems:'center'}}>
                <button onClick={()=>{setOpenedLot(lot.id);setActiveLot(lot.id);}} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'7px 10px',background:'#1A4B77',color:'#fff',border:0,borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  <Eye size={14}/> Ver lote ({filesCount})
                </button>
                {group&&(
                  <button onClick={()=>downloadLot(group)} title="Descargar lote" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'7px 9px',background:'#F4F4F5',color:'#1A4B77',border:'1px solid #DCE3EB',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                    <Download size={14}/>
                  </button>
                )}

                <div style={{position:'relative'}}>
                  <button onClick={(e)=>{e.stopPropagation();setOpenLotMenu(menuOpen?null:lot.id);}} title="Más opciones" style={{width:32,height:32,display:'grid',placeItems:'center',border:'1px solid #DCE3EB',borderRadius:6,background:'#fff',color:'#475569',cursor:'pointer'}}>
                    <MoreVertical size={16}/>
                  </button>

                  {menuOpen&&(
                    <div style={{position:'absolute',right:0,top:36,zIndex:50,background:'#fff',border:'1px solid #E2E8F0',borderRadius:8,boxShadow:'0 10px 25px rgba(15,23,42,.15)',minWidth:210,padding:4}}>
                      <button onClick={()=>openEditModal(lot)} style={{width:'100%',border:0,background:'none',padding:'10px 12px',display:'flex',alignItems:'center',gap:8,color:'#334155',fontSize:13,fontWeight:600,cursor:'pointer',borderRadius:6,textAlign:'left'}} onMouseEnter={e=>e.currentTarget.style.background='#F1F5F9'} onMouseLeave={e=>e.currentTarget.style.background='none'}>
                        <Edit2 size={15}/> Modificar lote
                      </button>
                      <button onClick={()=>{setOpenLotMenu(null);setDeletingLot(lot);}} style={{width:'100%',border:0,background:'none',padding:'10px 12px',display:'flex',alignItems:'center',gap:8,color:'#DC2626',fontSize:13,fontWeight:600,cursor:'pointer',borderRadius:6,textAlign:'left'}} onMouseEnter={e=>e.currentTarget.style.background='#FEF2F2'} onMouseLeave={e=>e.currentTarget.style.background='none'}>
                        <Trash2 size={15}/> Eliminar lote por completo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!filteredLots.length&&<Empty>No se encontraron lotes con estos filtros.</Empty>}
      </div>
    )}

    {openedLot&&currentLot&&<section className="lot-detail-header" style={{margin:'0 0 20px',padding:'0 0 16px',borderBottom:'1px solid #E4E4E7'}}>
      <div className="lot-top-nav" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:14}}>
        <button onClick={()=>{setOpenedLot(null);setSelected(null);setShowRejected(false);}} className="lot-back-btn" style={{border:0,background:'none',padding:0,color:'#1A4B77',fontSize:13,fontWeight:600,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}>
          <ArrowLeft size={16}/> Volver a la lista
        </button>
        <button onClick={()=>downloadLot(currentLot)} className="lot-download-btn" style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 13px',background:'#F4F4F5',color:'#1A4B77',border:'1px solid #DCE3EB',borderRadius:7,fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
          <Download size={14}/> Descargar lote
        </button>
      </div>

      <div className="lot-main-info" style={{display:'flex',flexDirection:'column',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <StatusBadge status={currentLot.lot.status}/>
          {currentLot.lot.departure_public_code&&<>
            <button onClick={()=>void copyPublicCode(currentLot.lot.departure_public_code)} title="Copiar código" style={{background:'#F1F5F9',border:'1px solid #CBD5E1',borderRadius:6,padding:'3px 8px',cursor:'pointer',color:'#475569',fontWeight:600,fontSize:11}}>
              Cód: {copiedOnlyCode===currentLot.lot.departure_public_code?'¡Copiado!':currentLot.lot.departure_public_code}
            </button>
            <button onClick={()=>void copyPublicLink(currentLot.lot.departure_public_code)} title="Copiar enlace público" style={{border:'none',background:'transparent',cursor:'pointer',padding:'2px',display:'inline-flex',alignItems:'center',gap:4,color:copiedCode===currentLot.lot.departure_public_code?'#166534':'#1A4B77',fontSize:12,fontWeight:600}}>
              {copiedCode===currentLot.lot.departure_public_code?<Check size={13}/>:<Copy size={13}/>}
              <span>{copiedCode===currentLot.lot.departure_public_code?'¡Copiado!':'Copiar link'}</span>
            </button>
          </>}
        </div>

        <h2 className="lot-title" style={{margin:'2px 0 0',fontSize:18,color:'#1A4B77',fontWeight:700,lineHeight:1.3,overflowWrap:'break-word',wordBreak:'normal'}}>
          {departureLabel(currentLot.lot)} · {currentLot.lot.album_name||currentLot.lot.activity_name}
        </h2>

        <p style={{margin:0,fontSize:12,color:'#64748B'}}>
          {formatDate(currentLot.lot.event_date)} · {currentLot.files.length} {currentLot.files.length===1?'archivo':'archivos'}{currentLot.lot.created_by_name?<> · por {currentLot.lot.created_by_name}</>:null}
        </p>
      </div>
    </section>}
    {openedLot&&currentLot&&currentRejected.length>0&&<div className="lot-rejected-banner" style={{display:'flex',flexDirection:'column',gap:12,margin:'0 0 20px',padding:'14px 16px',background:'#FFF7ED',border:'1px solid #FDBA74',borderRadius:10}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
        <div style={{width:32,height:32,borderRadius:'50%',display:'grid',placeItems:'center',background:'#FEE2E2',color:'#DC2626',fontWeight:800,flexShrink:0,marginTop:2}}>!</div>
        <div style={{flex:1,minWidth:0}}>
          <strong style={{display:'block',color:'#9A3412',fontSize:14}}>{currentRejected.length} {currentRejected.length===1?'foto descartada':'fotos descartadas'}</strong>
          <span style={{display:'block',marginTop:3,fontSize:12,color:'#9A3412',lineHeight:1.4}}>{nextPurgeDays===0?'Eliminación definitiva programada para hoy':`La eliminación definitiva más próxima es en ${nextPurgeDays} ${nextPurgeDays===1?'día':'días'}`}.</span>
        </div>
      </div>
      <button onClick={()=>setShowRejected(!showRejected)} className="lot-rejected-btn" style={{alignSelf:'flex-start',padding:'8px 14px',border:'1px solid #FED7AA',borderRadius:7,background:'#fff',color:'#9A3412',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{showRejected?'Ocultar descartadas':'Revisar descartadas'}</button>
    </div>}
    {openedLot&&displayedGroups.map(group=><section key={group.lot.id} style={{marginBottom:34}}>
      <div className="lot-media-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:24}}>
        {filesForDisplay(group).map(item=>{const index=visible.findIndex(file=>file.id===item.id);const previewable=!item.mime_type.toLowerCase().includes('heic');const isRejected=item.status==='REJECTED';const daysLeft=daysUntilPurge(item.purge_after);const menuOpen=openMediaMenu===item.id;return <article key={item.id} onClick={()=>!isRejected&&previewable&&setSelected(index)} style={{position:'relative',aspectRatio:'1',background:'#F8FAFC',cursor:!isRejected&&previewable?'pointer':'default',borderRadius:10,overflow:'hidden',transition:'transform .2s, box-shadow .2s',border:isRejected?'2px solid #EF4444':'2px solid transparent',boxShadow:isRejected?'0 0 0 3px rgba(239,68,68,.08)':'none'}} onMouseEnter={event=>{event.currentTarget.style.transform='translateY(-3px)';event.currentTarget.style.boxShadow=isRejected?'0 10px 22px rgba(185,28,28,.16)':'0 10px 20px rgba(15,23,42,.16)';if(!isRejected){const overlay=event.currentTarget.querySelector('.gallery-overlay') as HTMLElement;overlay&&(overlay.style.opacity='1');}}} onMouseLeave={event=>{event.currentTarget.style.transform='none';event.currentTarget.style.boxShadow=isRejected?'0 0 0 3px rgba(239,68,68,.08)':'none';if(!isRejected){const overlay=event.currentTarget.querySelector('.gallery-overlay') as HTMLElement;overlay&&(overlay.style.opacity='0');}}}>
          <div style={{width:'100%',height:isRejected?'calc(100% - 58px)':'100%',display:'grid',placeItems:'center',overflow:'hidden',background:isRejected?'#FFF7F7':'#F4F4F5'}}>
            {item.kind==='VIDEO'?<video src={api.contentUrl(item.id)} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/>:previewable?<img src={api.thumbnailUrl(item.id)} alt={item.original_name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<div style={{display:'grid',placeItems:'center',gap:5,color:'#64748B'}}><strong style={{fontSize:18}}>{item.mime_type.toLowerCase().includes('heic')?'HEIC':'Archivo'}</strong><span title={item.original_name} style={{maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11}}>{item.original_name}</span></div>}
          </div>
          {!isRejected&&<span style={{position:'absolute',left:8,bottom:8,padding:'3px 7px',borderRadius:5,background:'rgba(15,23,42,.72)',color:'#fff',fontSize:11,fontWeight:600,zIndex:3}}>{formatBytes(item.size_bytes)}</span>}
          {isRejected&&<><span style={{position:'absolute',left:8,top:8,padding:'4px 8px',borderRadius:6,background:'#DC2626',color:'#fff',fontSize:10,fontWeight:800,letterSpacing:'.03em',zIndex:3}}>DESCARTADA</span><div style={{position:'absolute',left:0,right:0,bottom:0,height:58,boxSizing:'border-box',padding:'9px 10px',background:'#fff',borderTop:'1px solid #FECACA',zIndex:2}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,fontSize:11}}><span style={{color:'#475569',fontWeight:600}}>{formatBytes(item.size_bytes)}</span><span style={{color:'#B91C1C',fontWeight:700}}>{daysLeft===0?'Se elimina hoy':`${daysLeft} ${daysLeft===1?'día':'días'} restantes`}</span></div><div title={item.original_name} style={{marginTop:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:10,color:'#64748B'}}>{item.original_name}</div></div></>}
          {!isRejected&&<div className="gallery-overlay" style={{position:'absolute',inset:0,background:'rgba(0,0,0,.6)',opacity:0,transition:'opacity .2s',display:'flex',flexDirection:'column',justifyContent:'flex-end',padding:12,pointerEvents:'none'}}><span style={{color:'#fff',fontSize:11,fontWeight:600}}>{departureLabel(group.lot)}</span><span style={{color:'#E4E4E7',fontSize:11}}>{group.lot.activity_name}</span></div>}
          <button aria-label="Acciones de imagen" aria-expanded={menuOpen} onClick={event=>{event.stopPropagation();setOpenMediaMenu(menuOpen?null:item.id);}} style={{position:'absolute',right:8,top:8,zIndex:7,width:32,height:32,display:'grid',placeItems:'center',border:'1px solid rgba(148,163,184,.35)',borderRadius:'50%',background:'rgba(255,255,255,.94)',color:'#334155',cursor:'pointer',boxShadow:'0 2px 6px rgba(15,23,42,.16)'}}><MoreVertical size={18}/></button>
          {menuOpen&&<div role="menu" onClick={event=>event.stopPropagation()} style={{position:'absolute',right:8,top:46,zIndex:8,minWidth:168,padding:5,background:'#fff',border:'1px solid #E2E8F0',borderRadius:8,boxShadow:'0 10px 25px rgba(15,23,42,.2)'}}><button disabled={recovering===item.id} onClick={()=>moderateGalleryMedia(item)} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'9px 10px',border:0,borderRadius:6,background:'transparent',color:isRejected?'#15803D':'#B91C1C',fontSize:12,fontWeight:650,cursor:recovering===item.id?'wait':'pointer',textAlign:'left'}}>{isRejected?<RotateCcw size={16}/>:<Trash2 size={16}/>} {recovering===item.id?'Procesando?':isRejected?'Recuperar y publicar':'Descartar imagen'}</button></div>}
        </article>;})}
      </div>
    </section>)}
    {openedLot&&!displayedGroups.length&&<Empty>No hay fotos publicadas en este lote.</Empty>}
    {selectedItem&&<Lightbox src={api.contentUrl(selectedItem.id)} mediaType={selectedItem.kind} downloadUrl={api.downloadUrl(selectedItem.id)} downloadName={selectedItem.original_name} info={formatBytes(selectedItem.size_bytes)} onClose={()=>setSelected(null)} onNext={selected!==null&&selected<visible.length-1?()=>setSelected(selected+1):undefined} onPrev={selected!==null&&selected>0?()=>setSelected(selected-1):undefined}/>}
    <ConfirmDialog open={pendingDiscard!==null} title="¿Descartar imagen?" description="La imagen dejará de mostrarse a las familias, pero podrás recuperarla durante los próximos 30 días." confirmLabel="Descartar imagen" busy={pendingDiscard!==null&&recovering===pendingDiscard.id} onCancel={()=>!recovering&&setPendingDiscard(null)} onConfirm={()=>{if(pendingDiscard)return moderateGalleryMedia(pendingDiscard,true);}}/>
    <ConfirmDialog open={deletingLot!==null} title="¿Eliminar lote permanentemente?" description={`Se eliminará por completo el lote "${deletingLot?.album_name||deletingLot?.activity_name}" de la salida "${deletingLot?departureLabel(deletingLot):''}". Se borrarán todas sus fotos, videos e historial del sistema. Esta acción no se puede deshacer.`} confirmLabel="Eliminar lote por completo" tone="danger" busy={deleteBusyId!==null} onCancel={()=>!deleteBusyId&&setDeletingLot(null)} onConfirm={async()=>{if(!deletingLot)return;setDeleteBusyId(deletingLot.id);try{await api.deleteLot(deletingLot.id);setLots(current=>current.filter(item=>item.id!==deletingLot.id));setDeletingLot(null);}catch(err:any){setError(err.message||'No se pudo eliminar el lote');}finally{setDeleteBusyId(null);}}}/>

    {editingLot&&(
      <Modal title="Modificar Lote" onClose={()=>setEditingLot(null)} onSave={handleSaveLotEdit}>
        <label style={{display:'grid',gap:7,fontSize:13,fontWeight:600}}>
          Salida asociada
          <select value={editForm.departureId} onChange={e=>setEditForm({...editForm,departureId:e.target.value})} style={input}>
            {departuresList.map(dep=><option key={dep.id} value={dep.id}>{(dep.type==='MICRO'?'Micro':'Aéreo')+' - '+dep.name}</option>)}
          </select>
        </label>
        <Field label="Álbum / Título" value={editForm.albumName} onChange={val=>setEditForm({...editForm,albumName:val})}/>
        <label style={{display:'grid',gap:7,fontSize:13,fontWeight:600}}>
          Actividad
          <select value={editForm.activityId} onChange={e=>setEditForm({...editForm,activityId:e.target.value})} style={input}>
            <option value="">(General / Ninguna)</option>
            {activitiesList.map(act=><option key={act.id} value={act.id}>{act.name}</option>)}
          </select>
        </label>
        <Field label="Fecha del evento" type="date" value={editForm.eventDate} onChange={val=>setEditForm({...editForm,eventDate:val})}/>
        <label style={{display:'grid',gap:7,fontSize:13,fontWeight:600}}>
          Estado del lote
          <select value={editForm.status} onChange={e=>setEditForm({...editForm,status:e.target.value})} style={input}>
            <option value="PUBLISHED">Publicado</option>
            <option value="PENDING">Pendiente de moderación</option>
            <option value="DRAFT">Borrador</option>
            <option value="REJECTED">Descartado</option>
          </select>
        </label>
      </Modal>
    )}
  </div>;
}

export function ManualUploadView() {
  const [schools,setSchools]=useState<School[]>([]); const [activities,setActivities]=useState<CatalogItem[]>([]); const [shifts,setShifts]=useState<CatalogItem[]>([]); const [school,setSchool]=useState(''); const [activity,setActivity]=useState(''); const [shift,setShift]=useState(''); const [date,setDate]=useState(new Date().toISOString().slice(0,10)); const [files,setFiles]=useState<File[]>([]); const [progress,setProgress]=useState(0); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const picker=useRef<HTMLInputElement>(null);
  const previews=useMemo(()=>files.map(file=>({file,url:URL.createObjectURL(file),isVideo:file.type.startsWith('video/'),isHeic:/\.(heic|heif)$/i.test(file.name)})),[files]);
  useEffect(()=>()=>previews.forEach(item=>URL.revokeObjectURL(item.url)),[previews]);
  useEffect(()=>{api.mySchools().then(data=>setSchools(data.items));},[]); useEffect(()=>{const item=schools.find(value=>value.name===school);if(item)api.catalogs().then(data=>{setActivities(data.activities);setShifts(data.shifts);});},[school,schools]);
  const addFiles=(selection:FileList|null)=>{if(!selection)return;const allowedNames=/\.(jpe?g|jpe|jfif|png|heic|heif|mp4|mov)$/i;const allowedTypes=new Set(['image/jpeg','image/pjpeg','image/png','image/heic','image/heif','video/mp4','video/quicktime']);const accepted=Array.from(selection).filter(file=>allowedNames.test(file.name)||allowedTypes.has(file.type.toLowerCase()));setFiles(current=>[...current,...accepted]);setMessage(accepted.length===selection.length?'': 'Se omitieron archivos con formato no permitido.');};
  const removeFile=(index:number)=>setFiles(current=>current.filter((_,position)=>position!==index));
  const upload=async()=>{const schoolItem=schools.find(item=>item.name===school),activityItem=activities.find(item=>item.name===activity),shiftItem=shifts.find(item=>item.name===shift);if(!schoolItem||!activityItem||!shiftItem||!files.length)return;setBusy(true);setMessage('');setProgress(0);try{const lot=await api.createLot({schoolId:schoolItem.id,activityId:activityItem.id,eventDate:date});for(let i=0;i<files.length;i++){await api.uploadMedia(lot.lotId,files[i]);setProgress(Math.round((i+1)/files.length*100));}await api.submitLot(lot.lotId);setFiles([]);setMessage('Carga completada y enviada a moderación.');}catch(reason){setMessage(reason instanceof Error?reason.message:'No se pudo cargar el lote.');}finally{setBusy(false);}};
  return <div style={page}><div style={{maxWidth:760,margin:'0 auto'}}><h2 style={title}>Carga manual</h2><p style={{...muted,marginBottom:28}}>Revisá los archivos seleccionados antes de enviarlos a moderación.</p><div className="responsive-grid"><SearchableSelect label="Colegio" value={school} onChange={setSchool} options={schools.map(item=>item.name)} placeholder="Seleccionar colegio..."/><label style={{display:'grid',gap:8,fontSize:13,fontWeight:500}}>Fecha<input type="date" value={date} onChange={event=>setDate(event.target.value)} style={input}/></label><SearchableSelect label="Turno" value={shift} onChange={setShift} options={shifts.map(item=>item.name)} placeholder="Seleccionar turno..."/><SearchableSelect label="Actividad" value={activity} onChange={setActivity} options={activities.map(item=>item.name)} placeholder="Seleccionar actividad..."/></div><button onClick={()=>picker.current?.click()} style={{width:'100%',margin:'24px 0',padding:56,border:'1px dashed #94A3B8',borderRadius:8,background:'#F8FAFC',color:'#1A4B77',cursor:'pointer'}}><Upload size={30}/><div style={{marginTop:10}}>Seleccionar JPEG, PNG, HEIC, MP4 o MOV</div></button><input ref={picker} hidden multiple type="file" accept=".jpg,.jpeg,.jpe,.jfif,.png,.heic,.heif,.mp4,.mov,image/jpeg,image/png,image/heic,image/heif,video/mp4,video/quicktime" onChange={event=>{addFiles(event.target.files);event.currentTarget.value='';}}/>{previews.length>0&&<><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'0 0 12px'}}><p style={muted}>{previews.length} {previews.length===1?'archivo seleccionado':'archivos seleccionados'}</p><button onClick={()=>setFiles([])} disabled={busy} style={{border:0,background:'none',color:'#B91C1C',fontWeight:600,cursor:'pointer'}}>Quitar todos</button></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(148px,1fr))',gap:12,marginBottom:20}}>{previews.map((item,index)=><article key={item.url} style={{position:'relative',minWidth:0,border:'1px solid #E2E8F0',borderRadius:8,overflow:'hidden',background:'#fff'}}><div style={{height:112,display:'grid',placeItems:'center',background:'#F1F5F9'}}>{item.isHeic?<span style={{fontWeight:700,color:'#475569'}}>HEIC</span>:item.isVideo?<video src={item.url} muted preload="metadata" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<img src={item.url} alt={item.file.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>}</div><button type="button" onClick={()=>removeFile(index)} disabled={busy} aria-label={'Quitar '+item.file.name} style={{position:'absolute',top:6,right:6,width:26,height:26,display:'grid',placeItems:'center',border:0,borderRadius:'50%',background:'rgba(15,23,42,.72)',color:'#fff',cursor:'pointer'}}><X size={15}/></button><div style={{padding:'9px 10px'}}><div title={item.file.name} style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12,fontWeight:600,color:'#334155'}}>{item.file.name}</div><div style={{marginTop:3,fontSize:11,color:'#64748B'}}>{(item.file.size/1024/1024).toFixed(1)} MB{item.isHeic?' · Se convertirá al publicar':''}</div></div></article>)}</div></>}{busy&&<div style={{height:5,background:'#E2E8F0',margin:'16px 0'}}><div style={{height:'100%',width:`${progress}%`,background:'#1A4B77'}}/></div>}{message&&<div role="alert" style={{margin:'16px 0',color:message.startsWith('Carga')?'#15803D':'#B91C1C'}}>{message}</div>}<button onClick={upload} disabled={busy||!school||!activity||!shift||!files.length} style={{...primary,width:'100%',padding:15,opacity:busy ? .6 : 1}}>{busy?'Subiendo…':'Subir material'}</button></div></div>;
}
export function ImportView(){const [kind,setKind]=useState('schools');const [file,setFile]=useState<File|null>(null);const [preview,setPreview]=useState<any>(null);const [message,setMessage]=useState('');const send=async(commit=false)=>{if(!file)return;const body=new FormData();body.append('file',file);const data=await adminRequest<any>(`/imports/${kind}/${commit?'commit':'preview'}`,{method:'POST',body});if(commit){setMessage(`${data.imported} registros importados.`);setPreview(null);}else setPreview(data);};return <div style={page}><h2 style={title}>Importar CSV</h2><p style={{...muted,marginBottom:24}}>Validá el archivo antes de confirmar; un CSV inválido no crea registros parciales.</p><div style={{display:'flex',gap:12,flexWrap:'wrap'}}><select value={kind} onChange={event=>setKind(event.target.value)} style={input}><option value="schools">Colegios</option><option value="users">Usuarios</option><option value="memberships">Asignaciones</option></select><input type="file" accept=".csv,text/csv" onChange={event=>setFile(event.target.files?.[0]??null)} style={input}/><button onClick={()=>send(false)} style={primary}>Validar</button></div>{preview&&<div style={{marginTop:24,padding:18,border:'1px solid #E2E8F0',borderRadius:8}}><strong>{preview.valid?'Archivo válido':'Archivo inválido'}</strong><p>{preview.rows?.length??0} filas · {preview.errors?.length??0} errores</p>{preview.errors?.map((item:any,index:number)=><div key={index} style={{color:'#B91C1C',fontSize:13}}>Fila {item.row}: {item.field} · {item.message}</div>)}{preview.valid&&<button onClick={()=>send(true)} style={{...primary,marginTop:12}}><Check size={16}/> Confirmar importación</button>}</div>}{message&&<p style={{color:'#15803D'}}>{message}</p>}</div>}

function PageHeader({title:heading,subtitle,action,search,onSearch}:{title:string;subtitle:string;action?:React.ReactNode;search?:string;onSearch?:(value:string)=>void}){return <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:18,marginBottom:24,flexWrap:'wrap'}}><div><h2 style={title}>{heading}</h2><p style={muted}>{subtitle}</p></div><div className="page-header-actions" style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',flex:1,justifyContent:'flex-end',minWidth:280}}>{onSearch&&<div className="page-header-search" style={{position:'relative',flex:1,minWidth:140,maxWidth:320}}><Search size={15} style={{position:'absolute',left:11,top:11,color:'#94A3B8'}}/><input value={search} onChange={event=>onSearch(event.target.value)} placeholder="Buscar..." style={{...input,paddingLeft:34,width:'100%',boxSizing:'border-box'}}/></div>}<div style={{flexShrink:0}}>{action}</div></div></div>}
function DataTable({headers,children,className}:{headers:string[];children:React.ReactNode;className?:string}){return <table className={className} style={{width:'100%',borderCollapse:'collapse',textAlign:'left',fontFamily:'inherit'}}><thead><tr style={{borderBottom:'1px solid #E4E4E7'}}>{headers.map((header,index)=><th key={header} style={{padding:'12px 20px',fontSize:12,fontWeight:600,letterSpacing:'.02em',color:'#64748B',textTransform:'uppercase',textAlign:index===headers.length-1?'right':'left',width:index===headers.length-1?128:undefined}}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table>}
function Td({children,strong=false,dataLabel}:{children:React.ReactNode;strong?:boolean;dataLabel?:string}){return <td data-label={dataLabel} style={{padding:'16px 20px',fontSize:13,color:'#334155',fontWeight:strong?600:400}}>{children}</td>}
function Actions({onEdit,onDelete}:{onEdit:()=>void;onDelete?:()=>void}){return <td data-label="Acciones" style={{padding:'12px 20px',textAlign:'right',width:128,boxSizing:'border-box'}}><div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:10}}><button onClick={onEdit} aria-label="Editar" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:30,height:30,border:0,background:'none',cursor:'pointer',color:'#64748B'}}><Edit2 size={16}/></button>{onDelete&&<button onClick={onDelete} aria-label="Eliminar" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:30,height:30,border:0,background:'none',cursor:'pointer',color:'#EF4444'}}><Trash2 size={16}/></button>}</div></td>}
function Field({label,value,onChange,type='text'}:{label:string;value:string;onChange:(value:string)=>void;type?:string}){return <label style={{display:'grid',gap:7,fontSize:13,fontWeight:600}}>{label}<input type={type} value={value} onChange={event=>onChange(event.target.value)} style={input}/></label>}
function Modal({title:heading,onClose,onSave,children,width='min(100%,480px)'}:{title:string;onClose:()=>void;onSave:()=>void;children:React.ReactNode;width?:string}){return <div style={{position:'fixed',inset:0,zIndex:100,background:'rgba(15,23,42,.45)',display:'grid',placeItems:'center',padding:16,overflowY:'auto'}}><div style={{width,maxWidth:'calc(100vw - 32px)',boxSizing:'border-box',background:'#fff',borderRadius:12,padding:28,boxShadow:'0 20px 50px rgba(15,23,42,.2)'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}><h3 style={{margin:0,color:'#1A4B77'}}>{heading}</h3><button onClick={onClose} style={{border:0,background:'none',cursor:'pointer'}}><X size={20}/></button></div><div style={{display:'grid',gap:16}}>{children}</div><div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:24}}><button onClick={onClose} style={{...primary,background:'#F1F5F9',color:'#475569'}}>Cancelar</button><button onClick={onSave} style={primary}>Guardar</button></div></div></div>}
