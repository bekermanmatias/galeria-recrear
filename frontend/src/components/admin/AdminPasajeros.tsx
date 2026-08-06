import { useEffect, useState } from 'react';
import { Edit2, FileSpreadsheet, QrCode, Search, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react';
import { adminRequest, type Passenger, type PassengerImport, type SessionUser } from '../../lib/api';
import ConfirmDialog from '../ui/ConfirmDialog';
import { AdminStatusSelect } from './ConnectedViews';
import WristbandScannerModal from './WristbandScannerModal';

const input: React.CSSProperties = { width: '100%', height: 39, padding: '0 10px', border: '1px solid #E2E8F0', borderRadius: 7, boxSizing: 'border-box', font: 'inherit' };
const button: React.CSSProperties = { height: 36, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 12px', border: '1px solid #DCE3EB', borderRadius: 7, background: '#fff', color: '#1A4B77', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const td: React.CSSProperties = { padding: '14px', fontSize: 13, verticalAlign: 'middle' };
const emptyForm = { externalNumber:'', fullName:'', documentType:'DNI', documentNumber:'', birthDate:'', documentExpiresAt:'', country:'', passengerStatus:'', bonus:'', phone:'', mobile:'', email:'' };
type Form = typeof emptyForm;
type Preview = { valid:boolean; totalRows:number; validRows:number; errors:{row:number;field:string;message:string}[]; summary:{create:number;update:number;rejected:number}; sample:Form[] };
type FilterOptions = { schools:{id:string;name:string;code:string}[]; departures:{id:string;name:string;code?:string|null}[] };

const toForm = (item?: Passenger): Form => item ? {
  externalNumber:item.external_number ?? '', fullName:item.full_name, documentType:item.document_type,
  documentNumber:item.document_number, birthDate:item.birth_date?.slice(0,10) ?? '',
  documentExpiresAt:item.document_expires_at?.slice(0,10) ?? '', country:item.country ?? '',
  passengerStatus:item.passenger_status ?? '', bonus:item.bonus ?? '', phone:item.phone ?? '',
  mobile:item.mobile ?? '', email:item.email ?? ''
} : emptyForm;
const asBody = (form:Form) => Object.fromEntries(Object.entries(form).map(([key,value]) => [key, value.trim() || null]));
const date = (value?:string|null) => value ? value.slice(0,10).split('-').reverse().join('/') : '-';

function AssociationChips({items,empty}:{items:Passenger['schools'];empty:string}) {
  return <div style={{display:'flex',flexWrap:'wrap',gap:5}}>{items?.length ? items.map(item => <span key={item.id} title={`${item.name}${item.code ? ` (${item.code})` : ''}`} style={{display:'inline-flex',padding:'3px 7px',borderRadius:5,background:'#F1F5F9',border:'1px solid #E2E8F0',color:'#475569',fontSize:11,fontWeight:600,wordBreak:'break-word'}}>{item.name}{item.code ? ` - ${item.code}` : ''}</span>) : <span style={{fontSize:12,color:'#94A3B8'}}>{empty}</span>}</div>;
}

export default function AdminPasajeros({ user }: { user?: SessionUser }) {
  const canManage = user?.isAdmin || user?.role === 'ADMIN' || !!(user?.permissions as any)?.passengers?.update;
  const [items,setItems] = useState<Passenger[]>([]);
  const [history,setHistory] = useState<PassengerImport[]>([]);
  const [search,setSearch] = useState('');
  const [filterOpen,setFilterOpen] = useState(false);
  const [schoolId,setSchoolId] = useState('');
  const [departureId,setDepartureId] = useState('');
  const [activeFilter,setActiveFilter] = useState('');
  const [updatedFrom,setUpdatedFrom] = useState('');
  const [updatedTo,setUpdatedTo] = useState('');
  const [filterOptions,setFilterOptions] = useState<FilterOptions>({schools:[],departures:[]});
  const [editing,setEditing] = useState<Passenger|null>(null);
  const [viewing,setViewing] = useState<Passenger|null>(null);
  const [form,setForm] = useState<Form>(emptyForm);
  const [importOpen,setImportOpen] = useState(false);
  const [file,setFile] = useState<File|null>(null);
  const [preview,setPreview] = useState<Preview|null>(null);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [deleteTarget,setDeleteTarget] = useState<Passenger|null>(null);
  const [wristbandTarget,setWristbandTarget] = useState<Passenger|null>(null);
  const [statusChange,setStatusChange] = useState<{item:Passenger;next:boolean}|null>(null);
  const [statusBusy,setStatusBusy] = useState(false);
  const [associationBusy,setAssociationBusy] = useState(false);
  const [canImport, setCanImport] = useState(true);
  const openView = (item:Passenger) => { setViewing(item); };

  const loadHistory = async () => {
    try {
      const imports = await adminRequest<{items:PassengerImport[]}>('/passengers/imports');
      setHistory(imports.items);
      setCanImport(true);
    } catch (error: any) {
      if (error?.status === 403) setCanImport(false);
      setHistory([]);
    }
  };
  const load = async () => {
    const params = new URLSearchParams({pageSize:'100'});
    if (search.trim()) params.set('q',search.trim());
    if (schoolId) params.set('schoolId',schoolId);
    if (departureId) params.set('departureId',departureId);
    if (activeFilter) params.set('active',activeFilter);
    if (updatedFrom) params.set('updatedFrom',updatedFrom);
    if (updatedTo) params.set('updatedTo',updatedTo);
    const passengers = await adminRequest<{items:Passenger[];filters:FilterOptions}>(`/passengers?${params}`);
    setItems(passengers.items);
    setFilterOptions(passengers.filters);
  };
  useEffect(() => { void loadHistory(); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(),180); return () => window.clearTimeout(timer); }, [search,schoolId,departureId,activeFilter,updatedFrom,updatedTo]);

  const clearFilters = () => { setSchoolId(''); setDepartureId(''); setActiveFilter(''); setUpdatedFrom(''); setUpdatedTo(''); };
  const activeFilters = [
    schoolId && filterOptions.schools.find(item => item.id === schoolId)?.name,
    departureId && filterOptions.departures.find(item => item.id === departureId)?.name,
    activeFilter && (activeFilter === 'true' ? 'Activos' : 'Inactivos'),
    updatedFrom && `Desde ${date(updatedFrom)}`,
    updatedTo && `Hasta ${date(updatedTo)}`
  ].filter(Boolean) as string[];

  const save = async () => {
    if (!editing) return;
    setBusy(true); setError('');
    try { await adminRequest(`/passengers/${editing.id}`,{method:'PATCH',body:JSON.stringify(asBody(form))}); setEditing(null); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  };
  const previewImport = async () => {
    if (!file) return;
    setBusy(true); setError(''); setMessage('');
    try { const body = new FormData(); body.append('file',file); setPreview(await adminRequest<Preview>('/passengers/import/preview',{method:'POST',body})); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo validar el archivo.'); setPreview(null); }
    finally { setBusy(false); }
  };
  const commitImport = async () => {
    if (!file || !preview?.valid) return;
    setBusy(true); setError('');
    try {
      const body = new FormData(); body.append('file',file);
      const result = await adminRequest<{created:number;updated:number}>('/passengers/import/commit',{method:'POST',body});
      setMessage(`Importación completada: ${result.created} creados y ${result.updated} actualizados.`);
      setFile(null); setPreview(null); await Promise.all([load(),loadHistory()]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo importar el archivo.'); }
    finally { setBusy(false); }
  };
  const updateStatus = async (item:Passenger,next:boolean) => {
    const previous = item.active;
    setItems(current => current.map(value => value.id === item.id ? {...value,active:next} : value));
    setStatusBusy(true); setError('');
    try { await adminRequest(`/passengers/${item.id}`,{method:'PATCH',body:JSON.stringify({active:next})}); setMessage(next ? 'Pasajero reactivado.' : 'Pasajero desactivado.'); }
    catch (caught) { setItems(current => current.map(value => value.id === item.id ? {...value,active:previous} : value)); setError(caught instanceof Error ? caught.message : 'No se pudo actualizar el estado.'); }
    finally { setStatusBusy(false); }
  };

  const assignSchool = async (passenger:Passenger, nextSchoolId:string) => {
    if (!nextSchoolId) return;
    setAssociationBusy(true); setError('');
    try {
      await adminRequest(`/passengers/${passenger.id}/schools/${nextSchoolId}`,{method:'POST'});
      const school = filterOptions.schools.find(item => item.id === nextSchoolId);
      if (school) {
        const association = {id:school.id,name:school.name,code:school.code};
        setItems(current => current.map(item => item.id === passenger.id ? {...item,schools:[...(item.schools ?? []),association]} : item));
        setEditing(current => current?.id === passenger.id ? {...current,schools:[...(current.schools ?? []),association]} : current);
      }
      setMessage('Pasajero asociado al colegio.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo asociar el pasajero al colegio.'); }
    finally { setAssociationBusy(false); }
  };
  return <div style={{flex:1,padding:32,overflowY:'auto'}}>
    <header className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:16}}>
      <div><h2 style={{margin:'0 0 5px',fontSize:24,color:'#1A4B77'}}>Pasajeros</h2><p style={{margin:0,color:'#64748B',fontSize:14}}>Padrón interno de pasajeros para futuras asignaciones a colegios y salidas.</p></div>
      <div className="page-header-actions" style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <div className="page-header-search" style={{position:'relative'}}><Search size={16} style={{position:'absolute',left:11,top:11,color:'#94A3B8'}}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar nombre, documento, colegio o salida..." style={{...input,width:300,paddingLeft:34}}/></div>
        <div className="passengers-action-bar">
          <button className="page-header-btn passengers-action-btn" onClick={()=>setFilterOpen(value=>!value)} style={{...button,background:filterOpen?'#EEF4F8':'#fff',position:'relative'}}>
            <SlidersHorizontal size={16}/>Filtros
            {activeFilters.length > 0 && <span style={{position:'absolute',top:-5,right:-5,width:18,height:18,borderRadius:'50%',background:'#1A4B77',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>{activeFilters.length}</span>}
          </button>
          {canManage && canImport && <button className="page-header-btn passengers-action-btn" onClick={()=>{setImportOpen(true);setPreview(null);setFile(null);setError('');setMessage('');}} style={button}><Upload size={16}/>Importar Excel</button>}
        </div>
      </div>
    </header>
    {filterOpen && <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10,padding:14,marginBottom:12,border:'1px solid #E2E8F0',borderRadius:8,background:'#F8FAFC'}}>
      <Filter label="Colegio"><select value={schoolId} onChange={event=>setSchoolId(event.target.value)} style={input}><option value="">Todos los colegios</option>{filterOptions.schools.map(item=><option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></Filter>
      <Filter label="Salida"><select value={departureId} onChange={event=>setDepartureId(event.target.value)} style={input}><option value="">Todas las salidas</option>{filterOptions.departures.map(item=><option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ''}</option>)}</select></Filter>
      <Filter label="Estado"><select value={activeFilter} onChange={event=>setActiveFilter(event.target.value)} style={input}><option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option></select></Filter>
      <Filter label="Actualizado desde"><input type="date" value={updatedFrom} onChange={event=>setUpdatedFrom(event.target.value)} style={input}/></Filter>
      <Filter label="Actualizado hasta"><input type="date" value={updatedTo} onChange={event=>setUpdatedTo(event.target.value)} style={input}/></Filter>
    </section>}
    {!!activeFilters.length && <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:14}}>{activeFilters.map(value=><span key={value} style={{padding:'4px 8px',borderRadius:5,background:'#EEF4F8',color:'#1A4B77',fontSize:12,fontWeight:600}}>{value}</span>)}<button onClick={clearFilters} style={{border:0,background:'none',color:'#1A4B77',fontSize:12,fontWeight:600,cursor:'pointer'}}>Limpiar filtros</button></div>}
    {message && <Notice tone="success">{message}</Notice>}
    {error && !importOpen && <Notice tone="error">{error}</Notice>}
    <style dangerouslySetInnerHTML={{__html: `
      @media (max-width: 768px) {
        .page-header { flex-direction: column !important; align-items: flex-start !important; }
        .page-header-actions { width: 100% !important; flex-wrap: wrap !important; }
        .page-header-search { width: 100% !important; order: 2; }
        .page-header-search input { width: 100% !important; }
        .passengers-action-bar { order: 1; width: 100%; display: flex; gap: 8px; }
        .passengers-action-btn { flex: 1; justify-content: center; height: 40px; border-radius: 10px !important; font-size: 13px !important; }
        .passengers-table-wrap { display: none; }
        .passengers-mobile { display: block !important; }
      }
      @media (min-width: 769px) {
        .passengers-mobile { display: none !important; }
        .passengers-action-bar { display: contents; }
      }
    `}} />
    {/* Desktop table */}
    <div className="passengers-table-wrap" style={{overflowX:'auto'}}><table className="passengers-table" style={{width:'100%',minWidth:1420,borderCollapse:'collapse'}}><thead><tr style={{borderBottom:'1px solid #E2E8F0'}}>{['Pasajero','Documento','Contacto','Colegio','Salida','Pulsera','Estado','Actualización','Acciones'].map(value=><th key={value} style={{padding:'12px 14px',textAlign:'left',fontSize:12,color:'#64748B',textTransform:'uppercase'}}>{value}</th>)}</tr></thead><tbody>
      {items.map(item=><tr key={item.id} style={{borderBottom:'1px solid #EAF0F5',opacity:item.active?1:.58}}><td data-label="Pasajero" style={td}><strong style={{color:'#1A4B77'}}>{item.full_name}</strong>{item.external_number&&<div style={{fontSize:12,color:'#64748B'}}>Nro. {item.external_number}</div>}</td><td data-label="Documento" style={td}>{item.document_type} {item.document_number}</td><td data-label="Contacto" style={td}><div>{item.email||'-'}</div><small style={{color:'#64748B'}}>{item.mobile||item.phone||''}</small></td><td data-label="Colegio" style={td}><AssociationChips items={item.schools} empty="Sin colegio"/></td><td data-label="Salida" style={td}><AssociationChips items={item.departures} empty="Sin salida"/></td><td data-label="Pulsera" style={td}>{item.wristband_code ? <span style={{padding:'3px 6px',borderRadius:4,background:'#DCFCE7',color:'#166534',fontSize:12,fontWeight:600,fontFamily:'monospace'}}>{item.wristband_code}</span> : <span style={{color:'#94A3B8'}}>-</span>}</td><td data-label="Estado" style={td}><AdminStatusSelect active={item.active} onChange={next=>{if(!next)setStatusChange({item,next});else void updateStatus(item,next);}}/></td><td data-label="Actualización" style={td}>{date(item.updated_at)}</td><td data-label="Acciones" style={td}>{canManage && <button onClick={()=>{setEditing(item);setForm(toForm(item));setError('');}} title="Editar pasajero" aria-label="Editar pasajero" style={iconButton}><Edit2 size={16}/></button>}<button onClick={()=>setWristbandTarget(item)} title={item.wristband_code?'Ver o cambiar pulsera':'Vincular pulsera'} aria-label="Vincular pulsera" style={{...iconButton,color:item.wristband_code?'#15803D':'#1A4B77'}}><QrCode size={16}/></button>{canManage && <button onClick={()=>setDeleteTarget(item)} title="Eliminar pasajero definitivamente" aria-label="Eliminar pasajero definitivamente" style={{...iconButton,color:'#DC2626'}}><Trash2 size={16}/></button>}</td></tr>)}
      {!items.length && <tr><td colSpan={9} style={{padding:36,textAlign:'center',color:'#94A3B8'}}>No se encontraron pasajeros.</td></tr>}
    </tbody></table></div>
    {/* Mobile simple table */}
    <div className="passengers-mobile">
      <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
        <thead><tr style={{borderBottom:'1px solid #E2E8F0'}}>
          <th style={{padding:'10px 12px',textAlign:'left',fontSize:11,color:'#64748B',textTransform:'uppercase',fontWeight:600}}>Pasajero</th>
          <th style={{padding:'10px 12px',textAlign:'left',fontSize:11,color:'#64748B',textTransform:'uppercase',fontWeight:600}}>DNI</th>
          <th style={{padding:'10px 12px',width:36}}></th>
        </tr></thead>
        <tbody>
          {items.map(item=><tr key={item.id} onClick={()=>openView(item)} style={{borderBottom:'1px solid #F1F5F9',cursor:'pointer',opacity:item.active?1:.6}}>
            <td style={{padding:'12px 12px',fontSize:13,color:'#1A4B77',fontWeight:600,lineHeight:1.4,overflowWrap:'break-word',wordWrap:'break-word'}}>{item.full_name}{item.external_number&&<div style={{fontSize:11,color:'#94A3B8',fontWeight:400}}>Nro. {item.external_number}</div>}</td>
            <td style={{padding:'12px 12px',fontSize:13,color:'#475569',overflowWrap:'break-word',wordWrap:'break-word'}}>{item.document_type} {item.document_number}</td>
            <td style={{padding:'8px 8px',textAlign:'right'}} onClick={e=>e.stopPropagation()}>
              <button onClick={()=>setWristbandTarget(item)} title="Pulsera" style={{...iconButton,color:item.wristband_code?'#15803D':'#94A3B8',width:32,height:32}}><QrCode size={15}/></button>
            </td>
          </tr>)}
          {!items.length && <tr><td colSpan={3} style={{padding:36,textAlign:'center',color:'#94A3B8',fontSize:14}}>No se encontraron pasajeros.</td></tr>}
        </tbody>
      </table>
    </div>
    {!!history.length && <section style={{marginTop:32}}><h3 style={{fontSize:16,color:'#1A4B77',margin:'0 0 12px'}}>Últimas importaciones</h3><div style={{display:'grid',gap:8}}>{history.slice(0,5).map(item=><div key={item.id} style={{display:'flex',justifyContent:'space-between',gap:12,padding:'10px 12px',border:'1px solid #E2E8F0',borderRadius:8,fontSize:13}}><span><FileSpreadsheet size={15} style={{verticalAlign:'-3px',marginRight:7,color:'#1A4B77'}}/>{item.file_name}</span><span style={{color:'#64748B'}}>{item.created_rows} nuevos · {item.updated_rows} actualizados · {date(item.created_at)} · {item.imported_by_name}</span></div>)}</div></section>}
    {editing && <Modal title="Editar pasajero" onClose={()=>setEditing(null)}><PassengerFields form={form} setForm={setForm} passenger={editing} schools={filterOptions.schools} onAssignSchool={school=>void assignSchool(editing,school)} associationBusy={associationBusy}/>{error&&<p style={{color:'#B91C1C',fontSize:13}}>{error}</p>}<Actions onCancel={()=>setEditing(null)} onSave={save} busy={busy}/></Modal>}
    {viewing && <PassengerViewModal canManage={canManage} passenger={viewing} onClose={()=>setViewing(null)} onEdit={()=>{setEditing(viewing);setForm(toForm(viewing));setError('');setViewing(null);}} onWristband={()=>{setWristbandTarget(viewing);setViewing(null);}}/>}
    {importOpen && <Modal title="Importar pasajeros desde Excel" onClose={()=>setImportOpen(false)}><p style={{margin:'0 0 18px',fontSize:13,color:'#64748B',lineHeight:1.55}}>Subí un archivo XLSX o XLS con el formato AV26000. Antes de importar validaremos filas, documentos y datos obligatorios; importes, pagos y deudas no se incorporan.</p><label style={{minHeight:150,border:`1.5px dashed ${file?'#1A4B77':'#CBD5E1'}`,borderRadius:10,background:file?'#F8FBFD':'#F8FAFC',display:'grid',placeItems:'center',padding:18,cursor:'pointer',textAlign:'center'}}><input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={event=>{setFile(event.target.files?.[0]??null);setPreview(null);setError('');}} style={{display:'none'}}/>{file?<div><FileSpreadsheet size={30} color="#1A4B77"/><strong style={{display:'block',marginTop:8,fontSize:14,color:'#1A4B77'}}>{file.name}</strong><span style={{fontSize:12,color:'#64748B'}}>{Math.max(1,Math.round(file.size/1024))} KB · Hacé clic para reemplazarlo</span></div>:<div><Upload size={30} color="#1A4B77"/><strong style={{display:'block',marginTop:8,fontSize:14,color:'#1A4B77'}}>Seleccioná el archivo de pasajeros</strong><span style={{fontSize:12,color:'#64748B'}}>XLSX o XLS · hasta 12 MB</span></div>}</label>{file&&<button type="button" onClick={()=>{setFile(null);setPreview(null);setError('')}} style={{marginTop:8,border:0,background:'none',color:'#1A4B77',fontSize:12,fontWeight:600,cursor:'pointer'}}>Quitar archivo</button>}{error&&<p style={{color:'#B91C1C',fontSize:13}}>{error}</p>}{preview&&<ImportPreview preview={preview}/>}<Actions onCancel={()=>setImportOpen(false)} onSave={preview?.valid?commitImport:previewImport} busy={busy} disabled={!file}/></Modal>}
    <ConfirmDialog open={statusChange!==null} title="¿Pasar pasajero a Inactivo?" description="Se desactivará globalmente y conservará todos sus datos y asociaciones históricas. Podrás reactivarlo desde este mismo selector." confirmLabel="Continuar" tone="danger" busy={statusBusy} onCancel={()=>!statusBusy&&setStatusChange(null)} onConfirm={async()=>{if(!statusChange)return;const change=statusChange;setStatusChange(null);await updateStatus(change.item,change.next);}}/>
    <ConfirmDialog open={deleteTarget!==null} title="¿Eliminar pasajero definitivamente?" description={`Se eliminará de forma permanente a ${deleteTarget?.full_name??'este pasajero'}, junto con sus asociaciones. Esta acción no se puede deshacer y no afecta el historial de importaciones.`} confirmLabel="Eliminar definitivamente" tone="danger" busy={busy} onCancel={()=>!busy&&setDeleteTarget(null)} onConfirm={async()=>{if(!deleteTarget)return;setBusy(true);setError('');try{await adminRequest(`/passengers/${deleteTarget.id}`,{method:'DELETE'});setItems(current=>current.filter(item=>item.id!==deleteTarget.id));setDeleteTarget(null);setMessage('Pasajero eliminado definitivamente.');}catch(caught){setError(caught instanceof Error?caught.message:'No se pudo eliminar el pasajero.');}finally{setBusy(false);}}}/>
    {wristbandTarget&&<WristbandScannerModal passenger={wristbandTarget} onClose={()=>setWristbandTarget(null)} onLinked={code=>{setItems(current=>current.map(p=>p.id===wristbandTarget.id?{...p,wristband_code:code}:p));setWristbandTarget(null);}} onUnlinked={()=>{setItems(current=>current.map(p=>p.id===wristbandTarget.id?{...p,wristband_code:null}:p));setWristbandTarget(null);}}/>}
  </div>;
}

function PassengerFields({form,setForm,passenger,schools,onAssignSchool,associationBusy}:{form:Form;setForm:(value:Form)=>void;passenger:Passenger;schools:{id:string;name:string;code:string}[];onAssignSchool:(schoolId:string)=>void;associationBusy:boolean}) {
  const [schoolId,setSchoolId] = useState('');
  const set = (key:keyof Form,value:string) => setForm({...form,[key]:value});
  const field = (label:string,key:keyof Form,type='text') => <Field label={label}><input type={type} value={form[key]} onChange={event=>set(key,event.target.value)} style={input}/></Field>;
  const availableSchools = schools.filter(school => !passenger.schools?.some(item => item.id === school.id));
  return <><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13}}>{field('Nombre y apellido','fullName')}{field('Nro. externo','externalNumber')}{field('Tipo de documento','documentType')}{field('Número de documento','documentNumber')}{field('Fecha de nacimiento','birthDate','date')}{field('Vencimiento documento','documentExpiresAt','date')}{field('País','country')}{field('Estado','passengerStatus')}{field('Bonificación','bonus')}{field('Teléfono','phone')}{field('Celular','mobile')}{field('Correo electrónico','email')}</div><section style={{marginTop:18,paddingTop:16,borderTop:'1px solid #E2E8F0'}}><p style={{margin:'0 0 10px',fontSize:13,fontWeight:650,color:'#334155'}}>Asignaciones vigentes</p><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13}}><Field label="Colegios"><AssociationChips items={passenger.schools} empty="Sin colegio asignado"/><div style={{display:'flex',gap:7,marginTop:8}}><select value={schoolId} disabled={associationBusy || !availableSchools.length} onChange={event=>setSchoolId(event.target.value)} style={{...input,minWidth:0,flex:1}}><option value="">{availableSchools.length ? 'Asignar a un colegio...' : 'Sin colegios disponibles'}</option>{availableSchools.map(school=><option key={school.id} value={school.id}>{school.name} ({school.code})</option>)}</select><button type="button" disabled={!schoolId || associationBusy} onClick={()=>{onAssignSchool(schoolId);setSchoolId('');}} style={{...button,opacity:!schoolId||associationBusy?.6:1}}>Asignar</button></div></Field><Field label="Salidas"><AssociationChips items={passenger.departures} empty="Sin salida asignada"/><p style={{margin:'10px 0 0',fontSize:12,color:'#64748B'}}>Las salidas se confirman desde el padrón de cada salida.</p></Field></div></section></>;
}function ImportPreview({preview}:{preview:Preview}) { return <div style={{marginTop:18,padding:14,border:`1px solid ${preview.valid?'#BBF7D0':'#FECACA'}`,background:preview.valid?'#F0FDF4':'#FEF2F2',borderRadius:8}}><strong style={{color:preview.valid?'#15803D':'#B91C1C'}}>{preview.valid?'Archivo listo para importar':'Hay datos que requieren corrección'}</strong><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,margin:'12px 0'}}><Metric value={preview.validRows} label="filas válidas" color="#1A4B77"/><Metric value={preview.summary.create} label="nuevos" color="#15803D"/><Metric value={preview.summary.update} label="a actualizar" color="#B45309"/></div>{preview.errors.length>0&&<div style={{borderTop:'1px solid #FECACA',paddingTop:10}}>{preview.errors.slice(0,6).map((item,index)=><div key={index} style={{fontSize:12,color:'#B91C1C'}}>Fila {item.row}: {item.field} — {item.message}</div>)}{preview.errors.length>6&&<div style={{fontSize:12,color:'#B91C1C',marginTop:4}}>y {preview.errors.length-6} errores más.</div>}</div>}</div>; }
function Metric({value,label,color}:{value:number;label:string;color:string}) { return <span style={{fontSize:12,color:'#475569'}}><b style={{display:'block',fontSize:17,color}}>{value}</b>{label}</span>; }
function Filter({label,children}:{label:string;children:React.ReactNode}) { return <label style={{display:'grid',gap:5,fontSize:12,fontWeight:600,color:'#475569'}}>{label}{children}</label>; }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label style={{display:'grid',gap:7,fontSize:13,fontWeight:650,color:'#334155'}}>{label}{children}</label>; }
function Notice({tone,children}:{tone:'success'|'error';children:React.ReactNode}) { const success=tone==='success'; return <div style={{padding:'11px 13px',borderRadius:8,background:success?'#F0FDF4':'#FEF2F2',border:`1px solid ${success?'#BBF7D0':'#FECACA'}`,color:success?'#15803D':'#B91C1C',fontSize:13,marginBottom:16}}>{children}</div>; }
function Actions({onCancel,onSave,busy,disabled}:{onCancel:()=>void;onSave:()=>void;busy:boolean;disabled?:boolean}) { return <div style={{display:'flex',justifyContent:'flex-end',gap:9,marginTop:24}}><button onClick={onCancel} style={button}>Cancelar</button><button disabled={busy||disabled} onClick={onSave} style={{...button,background:'#1A4B77',borderColor:'#1A4B77',color:'#fff',opacity:busy||disabled?.6:1}}>{busy?'Procesando...':'Continuar'}</button></div>; }
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) { return <div style={{position:'fixed',inset:0,zIndex:100,display:'grid',placeItems:'center',padding:18,background:'rgba(15,23,42,.48)'}}><div style={{width:'min(100%,700px)',maxHeight:'90vh',overflowY:'auto',borderRadius:12,background:'#fff',padding:26,boxShadow:'0 22px 60px rgba(0,0,0,.3)'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:15,marginBottom:22}}><h3 style={{margin:0,color:'#1A4B77',fontSize:21}}>{title}</h3><button onClick={onClose} style={{border:0,background:'none',color:'#64748B',cursor:'pointer'}}><X size={20}/></button></div>{children}</div></div>; }
const iconButton: React.CSSProperties = {display:'inline-flex',alignItems:'center',justifyContent:'center',width:30,height:30,border:0,background:'none',cursor:'pointer',color:'#1A4B77'};

