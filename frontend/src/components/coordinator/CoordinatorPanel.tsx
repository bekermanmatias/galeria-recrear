import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Check, Image as ImageIcon, Trash2, ZoomIn, ZoomOut, Download, ChevronDown, Upload as UploadIcon, Image } from 'lucide-react';
import DashboardLayout from '../layout/DashboardLayout';
import SearchableSelect from '../ui/SearchableSelect';
import Lightbox from '../ui/Lightbox';
import { api, type CatalogItem, type LotSummary, type School } from '../../lib/api';

interface UploadFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

const TABS = [
  { id: 'carga', label: 'Subir Material', icon: UploadIcon },
  { id: 'galeria', label: 'Ver Galería', icon: Image },
] as const;

export default function CoordinatorPanel() {
  const [activeTab, setActiveTab] = useState('carga');
  const [colegio, setColegio] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [turno, setTurno] = useState('');
  const [actividad, setActividad] = useState('');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [activities, setActivities] = useState<CatalogItem[]>([]);
  const [shifts, setShifts] = useState<CatalogItem[]>([]);
  const [lots, setLots] = useState<LotSummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.me()
      .then(({ user }) => {
        if (user.role !== 'COORDINATOR') {
          window.location.href = user.role === 'ADMIN' ? '/admin' : '/parent';
          return;
        }
        return Promise.all([api.mySchools(), api.lots()]);
      })
      .then(result => {
        if (!result) return;
        setSchools(result[0].items);
        setLots(result[1].items);
      })
      .catch(() => { window.location.href = '/login'; });
  }, []);

  useEffect(() => {
    const school = schools.find(item => item.name === colegio);
    if (!school) {
      setActivities([]);
      setShifts([]);
      return;
    }
    api.catalogs(school.id)
      .then(data => {
        setActivities(data.activities);
        setShifts(data.shifts);
        setActividad('');
        setTurno('');
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los catálogos.'));
  }, [colegio, schools]);

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
    const school = schools.find(item => item.name === colegio);
    const shift = shifts.find(item => item.name === turno);
    const activity = activities.find(item => item.name === actividad);
    if (!school || !fecha || files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    setError('');
    setDone(false);
    try {
      const lot = await api.createLot({ schoolId: school.id, shiftId: shift?.id ?? null, activityId: activity?.id ?? null, eventDate: fecha });
      for (let index = 0; index < files.length; index += 1) {
        const current = files[index];
        setFiles(previous => previous.map(item => item.id === current.id ? { ...item, status: 'uploading' } : item));
        try {
          await api.uploadMedia(lot.lotId, current.file);
          setFiles(previous => previous.map(item => item.id === current.id ? { ...item, status: 'done' } : item));
        } catch (reason) {
          setFiles(previous => previous.map(item => item.id === current.id ? { ...item, status: 'error' } : item));
          throw reason;
        }
        setUploadProgress(Math.round(((index + 1) / files.length) * 100));
      }
      await api.submitLot(lot.lotId);
      setLots((await api.lots()).items);
      files.forEach(item => URL.revokeObjectURL(item.preview));
      setFiles([]);
      setDone(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo completar la carga.');
    } finally {
      setUploading(false);
    }
  };

  const canUpload = Boolean(colegio && fecha && files.length > 0 && !uploading);

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
          <h2 style={{ margin: '0 0 8px', fontSize: '24px', color: '#1A4B77' }}>
            Subir material
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#71717A' }}>
            Seleccioná el turno, la actividad y arrastrá las fotos.
          </p>
        </div>

        {/* Selects */}
        <div className="responsive-grid">
          <SearchableSelect
            label="Colegio *"
            value={colegio}
            onChange={setColegio}
            options={schools.map(item => item.name)}
            placeholder="Seleccionar colegio..."
          />
          <DateField
            label="Fecha *"
            value={fecha}
            onChange={setFecha}
          />
          <SearchableSelect
            label="Turno"
            value={turno}
            onChange={setTurno}
            options={shifts.map(item => item.name)}
            placeholder="Opcional..."
          />
          <SearchableSelect
            label="Actividad"
            value={actividad}
            onChange={setActividad}
            options={activities.map(item => item.name)}
            placeholder="Opcional..."
          />
        </div>

        {/* Dropzone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `1px solid ${isDragging ? '#1A4B77' : '#E4E4E7'}`,
            background: isDragging ? '#FAFAFA' : '#FFFFFF',
            padding: '64px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: '32px',
            borderRadius: '8px',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.heic,.heif,.mp4,.mov,image/jpeg,image/png,image/heic,image/heif,video/mp4,video/quicktime"
            multiple
            style={{ display: 'none' }}
            onChange={e => e.target.files && addFiles(e.target.files)}
          />
          <Upload size={32} strokeWidth={1} color={isDragging ? '#1A4B77' : '#A1A1AA'} style={{ margin: '0 auto 16px' }} />
          <p style={{ margin: '0 0 8px', fontWeight: 500, fontSize: '15px', color: '#1A4B77' }}>
            Hacé clic o arrastrá las fotos acá
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#A1A1AA' }}>
            JPG, PNG, HEIC, MP4 y MOV. Se subirán en calidad original.
          </p>
        </div>

        {/* File preview list */}
        {files.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1A4B77' }}>Archivos seleccionados</h3>
              <span style={{ fontSize: '13px', color: '#71717A' }}>{files.length} fotos</span>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px',
              maxHeight: '240px', overflowY: 'auto', paddingRight: '8px',
            }}>
              {files.map(f => (
                <div key={f.id} onClick={() => setSelectedPhoto(f.id)} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: '#F4F4F5', borderRadius: '4px', cursor: 'pointer' }}>
                  {f.file.type.startsWith('video/') || /\.(mp4|mov)$/i.test(f.file.name)
                    ? <video src={f.preview} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={f.preview} alt={f.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <button
                    onClick={e => { e.stopPropagation(); removeFile(f.id); }}
                    style={{
                      position: 'absolute', top: '4px', right: '4px',
                      width: '20px', height: '20px',
                      background: 'rgba(0,0,0,0.5)', border: 'none',
                      borderRadius: '50%', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={12} color="white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {uploading && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#1A4B77' }}>Subiendo...</span>
              <span style={{ fontSize: '13px', color: '#71717A' }}>{uploadProgress}%</span>
            </div>
            <div style={{ height: '4px', background: '#F4F4F5', width: '100%', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${uploadProgress}%`,
                background: '#1A4B77',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}

        {/* Done state */}
        {done && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: '#FAFAFA', border: '1px solid #E4E4E7',
            padding: '16px', marginBottom: '32px', borderRadius: '8px'
          }}>
            <div style={{ width: '24px', height: '24px', background: '#1A4B77', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={14} color="#FFFFFF" strokeWidth={3} />
            </div>
            <span style={{ fontSize: '14px', color: '#1A4B77', fontWeight: 500 }}>
              Carga completada. El lote ha sido enviado a revisión.
            </span>
          </div>
        )}

        {error && <div role="alert" style={{ color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

        {/* Submit button */}
        <button
          onClick={uploadFiles}
          disabled={!canUpload}
          style={{
            width: '100%',
            padding: '16px',
            background: canUpload ? '#1A4B77' : '#F4F4F5',
            color: canUpload ? '#FFFFFF' : '#A1A1AA',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            fontFamily: 'inherit',
            cursor: canUpload ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => canUpload && (e.currentTarget.style.background = '#133656')}
          onMouseLeave={e => canUpload && (e.currentTarget.style.background = '#1A4B77')}
        >
          {uploading ? 'Procesando...' : 'Subir material'}
        </button>
      </main>
      </div>
      )}

      {activeTab === 'galeria' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '24px', color: '#1A4B77' }}>Lotes enviados</h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#71717A' }}>Estado del material cargado para tus colegios.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {lots.map(lot => (
                <article key={lot.id} style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '18px', background: '#FFFFFF' }}>
                  <strong style={{ display: 'block', color: '#1A4B77', marginBottom: '8px' }}>{lot.school_name}</strong>
                  <div style={{ color: '#475569', fontSize: '14px' }}>{lot.activity_name} · Turno {lot.shift_name}</div>
                  <div style={{ color: '#64748B', fontSize: '13px', marginTop: '4px' }}>{lot.event_date}</div>
                  <span style={{ display: 'inline-block', marginTop: '14px', padding: '4px 10px', borderRadius: '14px', background: lot.status === 'PUBLISHED' ? '#DCFCE7' : lot.status === 'PENDING' ? '#FEF3C7' : '#E2E8F0', color: lot.status === 'PUBLISHED' ? '#166534' : '#475569', fontSize: '12px', fontWeight: 700 }}>{lot.status === 'PUBLISHED' ? 'Publicado' : lot.status === 'PENDING' ? 'Pendiente' : 'En carga'}</span>
                </article>
              ))}
              {!lots.length && <p style={{ color: '#71717A' }}>Todavía no hay lotes cargados.</p>}
            </div>
          </div>
        </div>
      )}

      {selectedPhoto !== null && (
        <Lightbox
          src={files.find(f => f.id === selectedPhoto)?.preview || ''}
          onClose={() => setSelectedPhoto(null)}
          onNext={
            files.findIndex(f => f.id === selectedPhoto) < files.length - 1
              ? () => {
                  const index = files.findIndex(f => f.id === selectedPhoto);
                  setSelectedPhoto(files[index + 1].id);
                }
              : undefined
          }
          onPrev={
            files.findIndex(f => f.id === selectedPhoto) > 0
              ? () => {
                  const index = files.findIndex(f => f.id === selectedPhoto);
                  setSelectedPhoto(files[index - 1].id);
                }
              : undefined
          }
          actions={
            <>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
              <button
                onClick={() => {
                  removeFile(selectedPhoto);
                  setSelectedPhoto(null);
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: 'none',
                  color: '#F87171',
                  cursor: 'pointer', padding: '8px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                <Trash2 size={20} />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>
                  Eliminar
                </span>
              </button>
            </>
          }
        />
      )}
    </DashboardLayout>
  );
}

function DateField({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#09090B', marginBottom: '8px' }}>
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          height: '44px',
          padding: '12px 16px',
          border: '1px solid #E4E4E7',
          background: '#FFFFFF',
          color: value ? '#09090B' : '#71717A',
          fontSize: '14px',
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box',
          borderRadius: '6px',
        }}
        onFocus={e => (e.target.style.borderColor = '#1A4B77')}
        onBlur={e => (e.target.style.borderColor = '#E4E4E7')}
      />
    </div>
  );
}
