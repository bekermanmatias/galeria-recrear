import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Check, Trash2, Edit2, PenLine, Upload as UploadIcon, Image } from 'lucide-react';
import DashboardLayout from '../layout/DashboardLayout';
import SearchableSelect from '../ui/SearchableSelect';
import Lightbox from '../ui/Lightbox';
import { api, type CatalogItem, type LotSummary, type Departure } from '../../lib/api';
import { uploadInQueue } from '../../lib/uploadQueue';

interface UploadFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  mediaId?: string;
}

const TABS = [
  { id: 'carga', label: 'Subir Material', icon: UploadIcon },
  { id: 'galeria', label: 'Ver Galería', icon: Image },
] as const;

const CUSTOM_ACTIVITY = '__personalizada__';
const isDeletable = (lot: LotSummary) => ['DRAFT', 'UPLOADING'].includes(lot.status);
const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

const getDepartureName = (lot: LotSummary) => {
  const name = lot.departure_name ?? lot.school_name ?? 'Salida';
  const type = lot.departure_type === 'AEREO' ? 'Aéreo' : lot.departure_type === 'MICRO' ? 'Micro' : '';
  if (type && !name.toLowerCase().startsWith(type.toLowerCase())) return `${type} - ${name}`;
  return name;
};

const formatDepartureRange = (item: Departure) => { const start=(item.start_date??item.event_date).slice(0,10); const end=(item.end_date??start).slice(0,10); return start===end?start:end; };
const departureOption = (item: Departure) => (item.type === 'MICRO' ? 'Micro' : 'Aereo') + ' · ' + item.name + ' · ' + item.destination + ' · ' + formatDepartureRange(item);

