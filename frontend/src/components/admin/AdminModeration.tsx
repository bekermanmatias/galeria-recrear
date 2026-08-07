import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Check, Trash2, RotateCcw, Search, Eye } from 'lucide-react';
import { api, type LotSummary, type Media } from '../../lib/api';
import Lightbox from '../ui/Lightbox';
import ConfirmDialog from '../ui/ConfirmDialog';

const formatBytes = (bytes:number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const formatEventDate = (value:string) => { const date=value.slice(0,10); const [year,month,day]=date.split('-'); return year&&month&&day?`${day}-${month}-${year}`:value; };
const departureLabel = (lot: LotSummary) => {
  const name = lot.departure_name ?? lot.school_name ?? 'Salida';
  const type = lot.departure_type === 'AEREO' ? 'Aéreo' : lot.departure_type === 'MICRO' ? 'Micro' : '';
  if (type && !name.toLowerCase().startsWith(type.toLowerCase())) return `${type} - ${name}`;
  return name;
};

export default function AdminModeration() {
  const [lots,setLots]=useState<LotSummary[]>([]); const [selected,setSelected]=useState<LotSummary|null>(null); const [media,setMedia]=useState<Media[]>([]); const [search,setSearch]=useState(''); const [sort,setSort]=useState<'oldest'|'newest'|'fewer'|'departure'|'photos'>('oldest'); const [sortOpen,setSortOpen]=useState(false); const [selectedPhoto,setSelectedPhoto]=useState<number|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [rejectConfirm,setRejectConfirm]=useState(false);
  const loadLots=async()=>{const result=await api.lots('PENDING');setLots(result.items);setSelected(current=>result.items.find(item=>item.id===current?.id)??null);};
  useEffect(()=>{loadLots().catch(reason=>setError(reason.message));},[]);
  useEffect(()=>{if(!selected){setMedia([]);return;}api.lot(selected.id).then(result=>setMedia(result.media)).catch(reason=>setError(reason.message));},[selected?.id]);
  const visible=useMemo(()=>lots.filter(item=>(departureLabel(item)+' '+item.activity_name).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>{const aQueue=new Date(a.submitted_at??a.version_created_at??a.event_date).getTime();const bQueue=new Date(b.submitted_at??b.version_created_at??b.event_date).getTime();if(sort==='newest')return bQueue-aQueue;if(sort==='fewer')return Number(a.approved_count)-Number(b.approved_count);if(sort==='departure')return departureLabel(a).localeCompare(departureLabel(b),'es');if(sort==='photos')return Number(b.approved_count)-Number(a.approved_count);return aQueue-bQueue;}),[lots,search,sort]);
  const rejected=media.filter(item=>item.status==='REJECTED').length; const hasPublishable=media.some(item=>item.status==='READY');
  const toggle=async(item:Media)=>{setBusy(true);setError('');try{await api.moderateMedia(item.id,item.status==='REJECTED'?'restore':'reject');const result=await api.lot(selected!.id);setMedia(result.media);}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo actualizar la foto.');}finally{setBusy(false);}};
  const approve=async()=>{if(!selected)return;setBusy(true);setError('');try{await api.approveLot(selected.id);await loadLots();}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo publicar el lote.');}finally{setBusy(false);}};
  const rejectAll=async()=>{if(!selected)return;setBusy(true);setError('');try{await api.rejectLot(selected.id);await loadLots();}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo descartar el lote.');}finally{setBusy(false);setRejectConfirm(false);}};
  const mediaGrid = useMemo(() => (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:16}}>
      {media.map((item,index)=>{
        const isRejected=item.status==='REJECTED';
        return <article key={item.id} className="media-article" style={{opacity:(isRejected ? .4 : 1)}}>
          {item.kind==='VIDEO'?<video src={api.contentUrl(item.id)} preload="none" muted style={{width:'100%',height:'100%',objectFit:'cover'}}/>:item.mime_type.includes('heic')?<div style={{height:'100%',display:'grid',placeItems:'center',color:'#64748B',fontWeight:700}}>HEIC</div>:<img src={api.thumbnailUrl(item.id)} loading="lazy" alt={item.original_name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
          {isRejected&&<div style={{position:'absolute',inset:0,display:'grid',placeItems:'center'}}><div style={{width:48,height:48,borderRadius:'50%',background:'rgba(0,0,0,.35)',display:'grid',placeItems:'center',color:'#fff'}}><Trash2 size={24}/></div></div>}
          <div className="media-overlay" style={{background:isRejected?'rgba(0,0,0,.08)':'rgba(0,0,0,.3)'}}>
            {isRejected?<button disabled={busy} onClick={()=>toggle(item)} title="Restaurar foto" style={{width:44,height:44,background:'#22C55E',border:0,borderRadius:'50%',cursor:'pointer',color:'#fff',display:'grid',placeItems:'center',boxShadow:'0 4px 6px -1px rgba(0,0,0,.2)'}}><RotateCcw size={20}/></button>:<><button onClick={()=>setSelectedPhoto(index)} title="Ver en grande" style={{width:36,height:36,background:'#fff',border:0,borderRadius:'50%',cursor:'pointer',display:'grid',placeItems:'center',color:'#1E293B'}}><Eye size={18}/></button><button disabled={busy} onClick={()=>toggle(item)} title="Descartar foto" style={{width:36,height:36,background:'#EF4444',border:0,borderRadius:'50%',cursor:'pointer',color:'#fff',display:'grid',placeItems:'center'}}><Trash2 size={18}/></button></>}
          </div>
          <span style={{position:'absolute',left:8,bottom:8,zIndex:3,padding:'3px 7px',borderRadius:5,background:'rgba(15,23,42,.72)',color:'#fff',fontSize:11,fontWeight:600}}>{formatBytes(item.size_bytes)}</span>
        </article>;
      })}
    </div>
  ), [media, busy, selected]);

  return <div className="moderation-container" style={{display:'flex',flex:1,overflow:'hidden',background:'#fff'}}>
    <style dangerouslySetInnerHTML={{__html: `
      .media-article { position: relative; aspect-ratio: 1; background: #F8FAFC; border-radius: 8px; overflow: hidden; transition: transform 0.15s ease-out, box-shadow 0.15s ease-out; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transform: translateZ(0); content-visibility: auto; contain-intrinsic-size: 140px; }
      .media-article:hover { transform: scale(1.02) translateZ(0); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); z-index: 10; }
      .media-overlay { position: absolute; inset: 0; opacity: 0; transition: opacity 0.15s ease-out; display: flex; align-items: center; justify-content: center; gap: 8px; will-change: opacity; }
      .media-article:hover .media-overlay { opacity: 1; }
      @media (max-width: 768px) {
        .moderation-aside { width: 100% !important; border-right: none !important; display: ${selected ? 'none' : 'flex'} !important; }
        .moderation-main { display: ${selected ? 'block' : 'none'} !important; overflow-y: auto !important; }
        .moderation-header { flex-direction: column; height: auto !important; padding: 16px !important; align-items: flex-start !important; gap: 16px !important; }
        .moderation-header-actions { flex-wrap: wrap; width: 100%; }
        .moderation-header-actions button { flex: 1; justify-content: center; padding: 10px 12px !important; font-size: 13px !important; }
        .mobile-back-btn { display: inline-flex !important; }
        .moderation-content { overflow-y: visible !important; padding: 16px !important; }
      }
    `}} />
    <aside className="moderation-aside" style={{width:280,background:'#F8FAFC',borderRight:'1px solid #E5E7EB',display:'flex',flexDirection:'column'}}>
      <div style={{padding:16,borderBottom:'1px solid #E5E7EB',height:132,boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'center'}}><h2 style={{margin:'0 0 2px',fontSize:15,color:'#1E293B',fontWeight:600}}>Moderación</h2><p style={{margin:0,fontSize:12,color:'#64748B'}}>{lots.length} lotes pendientes</p><div style={{display:'flex',gap:6,marginTop:12}}><div style={{position:'relative',flex:1,minWidth:0}}><Search size={14} color="#94A3B8" style={{position:'absolute',left:10,top:10}}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar lote..." style={{width:'100%',boxSizing:'border-box',padding:'8px 8px 8px 32px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:13,outline:'none'}}/></div><div onMouseLeave={()=>setSortOpen(false)} style={{position:'relative'}}><button title="Ordenar lotes" aria-label="Ordenar lotes" aria-expanded={sortOpen} onClick={()=>setSortOpen(!sortOpen)} style={{width:34,height:34,display:'grid',placeItems:'center',border:'1px solid #E2E8F0',borderRadius:6,background:sort==='oldest'?'#fff':'#EAF2F8',color:'#1A4B77',cursor:'pointer'}}><ArrowUpDown size={15}/></button>{sortOpen&&<div style={{position:'absolute',right:0,top:39,zIndex:30,width:180,padding:5,border:'1px solid #E2E8F0',borderRadius:8,background:'#fff',boxShadow:'0 10px 24px rgba(15,23,42,.16)'}}>{([['oldest','Más antiguos primero'],['newest','Más recientes primero'],['fewer','Menos fotos primero'],['departure','Salida A-Z'],['photos','Más fotos primero']] as const).map(([value,label])=><button key={value} onClick={()=>{setSort(value);setSortOpen(false);}} style={{width:'100%',padding:'8px 10px',border:0,borderRadius:5,background:sort===value?'#EEF4F8':'transparent',color:sort===value?'#1A4B77':'#475569',fontSize:12,fontWeight:sort===value?700:500,textAlign:'left',cursor:'pointer'}}>{label}</button>)}</div>}</div></div></div>
      <div style={{flex:1,overflowY:'auto',padding:'12px 8px',display:'flex',flexDirection:'column',gap:8}}>{visible.map(lot=>{const active=selected?.id===lot.id;return <button key={lot.id} onClick={()=>{setSelected(lot);setSelectedPhoto(null);}} style={{width:'100%',padding:'12px 16px',background:active?'#F1F5F9':'transparent',border:0,borderLeft:active?'3px solid #1A4B77':'3px solid transparent',textAlign:'left',cursor:'pointer',display:'flex',flexDirection:'column',gap:6,transition:'all .2s'}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><span style={{fontSize:13,fontWeight:600,color:active?'#1A4B77':'#334155'}}>{departureLabel(lot)}</span><i style={{width:8,height:8,borderRadius:'50%',background:'#22C55E',marginTop:3}}/></div><div style={{display:'flex',justifyContent:'space-between',gap:8}}><span style={{fontSize:12,color:'#64748B',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lot.activity_name}</span><span style={{fontSize:12,color:'#64748B'}}>{lot.approved_count} fotos</span></div></button>;})}</div>
    </aside>
    <main className="moderation-main" style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>{selected?<><header className="moderation-header" style={{padding:'0 24px',borderBottom:'1px solid #E5E7EB',display:'flex',alignItems:'center',height:132,boxSizing:'border-box',justifyContent:'space-between',gap:12}}><div><button className="mobile-back-btn" onClick={() => setSelected(null)} style={{display:'none', alignItems:'center', gap:4, marginBottom: 8, background:'none', border:0, color:'#64748B', cursor:'pointer', fontWeight: 600, padding: 0, fontSize: 13}}>← Volver a lotes</button><h2 style={{margin:'0 0 4px',fontSize:24,color:'#1A4B77',fontWeight:700,letterSpacing:'-.02em'}}>{departureLabel(selected).toUpperCase()}</h2><div style={{marginBottom:16,fontSize:15,color:'#64748B',fontWeight:500}}>{selected.activity_name} • {formatEventDate(selected.event_date)}</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><span style={{background:'#F8FAFC',border:'1px solid #E5E7EB',padding:'4px 12px',borderRadius:16,fontSize:13,color:'#475569',fontWeight:600}}>{media.length} en total</span><span style={{background:'#F0FDF4',border:'1px solid #BBF7D0',padding:'4px 12px',borderRadius:16,fontSize:13,color:'#16A34A',fontWeight:600}}>{media.length-rejected} aprobadas</span>{rejected>0&&<span style={{background:'#FEF2F2',border:'1px solid #FECACA',padding:'4px 12px',borderRadius:16,fontSize:13,color:'#EF4444',fontWeight:600}}>{rejected} descartadas</span>}</div></div><div className="moderation-header-actions" style={{display:'flex',gap:12}}><button onClick={()=>setRejectConfirm(true)} disabled={busy} style={{padding:'10px 24px',background:'#FEE2E2',color:'#EF4444',border:'1px solid #FECACA',borderRadius:8,fontSize:14,fontWeight:600,cursor:busy?'wait':'pointer',display:'flex',alignItems:'center',gap:8,opacity:busy?.6:1}} onMouseEnter={event=>event.currentTarget.style.background='#FECACA'} onMouseLeave={event=>event.currentTarget.style.background='#FEE2E2'}><Trash2 size={18}/> Descartar todo</button><button onClick={approve} disabled={busy} style={{padding:'10px 24px',background:hasPublishable?'#22C55E':'#EF4444',color:'#fff',border:0,borderRadius:8,fontSize:14,fontWeight:600,cursor:busy?'wait':'pointer',display:'flex',alignItems:'center',gap:8,boxShadow:hasPublishable?'0 1px 2px rgba(34,197,94,.2)':'0 1px 2px rgba(239,68,68,.2)',transition:'all .2s',opacity:busy?.6:1}} onMouseEnter={event=>event.currentTarget.style.transform='translateY(-1px)'} onMouseLeave={event=>event.currentTarget.style.transform='none'}>{hasPublishable?<Check size={18}/>:<Trash2 size={18}/>} {busy?'...':hasPublishable?'Publicar':'Descartar'}</button></div></header>{error&&<div style={{margin:16,padding:12,borderRadius:8,background:'#FEF2F2',border:'1px solid #FECACA',color:'#B91C1C'}}>{error}</div>}<div className="moderation-content" style={{flex:1,overflowY:'auto',padding:24}}>{mediaGrid}</div>{selectedPhoto!==null&&media[selectedPhoto]&&!media[selectedPhoto].mime_type.includes('heic')&&<Lightbox src={api.contentUrl(media[selectedPhoto].id)} mediaType={media[selectedPhoto].kind} isDeleted={media[selectedPhoto].status==='REJECTED'} onClose={()=>setSelectedPhoto(null)} onNext={selectedPhoto<media.length-1?()=>setSelectedPhoto(selectedPhoto+1):undefined} onPrev={selectedPhoto>0?()=>setSelectedPhoto(selectedPhoto-1):undefined} info={formatBytes(media[selectedPhoto].size_bytes)} actions={<button onClick={()=>toggle(media[selectedPhoto])} style={{background:'rgba(239,68,68,.2)',border:0,color:'#F87171',cursor:'pointer',padding:8,borderRadius:8,display:'flex',alignItems:'center',gap:8}}><Trash2 size={20}/><span>Descartar</span></button>}/>}<ConfirmDialog open={rejectConfirm} title="¿Descartar lote completo?" description="Todas las fotos de este lote pasarán a descartadas y se eliminarán automáticamente en 30 días." confirmLabel="Descartar todo" tone="danger" busy={busy} onCancel={()=>setRejectConfirm(false)} onConfirm={rejectAll} /></>:<div style={{padding:48,textAlign:'center',color:'#94A3B8'}}>{lots.length>0?'Seleccioná un lote a la izquierda para moderar.':'No hay lotes pendientes.'}</div>}</main>
  </div>;
}





