function PassengerViewModal({passenger,canManage,onClose,onEdit,onWristband}:{passenger:Passenger;canManage:boolean;onClose:()=>void;onEdit:()=>void;onWristband:()=>void}) {
  const row = (label:string,value:string|null|undefined) => value ? <div style={{display:'flex',flexDirection:'column',gap:3,padding:'10px 0',borderBottom:'1px solid #F1F5F9'}}><span style={{fontSize:11,fontWeight:600,color:'#94A3B8',textTransform:'uppercase'}}>{label}</span><span style={{fontSize:14,color:'#1E293B'}}>{value}</span></div> : null;
  return (
    <div style={{position:'fixed',inset:0,zIndex:100,display:'flex',alignItems:'flex-end',background:'rgba(15,23,42,.5)'}} onClick={onClose}>
      <div style={{width:'100%',maxHeight:'90vh',overflowY:'auto',borderRadius:'16px 16px 0 0',background:'#fff',padding:'0 0 24px'}} onClick={e=>e.stopPropagation()}>
        {/* Handle bar */}
        <div style={{display:'flex',justifyContent:'center',padding:'12px 0 4px'}}><div style={{width:40,height:4,borderRadius:2,background:'#CBD5E1'}}/></div>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px 14px',borderBottom:'1px solid #F1F5F9'}}>
          <div>
            <div style={{fontWeight:700,fontSize:16,color:'#1A4B77'}}>{passenger.full_name}</div>
            {passenger.external_number && <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>Nro. {passenger.external_number}</div>}
          </div>
          <button onClick={onClose} style={{border:0,background:'none',color:'#94A3B8',cursor:'pointer',padding:4}}><X size={20}/></button>
        </div>
        {/* Data */}
        <div style={{padding:'0 20px'}}>
          {row('Documento',`${passenger.document_type} ${passenger.document_number}`)}
          {row('Fecha de nacimiento', passenger.birth_date ? passenger.birth_date.slice(0,10).split('-').reverse().join('/') : null)}
          {row('País', passenger.country)}
          {row('Estado pasajero', passenger.passenger_status)}
          {row('Teléfono', passenger.phone)}
          {row('Celular', passenger.mobile)}
          {row('Correo electrónico', passenger.email)}
          {row('Vencimiento documento', passenger.document_expires_at ? passenger.document_expires_at.slice(0,10).split('-').reverse().join('/') : null)}
          {/* Pulsera */}
          <div style={{display:'flex',flexDirection:'column',gap:3,padding:'10px 0',borderBottom:'1px solid #F1F5F9'}}>
            <span style={{fontSize:11,fontWeight:600,color:'#94A3B8',textTransform:'uppercase'}}>Pulsera</span>
            {passenger.wristband_code
              ? <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:12,background:'#DCFCE7',color:'#15803D',fontSize:13,fontWeight:700,width:'fit-content'}}><QrCode size={14}/>{passenger.wristband_code}</span>
              : <span style={{fontSize:13,color:'#94A3B8'}}>Sin pulsera asignada</span>}
          </div>
          {/* Colegios */}
          {passenger.schools?.length ? <div style={{display:'flex',flexDirection:'column',gap:3,padding:'10px 0',borderBottom:'1px solid #F1F5F9'}}><span style={{fontSize:11,fontWeight:600,color:'#94A3B8',textTransform:'uppercase'}}>Colegios</span><AssociationChips items={passenger.schools} empty="Sin colegio"/></div> : null}
          {/* Salidas */}
          {passenger.departures?.length ? <div style={{display:'flex',flexDirection:'column',gap:3,padding:'10px 0',borderBottom:'1px solid #F1F5F9'}}><span style={{fontSize:11,fontWeight:600,color:'#94A3B8',textTransform:'uppercase'}}>Salidas</span><AssociationChips items={passenger.departures} empty="Sin salida"/></div> : null}
        </div>
        {/* Action buttons */}
        <div style={{display:'flex',gap:10,padding:'20px 20px 0'}}>
          <button onClick={onWristband} style={{flex:1,height:42,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,border:'1px solid #DCE3EB',borderRadius:8,background:'#fff',color:'#1A4B77',fontSize:14,fontWeight:600,cursor:'pointer'}}><QrCode size={16}/>{passenger.wristband_code ? 'Ver pulsera' : 'Asignar pulsera'}</button>
          {canManage && <button onClick={onEdit} style={{flex:1,height:42,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,border:'none',borderRadius:8,background:'#1A4B77',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer'}}><Edit2 size={16}/>Editar</button>}
        </div>
      </div>
    </div>
  );
}