import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, Trash2, Upload, X } from 'lucide-react';
import { api, type CatalogItem, type Departure } from '../../lib/api';
import Lightbox from '../ui/Lightbox';
import SearchableSelect from '../ui/SearchableSelect';

type UploadStatus = 'queued' | 'uploading' | 'processing' | 'uploaded' | 'failed';
type UploadFile = { id:string; file:File; preview:string; isVideo:boolean; isHeic:boolean; status:UploadStatus; mediaId?:string; error?:string };
const validName=/\.(jpe?g|jpe|jfif|png|heic|heif|mp4|mov)$/i;
const validTypes=new Set(['image/jpeg','image/pjpeg','image/png','image/heic','image/heif','video/mp4','video/quicktime']);
// Cada archivo se procesa con marca de agua y se envía al almacenamiento remoto.
// Serializar evita saturar el procesamiento cuando se selecciona un lote grande.
const MAX_PARALLEL_UPLOADS=1;
const dateInput:React.CSSProperties={width:'100%',minWidth:0,height:44,padding:'0 16px',border:'1px solid #E4E4E7',background:'#fff',color:'#09090B',fontSize:16,fontFamily:'inherit',outline:'none',boxSizing:'border-box',borderRadius:6,WebkitAppearance:'none',appearance:'none'};
const formatBytes=(bytes:number)=>bytes>=1024*1024?`${(bytes/(1024*1024)).toFixed(bytes>=10*1024*1024?0:1)} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`;
const CUSTOM_ACTIVITY = '__personalizada__';
const formatDepartureRange = (item: Departure) => { const start=(item.start_date??item.event_date).slice(0,10); const end=(item.end_date??start).slice(0,10); return start===end?start:end; };
const departureOption = (item: Departure) => (item.type === 'MICRO' ? 'Micro' : 'Aereo') + ' · ' + item.name + ' · ' + item.destination + ' · ' + formatDepartureRange(item);