export default function CoordinatorPanel() {
  const [activeTab, setActiveTab] = useState('carga');
  const [salida, setSalida] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [actividad, setActividad] = useState('');
  const [albumName, setAlbumName] = useState('');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [activities, setActivities] = useState<CatalogItem[]>([]);
  const [lots, setLots] = useState<LotSummary[]>([]);
  const [error, setError] = useState('');

  // Gallery state
  const isCustomActivity = actividad === CUSTOM_ACTIVITY;
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [deletingLotId, setDeletingLotId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [galleryError, setGalleryError] = useState('');

  useEffect(() => {
    api.me()
      .then(({ user }) => {
        if (user.role !== 'COORDINATOR') {
          window.location.href = user.role === 'ADMIN' ? '/admin' : '/parent';
          return;
        }
        return Promise.all([api.myDepartures(), api.lots()]);
      })
      .then(result => {
        if (!result) return;
        setDepartures(result[0].items.filter(item => item.active));
        setLots(result[1].items);
      })
      .catch(() => { window.location.href = '/login'; });
  }, []);

  useEffect(() => {
    api.catalogs().then(data => { setActivities(data.activities); }).catch(reason => setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los catálogos.'));
  }, []);

  const handleActividadChange = (value: string) => {
    const prevActivity = activities.find(a => a.name === actividad);
    setActividad(value);
    if (!albumName || albumName === (prevActivity?.name ?? '')) {
      setAlbumName(value);
    }
  };

  const addFiles = (newFiles: FileList) => {
    const mapped: UploadFile[] = Array.from(newFiles)
      .filter(f => ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime'].includes(f.type) || /\.(jpe?g|png|heic|heif|mp4|mov)$/i.test(f.name))
      .map(f => ({
        id: Math.random().toString(36).slice(2),
        file: f,
        preview: URL.createObjectURL(f),
        status: 'pending',
      }));
    setFiles(prev => [...prev, ...mapped]);
    setDone(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadFiles = async () => {
    const selectedDeparture = departures.find(item => departureOption(item) === salida);
    const activity = isCustomActivity ? null : activities.find(item => item.name === actividad);
    const pending = files.filter(item => item.status === 'pending' || (item.status === 'error' && !item.mediaId));
    const retrying = files.filter(item => item.status === 'error' && item.mediaId);
    if (!selectedDeparture || !fecha || (!pending.length && !retrying.length)) return;
    setUploading(true); setUploadProgress(0); setError(''); setDone(false);
    try {
      const lot = await api.createLot({
        departureId: selectedDeparture.id,
        activityId: activity?.id ?? null,
        eventDate: fecha,
        albumName: albumName.trim() || undefined,
      });
      if (retrying.length) await Promise.all(retrying.map(async item => {
        setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'processing' } : file));
        await api.retryWatermark(lot.lotId, item.mediaId!);
      }));
      const result = await uploadInQueue(pending, async current => {
        const media = await api.uploadMedia(lot.lotId, current.file);
        setFiles(previous => previous.map(item => item.id === current.id ? { ...item, mediaId: media.id, status: 'processing' } : item));
      }, {
        concurrency: 3, retries: 1,
        onStart: current => setFiles(previous => previous.map(item => item.id === current.id ? { ...item, status: 'uploading' } : item)),
        onFinish: (current, success) => {
          if (!success) setFiles(previous => previous.map(item => item.id === current.id ? { ...item, status: 'error' } : item));
          setUploadProgress(previous => Math.round(Math.min(100, previous + (100 / Math.max(1, pending.length)))));
        },
      });
      if (result.failed.length) { setError('Quedaron ' + result.failed.length + ' archivo(s) para reintentar.'); return; }
      await api.submitLot(lot.lotId);
      setLots((await api.lots()).items);
      files.forEach(item => URL.revokeObjectURL(item.preview));
      setFiles([]);
      setAlbumName('');
      setActividad('');
      setDone(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo completar la carga.');
    } finally {
      setUploading(false);
    }
  };

  const startEditName = (lot: LotSummary) => {
    setEditingLotId(lot.id);
    setEditingName(lot.album_name ?? lot.activity_name ?? '');
    setGalleryError('');
  };

  const saveEditName = async (lotId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    setEditBusy(true);
    setGalleryError('');
    try {
      await api.renameLot(lotId, trimmed);
      setLots(prev => prev.map(l => l.id === lotId ? { ...l, album_name: trimmed } : l));
      setEditingLotId(null);
    } catch (reason) {
      setGalleryError(reason instanceof Error ? reason.message : 'No se pudo renombrar el álbum.');
    } finally {
      setEditBusy(false);
    }
  };

  const confirmDelete = (lotId: string) => {
    setDeletingLotId(lotId);
    setGalleryError('');
  };

  const executeDelete = async () => {
    if (!deletingLotId) return;
    setDeleteBusy(true);
    setGalleryError('');
    try {
      await api.deleteLot(deletingLotId);
      setLots(prev => prev.filter(l => l.id !== deletingLotId));
      setDeletingLotId(null);
    } catch (reason) {
      setGalleryError(reason instanceof Error ? reason.message : 'No se pudo eliminar el lote.');
      setDeletingLotId(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const canUpload = Boolean(salida && fecha && files.length > 0 && !uploading);
  const activityPlaceholder = activities.find(a => a.name === actividad)?.name || 'General';

  return (
    <DashboardLayout
      role="coordinator"
      tabs={TABS as any}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'carga' && (
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
      <main style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '24px', color: '#1A4B77' }}>Subir material</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#71717A' }}>Seleccioná la actividad y arrastrá las fotos.</p>
        </div>

        <div className="upload-fields-grid">
          <SearchableSelect
            label="Salida *"
            value={salida}
            onChange={setSalida}
            options={departures.map(departureOption)}
            placeholder="Seleccionar salida..."
          />
          <DateField label="Fecha *" value={fecha} onChange={setFecha} />
          <SearchableSelect
            label="Actividad"
            value={actividad}
            onChange={handleActividadChange}
            options={activities.map(item => item.name)}
            placeholder="Opcional..."
          />
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#09090B', marginBottom: '8px' }}>
              Nombre del álbum{isCustomActivity && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
            </label>
            <div style={{ position: 'relative' }}>
              {isCustomActivity && (
                <PenLine size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#1A4B77', pointerEvents: 'none' }} />
              )}
              <input
                type="text"
                value={albumName}
                onChange={e => setAlbumName(e.target.value)}
                placeholder={isCustomActivity ? 'Escribí el nombre del álbum...' : (activities.find(a => a.name === actividad)?.name || 'General')}
                maxLength={160}
                style={{
                  width: '100%', height: '44px',
                  padding: isCustomActivity ? '0 16px 0 34px' : '0 16px',
                  border: `1px solid ${isCustomActivity ? '#1A4B77' : '#E4E4E7'}`,
                  background: '#FFFFFF',
                  color: albumName ? '#09090B' : '#71717A',
                  fontSize: '14px', fontFamily: 'inherit', outline: 'none',
                  transition: 'border-color 0.2s', boxSizing: 'border-box', borderRadius: '6px',
                }}
                onFocus={e => (e.target.style.borderColor = '#1A4B77')}
                onBlur={e => (e.target.style.borderColor = isCustomActivity ? '#1A4B77' : '#E4E4E7')}
              />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: isCustomActivity ? '#1A4B77' : '#A1A1AA' }}>
              {isCustomActivity
                ? 'Se usará este nombre como nombre de la actividad y del álbum.'
                : 'Opcional. Si lo dejás vacío, se usa el nombre de la actividad.'}
            </p>
          </div>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `1px solid ${isDragging ? '#1A4B77' : '#E4E4E7'}`,
            background: isDragging ? '#FAFAFA' : '#FFFFFF',
            padding: '64px 24px', textAlign: 'center', cursor: 'pointer',
            transition: 'all 0.2s ease', marginBottom: '32px', marginTop: '24px', borderRadius: '8px',
          }}
        >
          <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.heic,.heif,.mp4,.mov,image/jpeg,image/png,image/heic,image/heif,video/mp4,video/quicktime" multiple style={{ display: 'none' }} onChange={e => e.target.files && addFiles(e.target.files)} />
          <Upload size={32} strokeWidth={1} color={isDragging ? '#1A4B77' : '#A1A1AA'} style={{ margin: '0 auto 16px' }} />
          <p style={{ margin: '0 0 8px', fontWeight: 500, fontSize: '15px', color: '#1A4B77' }}>Hacé clic o arrastrá las fotos acá</p>
          <p style={{ margin: 0, fontSize: '13px', color: '#A1A1AA' }}>JPG, PNG, HEIC, MP4 y MOV. Se subirán en calidad original.</p>
        </div>

        {files.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1A4B77' }}>Archivos seleccionados</h3>
              <span style={{ fontSize: '13px', color: '#71717A' }}>{files.length} archivo(s)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '8px' }}>
              {files.map(f => (
                <div key={f.id} onClick={() => setSelectedPhoto(f.id)} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: '#F4F4F5', borderRadius: '4px', cursor: 'pointer', outline: f.status === 'error' ? '2px solid #EF4444' : f.status === 'done' ? '2px solid #22C55E' : 'none' }}>
                  {f.file.type.startsWith('video/') || /\.(mp4|mov)$/i.test(f.file.name)
                    ? <video src={f.preview} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={f.preview} alt={f.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <button onClick={e => { e.stopPropagation(); removeFile(f.id); }} style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={12} color="white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploading && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#1A4B77' }}>{files.some(file => file.status === 'processing') ? 'Procesando...' : 'Subiendo archivos...'}</span>
              <span style={{ fontSize: '13px', color: '#71717A' }}>{uploadProgress}%</span>
            </div>
            <div style={{ height: '4px', background: '#F4F4F5', width: '100%', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#1A4B77', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {done && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#FAFAFA', border: '1px solid #E4E4E7', padding: '16px', marginBottom: '32px', borderRadius: '8px' }}>
            <div style={{ width: '24px', height: '24px', background: '#1A4B77', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={14} color="#FFFFFF" strokeWidth={3} />
            </div>
            <span style={{ fontSize: '14px', color: '#1A4B77', fontWeight: 500 }}>Carga completada. El lote ha sido enviado a revisión.</span>
          </div>
        )}

        {error && <div role="alert" style={{ color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

        <button
          onClick={uploadFiles}
          disabled={!canUpload}
          style={{ width: '100%', padding: '16px', background: canUpload ? '#1A4B77' : '#F4F4F5', color: canUpload ? '#FFFFFF' : '#A1A1AA', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, fontFamily: 'inherit', cursor: canUpload ? 'pointer' : 'not-allowed', transition: 'background 0.2s' }}
          onMouseEnter={e => canUpload && (e.currentTarget.style.background = '#133656')}
          onMouseLeave={e => canUpload && (e.currentTarget.style.background = '#1A4B77')}
        >
          {uploading ? (files.some(file => file.status === 'processing') ? 'Procesando...' : 'Subiendo...') : files.some(file => file.status === 'error') ? 'Reintentar carga' : 'Subir material'}
        </button>
      </main>
      </div>
      )}

      {activeTab === 'galeria' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '24px', color: '#1A4B77' }}>Lotes enviados</h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#71717A' }}>Estado del material cargado para tus salidas.</p>

            {galleryError && (
              <div role="alert" style={{ color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                {galleryError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1.2fr 1fr 100px', gap: '12px', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <div>Salida / Escuela</div>
                <div>Álbum / Actividad</div>
                <div>Fecha</div>
                <div>Creador</div>
                <div>Estado</div>
                <div style={{ textAlign: 'right' }}>Acciones</div>
              </div>

              {lots.map(lot => (
                <div key={lot.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1.2fr 1fr 100px', gap: '12px', alignItems: 'center', padding: '14px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', transition: 'all 0.2s ease' }}>
                  <div style={{ fontWeight: 600, color: '#1A4B77', fontSize: '14px' }}>
                    {getDepartureName(lot)}
                  </div>

                  <div>
                    {editingLotId === lot.id ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          autoFocus
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') void saveEditName(lot.id); if (e.key === 'Escape') setEditingLotId(null); }}
                          maxLength={160}
                          style={{ width: '100%', height: '30px', padding: '0 8px', border: '1px solid #1A4B77', borderRadius: '4px', fontSize: '13px', outline: 'none' }}
                        />
                        <button onClick={() => void saveEditName(lot.id)} disabled={editBusy} style={{ height: '30px', width: '30px', border: 'none', borderRadius: '4px', background: '#1A4B77', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditingLotId(null)} disabled={editBusy} style={{ height: '30px', width: '30px', border: '1px solid #E4E4E7', borderRadius: '4px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#334155', fontSize: '14px' }}>{lot.album_name || lot.activity_name}</span>
                        {isDeletable(lot) && (
                          <button onClick={() => startEditName(lot)} title="Editar nombre del álbum" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px', display: 'flex', alignItems: 'center' }}>
                            <Edit2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ color: '#64748B', fontSize: '13px' }}>
                    {formatDate(lot.event_date)}
                  </div>

                  <div style={{ color: '#64748B', fontSize: '13px' }}>
                    {lot.created_by_name || 'Coordinador'}
                  </div>

                  <div>
                    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '14px', background: lot.status === 'PUBLISHED' ? '#DCFCE7' : lot.status === 'PENDING' ? '#FEF3C7' : '#E2E8F0', color: lot.status === 'PUBLISHED' ? '#166534' : lot.status === 'PENDING' ? '#92400E' : '#475569', fontSize: '12px', fontWeight: 600 }}>
                      {lot.status === 'PUBLISHED' ? 'Publicado' : lot.status === 'PENDING' ? 'Pendiente' : (lot.status === 'UPLOADING' && lot.submitted_at) ? 'Procesando' : 'En carga'}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {isDeletable(lot) && editingLotId !== lot.id && (
                      <button onClick={() => confirmDelete(lot.id)} title="Eliminar lote" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: '4px', fontSize: '12px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Trash2 size={14} />
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!lots.length && <p style={{ color: '#71717A', padding: '16px 0' }}>Todavía no hay lotes cargados.</p>}
            </div>
          </div>
        </div>
      )}

      {deletingLotId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ width: 'min(100%, 400px)', background: '#fff', borderRadius: '12px', padding: '28px', boxShadow: '0 20px 50px rgba(15,23,42,.2)' }}>
            <h3 style={{ margin: '0 0 10px', color: '#1A4B77', fontSize: '17px' }}>¿Eliminar este lote?</h3>
            <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#64748B' }}>Se eliminará el lote y todos sus archivos. Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setDeletingLotId(null)} disabled={deleteBusy} style={{ padding: '10px 18px', border: '1px solid #E4E4E7', borderRadius: '6px', background: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={() => void executeDelete()} disabled={deleteBusy} style={{ padding: '10px 18px', border: 'none', borderRadius: '6px', background: '#EF4444', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: deleteBusy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: deleteBusy ? 0.7 : 1 }}>
                {deleteBusy ? 'Eliminando...' : 'Eliminar lote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPhoto !== null && (
        <Lightbox
          src={files.find(f => f.id === selectedPhoto)?.preview || ''}
          onClose={() => setSelectedPhoto(null)}
          onNext={files.findIndex(f => f.id === selectedPhoto) < files.length - 1 ? () => { const index = files.findIndex(f => f.id === selectedPhoto); setSelectedPhoto(files[index + 1].id); } : undefined}
          onPrev={files.findIndex(f => f.id === selectedPhoto) > 0 ? () => { const index = files.findIndex(f => f.id === selectedPhoto); setSelectedPhoto(files[index - 1].id); } : undefined}
          actions={
            <>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
              <button onClick={() => { removeFile(selectedPhoto); setSelectedPhoto(null); }} style={{ background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#F87171', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={20} />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>Eliminar</span>
              </button>
            </>
          }
        />
      )}
    </DashboardLayout>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#09090B', marginBottom: '8px' }}>{label}</label>
      <input type="date" value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', height: '44px', padding: '12px 16px', border: '1px solid #E4E4E7', background: '#FFFFFF', color: value ? '#09090B' : '#71717A', fontSize: '14px', fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box', borderRadius: '6px' }} onFocus={e => (e.target.style.borderColor = '#1A4B77')} onBlur={e => (e.target.style.borderColor = '#E4E4E7')} />
    </div>
  );
}

