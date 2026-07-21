import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, CheckSquare, ChevronDown, Download, Image as ImageIcon, School, Search, Share2, SlidersHorizontal } from 'lucide-react';
import { api, type Media, type School as ApiSchool } from '../../lib/api';
import DashboardLayout from '../layout/DashboardLayout';
import Lightbox from '../ui/Lightbox';

interface Album {
  id: string;
  schoolId: string;
  schoolName: string;
  activity: string;
  date: string;
  shift: string;
  media: Media[];
}

const sorts = ['Más reciente', 'Más antiguo', 'Más fotos'] as const;
const formatBytes = (bytes:number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const formatEventDate = (value:string) => { const [year,month,day]=value.slice(0,10).split('-'); return year&&month&&day?`${day}-${month}-${year}`:value; };
const formatShift = (value:string) => /^turno\s/i.test(value) ? value : `Turno ${value}`;

export default function ParentPortal() {
  const [schools, setSchools] = useState<ApiSchool[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const [search, setSearch] = useState('');
  const [shift, setShift] = useState('Todos');
  const [dateFilter, setDateFilter] = useState('Todos');
  const [sort, setSort] = useState<typeof sorts[number]>('Más reciente');
  const [sortOpen, setSortOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.me().then(({ user }) => {
      if (user.role !== 'PARENT') {
        window.location.href = user.role === 'ADMIN' ? '/admin' : '/coordinator';
        return;
      }
      return Promise.all([api.mySchools(), api.lots()]);
    }).then(async result => {
      if (!result) return;
      const [schoolResult, lotResult] = result;
      setSchools(schoolResult.items);
      setSchoolId(schoolResult.items[0]?.id ?? '');
      const detailed = await Promise.all(lotResult.items.map(async lot => ({
        id: lot.id,
        schoolId: lot.school_id,
        schoolName: lot.school_name,
        activity: lot.activity_name,
        date: lot.event_date,
        shift: lot.shift_name,
        media: (await api.lot(lot.id)).media,
      })));
      setAlbums(detailed);
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'No se pudo cargar la galería.'))
      .finally(() => setLoading(false));
  }, []);

  const shifts = useMemo(() => ['Todos', ...Array.from(new Set(albums.filter(album => album.schoolId === schoolId).map(album => album.shift)))], [albums, schoolId]);
  const uniqueDates = useMemo(() => Array.from(new Set(albums.filter(album => album.schoolId === schoolId).map(album => album.date.slice(0, 10)))).sort(), [albums, schoolId]);
  const filtered = useMemo(() => {
    let result = albums.filter(album => album.schoolId === schoolId);
    if (shift !== 'Todos') result = result.filter(album => album.shift === shift);
    if (dateFilter !== 'Todos') result = result.filter(album => album.date.startsWith(dateFilter));
    const term = search.trim().toLowerCase();
    if (term) result = result.filter(album => `${album.activity} ${album.date}`.toLowerCase().includes(term));
    if (sort === 'Más fotos') result = [...result].sort((a, b) => b.media.length - a.media.length);
    if (sort === 'Más antiguo') result = [...result].sort((a, b) => a.date.localeCompare(b.date));
    if (sort === 'Más reciente') result = [...result].sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [albums, schoolId, shift, search, sort, dateFilter]);

  const tabs = schools.map(school => ({ id: school.id, label: school.name, icon: School }));
  const currentSchool = schools.find(school => school.id === schoolId);

  return <DashboardLayout role="parent" tabs={tabs} activeTab={schoolId} onTabChange={id => { setSchoolId(id); setOpenAlbum(null); setShift('Todos'); setDateFilter('Todos'); }}>
    {openAlbum ? <AlbumView album={openAlbum} onBack={() => setOpenAlbum(null)}/> : <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <h1 style={{ margin: 0, color: '#1A4B77', fontSize: 24 }}>{currentSchool?.name ?? 'Mi colegio'}</h1>
          <div style={{ display: 'flex', gap: 8, flex: '1 1 260px', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', flex: '1 1 auto', maxWidth: 400 }}><Search size={14} style={{ position: 'absolute', left: 11, top: 12, color: '#94A3B8' }}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar álbum..." style={{ width: '100%', height: 38, padding: '0 12px 0 32px', border: '1px solid #E2E8F0', borderRadius: 8, font: 'inherit', fontSize: 13, boxSizing: 'border-box' }}/></div>
            <div style={{ position: 'relative', flexShrink: 0 }}><button onClick={() => setSortOpen(value => !value)} style={filterButton}><SlidersHorizontal size={14}/><span className="hide-on-mobile">{sort}</span><ChevronDown size={13}/></button>{sortOpen && <div style={{ position: 'absolute', top: 42, right: 0, zIndex: 20, width: 165, padding: 6, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 10px 25px rgba(15,23,42,.12)' }}>{sorts.map(option => <button key={option} onClick={() => { setSort(option); setSortOpen(false); }} style={{ width: '100%', padding: '9px 10px', textAlign: 'left', border: 0, borderRadius: 5, background: sort === option ? '#F1F5F9' : '#fff', cursor: 'pointer' }}>{option}</button>)}</div>}</div>
          </div>
        </div>
        {uniqueDates.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 16, overflowX: 'auto', paddingBottom: 6 }}>
            <button onClick={() => setDateFilter('Todos')} style={{ padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 8, background: dateFilter === 'Todos' ? '#1A4B77' : '#fff', color: dateFilter === 'Todos' ? '#fff' : '#475569', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,.05)', transition: 'background .2s' }}>
              <strong style={{ fontSize: 13 }}>Todos los días</strong>
            </button>
            {uniqueDates.map((date, index) => {
              const isSelected = dateFilter === date;
              const [year, month, day] = date.split('-');
              return (
                <button key={date} onClick={() => setDateFilter(date)} style={{ padding: '6px 16px', border: '1px solid #E2E8F0', borderRadius: 8, background: isSelected ? '#1A4B77' : '#fff', color: isSelected ? '#fff' : '#475569', cursor: 'pointer', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,.05)', transition: 'background .2s' }}>
                  <strong style={{ fontSize: 14, marginBottom: 2 }}>Día {index + 1}</strong>
                  <span style={{ fontSize: 11, opacity: isSelected ? 0.9 : 0.7, fontWeight: 500 }}>{day}/{month}</span>
                </button>
              );
            })}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>{shifts.map(item => <button key={item} onClick={() => setShift(item)} style={{ padding: '5px 12px', border: 0, borderRadius: 20, background: shift === item ? '#1A4B77' : '#F1F5F9', color: shift === item ? '#fff' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{item}</button>)}<span style={{ marginLeft: 8, color: '#64748B', fontSize: 13 }}>{filtered.length} {filtered.length === 1 ? 'álbum disponible' : 'álbumes disponibles'}</span></div>
      </header>
      {error && <div style={{ margin: 24, padding: 14, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}>{error}</div>}
      <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {loading ? <Empty text="Cargando galería…"/> : filtered.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 24 }}>{filtered.map(album => <AlbumCard key={album.id} album={album} onClick={() => setOpenAlbum(album)}/>)}</div> : <Empty text="No hay álbumes publicados con estos filtros."/>}
      </main>
    </div>}
  </DashboardLayout>;
}

function AlbumCard({ album, onClick }: { album: Album; onClick: () => void }) {
  return <article onClick={onClick} style={{ display:'flex', flexDirection:'column', minWidth:0, border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', background: '#fff', cursor: 'pointer', boxShadow: '0 2px 6px rgba(15,23,42,.04)', transition:'transform .2s ease, box-shadow .2s ease' }} onMouseEnter={event=>{event.currentTarget.style.transform='translateY(-2px)';event.currentTarget.style.boxShadow='0 10px 24px rgba(15,23,42,.12)';}} onMouseLeave={event=>{event.currentTarget.style.transform='none';event.currentTarget.style.boxShadow='0 2px 6px rgba(15,23,42,.04)';}}>
    <AlbumCover media={album.media}/>
    <div style={{ position:'relative', zIndex:1, flex:'0 0 auto', minHeight:52, padding: '14px 16px', background:'#fff' }}><strong style={{ display: 'block', color: '#0F172A', fontSize: 16, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{album.activity}</strong><span style={{ display:'block', color: '#64748B', fontSize: 13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{formatEventDate(album.date)} · {formatShift(album.shift)} · {formatBytes(album.media.reduce((total,item)=>total+item.size_bytes,0))}</span></div>
  </article>;
}

function AlbumCover({ media }: { media: Media[] }) {
  const count=media.length;
  const layout:React.CSSProperties=count===1
    ? {display:'block'}
    : count===2
      ? {display:'grid',gridTemplateColumns:'1fr 1fr',gap:3}
      : {display:'grid',gridTemplateColumns:'2fr 1fr',gap:3};

  return <div style={{position:'relative',height:200,minHeight:200,overflow:'hidden',background:'#E2E8F0',...layout}}>
    {count===1&&<div style={{...coverCell,width:'100%',height:'100%'}}><Thumb item={media[0]}/></div>}
    {count===2&&<><div style={coverCell}><Thumb item={media[0]}/></div><div style={coverCell}><Thumb item={media[1]}/></div></>}
    {count>=3&&<><div style={coverCell}><Thumb item={media[0]}/></div><div style={{...coverCell,display:'grid',gridTemplateRows:'1fr 1fr',gap:3}}><div style={coverCell}><Thumb item={media[1]}/></div><div style={coverCell}><Thumb item={media[2]}/></div></div></>}
    <span style={{position:'absolute',top:10,right:10,zIndex:2,display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,background:'rgba(0,0,0,.55)',color:'#fff',fontSize:12}}><Camera size={13}/>{count}</span>
  </div>;
}
function Thumb({ item }: { item?: Media }) {
  if (!item) return <div style={{ width: '100%', height: '100%', background: '#F1F5F9' }}/>;
  return item.kind === 'VIDEO' ? <video src={api.contentUrl(item.id)} muted style={mediaStyle}/> : <img src={api.thumbnailUrl(item.id)} alt={item.original_name} style={mediaStyle}/>;
}

function AlbumView({ album, onBack }: { album: Album; onBack: () => void }) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const toggle = (id: string) => setSelected(previous => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const download = async (ids: string[]) => { if (!ids.length) return; const blob = await api.downloadZip(ids); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${album.activity}.zip`; link.click(); URL.revokeObjectURL(url); };
  const share = async (item:Media) => {
    if (sharingId) return;
    try {
      setSharingId(item.id);
      const response=await fetch(api.downloadUrl(item.id),{credentials:'include'});
      if(!response.ok)throw new Error('No se pudo obtener la imagen');
      const blob=await response.blob();
      const file=new File([blob],item.original_name,{type:blob.type||item.mime_type});
      const shareData={files:[file],title:`${album.activity} · Recrear`};
      if(navigator.share&&(!navigator.canShare||navigator.canShare(shareData))){
        await navigator.share(shareData);
        return;
      }
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;
      link.download=item.original_name;
      link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(error) {
      if(!(error instanceof DOMException&&error.name==='AbortError')) console.error(error);
    } finally {
      setSharingId(null);
    }
  };
  return <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
    <header style={{ padding: '14px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><button onClick={onBack} style={filterButton}><ArrowLeft size={16}/>Álbumes</button><div><h1 style={{ margin: 0, color: '#1A4B77', fontSize: 21 }}>{album.activity}</h1><span style={{ color: '#64748B', fontSize: 13 }}>{formatEventDate(album.date)} · {formatShift(album.shift)} · {album.media.length} archivos</span></div></div>
      <div style={{ display: 'flex', gap: 8 }}>{selectionMode ? <><button onClick={() => setSelected(new Set(album.media.map(item => item.id)))} style={filterButton}>Seleccionar todo</button>{selected.size > 0 && <button onClick={() => download([...selected])} style={primaryButton}><Download size={15}/>Descargar ({selected.size})</button>}<button onClick={() => { setSelectionMode(false); setSelected(new Set()); }} style={filterButton}>Cancelar</button></> : <><button onClick={() => setSelectionMode(true)} style={filterButton}><CheckSquare size={15}/>Seleccionar</button><button onClick={() => download(album.media.map(item => item.id))} style={primaryButton}><Download size={15}/>Descargar todo</button></>}</div>
    </header>
    <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>{album.media.map((item, index) => { const active = selected.has(item.id); return <article key={item.id} onClick={() => selectionMode ? toggle(item.id) : item.kind === 'IMAGE' && setLightbox(index)} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', outline: active ? '3px solid #1A4B77' : '3px solid transparent', transform: active ? 'scale(.97)' : 'none' }}><Thumb item={item}/>{selectionMode && <span style={{ position: 'absolute', top: 9, left: 9, width: 23, height: 23, borderRadius: '50%', display: 'grid', placeItems: 'center', background: active ? '#1A4B77' : '#fff', color: '#fff', boxShadow: '0 1px 5px rgba(0,0,0,.3)' }}>{active ? '✓' : ''}</span>}<span style={{position:'absolute',left:9,bottom:9,padding:'3px 6px',borderRadius:5,background:'rgba(15,23,42,.72)',color:'#fff',fontSize:10,fontWeight:600}}>{formatBytes(item.size_bytes)}</span>{!selectionMode&&<><button type="button" disabled={sharingId===item.id} onClick={event=>{event.stopPropagation();share(item);}} title="Compartir" aria-label="Compartir imagen" style={{position:'absolute',right:51,bottom:9,width:34,height:34,border:0,borderRadius:'50%',display:'grid',placeItems:'center',background:'rgba(255,255,255,.92)',color:'#1A4B77',cursor:sharingId===item.id?'wait':'pointer',opacity:sharingId===item.id ? .6 : 1,boxShadow:'0 1px 5px rgba(0,0,0,.18)'}}><Share2 size={16}/></button><a href={api.downloadUrl(item.id)} onClick={event => event.stopPropagation()} title="Descargar" style={{ position: 'absolute', right: 9, bottom: 9, width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.92)', color: '#1A4B77', boxShadow:'0 1px 5px rgba(0,0,0,.18)' }}><Download size={16}/></a></>}</article>; })}</div></main>
    {lightbox !== null && <Lightbox src={api.contentUrl(album.media[lightbox].id)} downloadUrl={api.downloadUrl(album.media[lightbox].id)} downloadName={album.media[lightbox].original_name} info={formatBytes(album.media[lightbox].size_bytes)} onClose={() => setLightbox(null)} onNext={lightbox < album.media.length - 1 ? () => setLightbox(lightbox + 1) : undefined} onPrev={lightbox > 0 ? () => setLightbox(lightbox - 1) : undefined}/>}
  </div>;
}

function Empty({ text }: { text: string }) { return <div style={{ minHeight: 280, display: 'grid', placeItems: 'center', color: '#94A3B8', textAlign: 'center' }}><div><ImageIcon size={48} strokeWidth={1}/><p>{text}</p></div></div>; }
const coverCell: React.CSSProperties = { minWidth:0, minHeight:0, overflow:'hidden' };
const mediaStyle: React.CSSProperties = { width: '100%', height: '100%', minWidth:0, minHeight:0, objectFit: 'cover', display: 'block' };
const filterButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 38, border: 0, borderRadius: 8, background: '#F1F5F9', color: '#475569', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', boxSizing: 'border-box' };
const primaryButton: React.CSSProperties = { ...filterButton, background: '#1A4B77', color: '#fff', fontWeight: 600 };