export default function AdminCargaManual() {
  const [departures,setDepartures]=useState<Departure[]>([]); const [activities,setActivities]=useState<CatalogItem[]>([]);
  const [departure,setDeparture]=useState(''); const [date,setDate]=useState(new Date().toISOString().slice(0,10)); const [activity,setActivity]=useState('');
  const [albumName,setAlbumName]=useState('');
  const isCustomActivity = activity === CUSTOM_ACTIVITY;
  const handleActivityChange = (value: string) => {
    const prevActivity = activities.find(a => a.name === activity);
    setActivity(value);
    if (!albumName || albumName === (prevActivity?.name ?? '')) {
      setAlbumName(value);
    }
  };
  const [files,setFiles]=useState<UploadFile[]>([]); const [dragging,setDragging]=useState(false); const [uploading,setUploading]=useState(false); const [progress,setProgress]=useState({completed:0,total:0}); const [message,setMessage]=useState(''); const [selected,setSelected]=useState<string|null>(null); const input=useRef<HTMLInputElement>(null); const [hasAttemptedUpload,setHasAttemptedUpload]=useState(false);
  useEffect(()=>{Promise.all([api.myDepartures(),api.catalogs()]).then(([departureData,catalogData])=>{setDepartures(departureData.items.filter(item=>item.active));setActivities(catalogData.activities);}).catch(reason=>setMessage(reason.message));},[]);
  useEffect(()=>()=>files.forEach(item=>URL.revokeObjectURL(item.preview)),[files]);
  const addFiles=(incoming:FileList|null)=>{if(!incoming)return;const raw=Array.from(incoming);const accepted=raw.filter(file=>validName.test(file.name)||validTypes.has(file.type.toLowerCase())).map(file=>({id: crypto.randomUUID(),file,preview:URL.createObjectURL(file),isVideo:file.type.startsWith('video/')||/\.(mp4|mov)$/i.test(file.name),isHeic:/\.(heic|heif)$/i.test(file.name),status:'queued' as UploadStatus}));setFiles(current=>[...current,...accepted]);setMessage(accepted.length===raw.length?'':`Se omitieron ${raw.length-accepted.length} archivo(s) con formato no permitido.`);};
  const drop=useCallback((event:React.DragEvent)=>{event.preventDefault();setDragging(false);addFiles(event.dataTransfer.files);},[]);
  const remove=(id:string)=>setFiles(current=>current.filter(item=>item.id!==id));
  const updateFile=(id:string,patch:Partial<UploadFile>)=>setFiles(current=>current.map(item=>item.id===id?{...item,...patch}:item));

  const upload=async()=>{
    setHasAttemptedUpload(true);
    const departureItem=departures.find(item=>departureOption(item)===departure),activityItem=activities.find(item=>item.name===activity);
    const failedFiles=files.filter(item=>item.status==='failed'&&item.mediaId);const pending=files.filter(item=>item.status==='queued'||(item.status==='failed'&&!item.mediaId));
    if(!departureItem){setMessage('Debés seleccionar una salida.');return;}
    if(!date){setMessage('Debés indicar la fecha.');return;}
    if(isCustomActivity&&!albumName.trim()){setMessage('Debés ingresar un nombre para el álbum.');return;}
    if(!pending.length&&!failedFiles.length){setMessage('Debés seleccionar al menos un archivo para subir.');return;}
    if(uploading)return;
    setUploading(true);setProgress({completed:0,total:pending.length||failedFiles.length});setMessage('');
    try {const lot=await api.createLot({departureId:departureItem.id,activityId:activityItem?.id ?? null,eventDate:date,albumName:albumName.trim()||undefined});
      if(failedFiles.length&&!pending.length){await Promise.all(failedFiles.map(async item=>{updateFile(item.id,{status:'processing',error:undefined});await api.retryWatermark(lot.lotId,item.mediaId!);}));}
      else {let cursor=0;let completed=0;let failed=0;const worker=async()=>{while(true){const item=pending[cursor++];if(!item)return;updateFile(item.id,{status:'uploading',error:undefined});try{const result=await api.uploadMedia(lot.lotId,item.file);updateFile(item.id,{status:'processing',mediaId:result.id});}catch(reason){failed+=1;updateFile(item.id,{status:'failed',error:reason instanceof Error?reason.message:'No se pudo subir'});}finally{completed+=1;setProgress({completed,total:pending.length});}}};await Promise.all(Array.from({length:Math.min(MAX_PARALLEL_UPLOADS,pending.length)},worker));if(failed){setMessage(failed+' archivo(s) no pudieron subirse.');return;}}
      await api.submitLot(lot.lotId);setFiles([]);setAlbumName('');setActivity('');setMessage('Carga completada y enviada a moderacion.');
    }catch(reason){setMessage(reason instanceof Error?reason.message:'No se pudo cargar el lote.');}finally{setUploading(false);}
  };
  const current=files.find(item=>item.id===selected); const currentIndex=files.findIndex(item=>item.id===selected); const totalSize=files.reduce((sum,item)=>sum+item.file.size,0);
  return <div style={{flex:1,overflowY:'auto',padding:32}}><div style={{maxWidth:720,margin:'0 auto'}}>
    <div style={{marginBottom:32}}><h2 style={{margin:'0 0 8px',fontSize:24,color:'#1A4B77'}}>Subir material</h2><p style={{margin:0,fontSize:14,color:'#71717A'}}>Seleccioná la actividad y todas las fotos o videos del lote.</p></div>
    <div className="upload-fields-grid">
      <SearchableSelect label="Salida *" value={departure} onChange={setDeparture} options={departures.map(departureOption)} placeholder="Seleccionar salida..." error={hasAttemptedUpload&&!departure}/>
      <label style={{display:'grid',gap:8,fontSize:13,fontWeight:500,color:hasAttemptedUpload&&!date?'#EF4444':'inherit'}}>Fecha *<input type="date" value={date} onChange={event=>setDate(event.target.value)} style={{...dateInput,borderColor:hasAttemptedUpload&&!date?'#EF4444':'#E4E4E7'}}/></label>
      <SearchableSelect label="Actividad" value={activity} onChange={handleActivityChange} options={[...activities.map(item=>item.name),CUSTOM_ACTIVITY]} renderOption={(option: string)=>option===CUSTOM_ACTIVITY?'Personalizada...':option} placeholder="Opcional..."/>
      <div>
        <label style={{display:'block',fontSize:13,fontWeight:500,color:isCustomActivity&&hasAttemptedUpload&&!albumName?'#EF4444':'#09090B',marginBottom:8}}>Nombre del álbum{isCustomActivity&&<span style={{color:'#EF4444',marginLeft:2}}>*</span>}</label>
        <input type="text" value={albumName} onChange={e=>setAlbumName(e.target.value)} placeholder={isCustomActivity?'Escribí el nombre del álbum...':(activities.find(a=>a.name===activity)?.name||'General')} maxLength={160} style={{width:'100%',height:44,padding:isCustomActivity?'0 16px 0 34px':'0 16px',border:`1px solid ${isCustomActivity&&hasAttemptedUpload&&!albumName?'#EF4444':isCustomActivity?'#1A4B77':'#E4E4E7'}`,background:'#fff',color:albumName?'#09090B':'#71717A',fontSize:16,fontFamily:'inherit',outline:'none',transition:'border-color .2s',boxSizing:'border-box',borderRadius:6,WebkitAppearance:'none',appearance:'none'}} onFocus={e=>(e.target.style.borderColor='#1A4B77')} onBlur={e=>(e.target.style.borderColor=isCustomActivity&&hasAttemptedUpload&&!albumName?'#EF4444':isCustomActivity?'#1A4B77':'#E4E4E7')}/>
      </div>
    </div>
    <div onDrop={drop} onDragOver={event=>{event.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onClick={()=>!uploading&&input.current?.click()} style={{border:`1px solid ${dragging?'#1A4B77':'#E4E4E7'}`,background:dragging?'#FAFAFA':'#fff',padding:'64px 24px',textAlign:'center',cursor:uploading?'wait':'pointer',transition:'all .2s ease',margin:'32px 0',borderRadius:8}}>
      <input ref={input} type="file" multiple accept=".jpg,.jpeg,.jpe,.jfif,.png,.heic,.heif,.mp4,.mov,image/jpeg,image/png,image/heic,image/heif,video/mp4,video/quicktime" hidden onChange={event=>{addFiles(event.target.files);event.currentTarget.value='';}}/>
      <Upload size={32} strokeWidth={1} color={dragging?'#1A4B77':'#A1A1AA'} style={{margin:'0 auto 16px'}}/><p style={{margin:'0 0 8px',fontWeight:500,fontSize:15,color:'#1A4B77'}}>Hacé clic o arrastrá todas las fotos y videos acá</p><p style={{margin:0,fontSize:13,color:'#A1A1AA'}}>JPG, PNG, HEIC, MP4 o MOV · hasta 500 MB por archivo · calidad original.</p>
    </div>
    {files.length>0&&<div style={{marginBottom:32}}><div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'baseline',marginBottom:16}}><h3 style={{margin:0,fontSize:14,fontWeight:600,color:'#1A4B77'}}>Archivos seleccionados</h3><span style={{fontSize:13,color:'#71717A',whiteSpace:'nowrap'}}>{files.length} archivos · {formatBytes(totalSize)}</span></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(80px,1fr))',gap:8,maxHeight:240,overflowY:'auto',paddingRight:8}}>{files.map(item=><div key={item.id} onClick={()=>setSelected(item.id)} style={{position:'relative',aspectRatio:'1',overflow:'hidden',background:'#F4F4F5',borderRadius:4,cursor:'pointer',transition:'transform .18s ease',outline:item.status==='failed'?'2px solid #EF4444':item.status==='uploaded'?'2px solid #22C55E':'none'}}>{item.isHeic?<div style={{height:'100%',display:'grid',placeItems:'center',fontWeight:700,color:'#64748B'}}>HEIC</div>:item.isVideo?<video src={item.preview} muted preload="metadata" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<img src={item.preview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>}<span style={{position:'absolute',left:4,bottom:4,padding:'2px 5px',background:'rgba(9,75,119,.82)',color:'#fff',fontSize:10,borderRadius:3}}>{item.status==='uploading'?'Subiendo':item.status==='processing'?'Procesando marca':item.status==='uploaded'?'Listo':item.status==='failed'?'Error':'En cola'}</span>{(item.status==='uploading'||item.status==='processing')&&<div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(255,255,255,.42)'}}><LoaderCircle size={20} color="#1A4B77"/></div>}{!uploading&&<button title="Quitar archivo" onClick={event=>{event.stopPropagation();remove(item.id);}} style={{position:'absolute',top:4,right:4,width:20,height:20,background:'rgba(0,0,0,.5)',border:0,borderRadius:'50%',cursor:'pointer',display:'grid',placeItems:'center'}}><X size={12} color="#fff"/></button>}</div>)}</div></div>}
    {uploading&&<div style={{marginBottom:32}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{fontSize:13,color:'#1A4B77'}}>Subiendo archivos en forma segura...</span><span style={{fontSize:13,color:'#71717A'}}>{progress.completed} de {progress.total}</span></div><div style={{height:6,background:'#F4F4F5',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${progress.total?Math.round(progress.completed/progress.total*100):0}%`,background:'#1A4B77',transition:'width .3s ease'}}/></div></div>}
    {message&&<div style={{display:'flex',alignItems:'center',gap:12,background:message.startsWith('Carga')?'#FAFAFA':'#FEF2F2',border:`1px solid ${message.startsWith('Carga')?'#E4E4E7':'#FECACA'}`,padding:16,marginBottom:32,borderRadius:8,color:message.startsWith('Carga')?'#1A4B77':'#B91C1C'}}>{message.startsWith('Carga')?<Check size={16}/>:<AlertCircle size={16}/>}<span style={{fontSize:14,fontWeight:500}}>{message}</span></div>}
    <button onClick={upload} style={{width:'100%',padding:16,background:'#1A4B77',color:'#fff',border:0,borderRadius:8,fontSize:14,fontWeight:500,fontFamily:'inherit',cursor:uploading?'wait':'pointer',transition:'background .2s'}} onMouseEnter={event=>!uploading&&(event.currentTarget.style.background='#133656')} onMouseLeave={event=>!uploading&&(event.currentTarget.style.background='#1A4B77')}>{uploading?(files.some(item=>item.status==='processing')?'Procesando marca de agua...':`Subiendo ${progress.completed} de ${progress.total}`):files.some(item=>item.status==='failed')?'Reintentar archivos fallidos':'Subir material'}</button>
  </div>{selected&&current&&!current.isVideo&&!current.isHeic&&<Lightbox src={current.preview} onClose={()=>setSelected(null)} onNext={currentIndex<files.length-1?()=>setSelected(files[currentIndex+1].id):undefined} onPrev={currentIndex>0?()=>setSelected(files[currentIndex-1].id):undefined} actions={<button onClick={()=>{remove(current.id);setSelected(null);}} style={{background:'rgba(239,68,68,.2)',border:0,color:'#F87171',cursor:'pointer',padding:8,borderRadius:8,display:'flex',alignItems:'center',gap:8}}><Trash2 size={20}/><span style={{fontSize:13,fontWeight:500}}>Eliminar</span></button>}/>}</div>;
}
