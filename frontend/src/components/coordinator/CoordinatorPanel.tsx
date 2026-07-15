import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Check, Image as ImageIcon, Trash2, ZoomIn, ZoomOut, Download, ChevronDown, Upload as UploadIcon, Image } from 'lucide-react';
import DashboardLayout from '../layout/DashboardLayout';
import SearchableSelect from '../ui/SearchableSelect';
import Lightbox from '../ui/Lightbox';

const TURNOS = ['Mañana', 'Tarde', 'Noche'];
const ACTIVIDADES = ['Cabalgata', 'Hotel', 'Pileta', 'Excursión', 'Cena'];
const COLEGIOS = ['Colegio San Luis', 'Instituto Belgrano', 'Escuela Normal', 'Colegio Nacional'];

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

  const addFiles = (newFiles: FileList) => {
    const mapped: UploadFile[] = Array.from(newFiles)
      .filter(f => f.type.startsWith('image/'))
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

  const simulateUpload = async () => {
    if (!colegio || !fecha || !turno || !actividad || files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 120));
      setUploadProgress(i);
    }
    setUploading(false);
    setDone(true);
    setFiles([]);
  };

  const canUpload = colegio && fecha && turno && actividad && files.length > 0 && !uploading;

  return (
    <DashboardLayout
      role="coordinator"
      tabs={TABS as any}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'carga' && (
      <div style={{ flex: 1, overflowY: 'auto' }}>
      <main className="responsive-padding" style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '32px', letterSpacing: '-0.03em', color: '#1A4B77' }}>
            Subir material
          </h2>
          <p style={{ margin: 0, fontSize: '15px', color: '#71717A' }}>
            Seleccioná el turno, la actividad y arrastrá las fotos.
          </p>
        </div>

        {/* Selects */}
        <div className="responsive-grid">
          <SearchableSelect
            label="Colegio"
            value={colegio}
            onChange={setColegio}
            options={COLEGIOS}
            placeholder="Seleccionar colegio..."
          />
          <DateField
            label="Fecha"
            value={fecha}
            onChange={setFecha}
          />
          <SearchableSelect
            label="Turno"
            value={turno}
            onChange={setTurno}
            options={TURNOS}
            placeholder="Seleccionar turno..."
          />
          <SearchableSelect
            label="Actividad"
            value={actividad}
            onChange={setActividad}
            options={ACTIVIDADES}
            placeholder="Seleccionar actividad..."
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
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => e.target.files && addFiles(e.target.files)}
          />
          <Upload size={32} strokeWidth={1} color={isDragging ? '#1A4B77' : '#A1A1AA'} style={{ margin: '0 auto 16px' }} />
          <p style={{ margin: '0 0 8px', fontWeight: 500, fontSize: '15px', color: '#1A4B77' }}>
            Hacé clic o arrastrá las fotos acá
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#A1A1AA' }}>
            JPG, PNG, HEIC. Se subirán en calidad original.
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
                <div key={f.id} onClick={() => setSelectedPhoto(f.id)} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: '#F4F4F5', cursor: 'pointer' }}>
                  <img src={f.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
            <div style={{ height: '2px', background: '#F4F4F5', width: '100%' }}>
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
            padding: '16px', marginBottom: '32px',
          }}>
            <div style={{ width: '24px', height: '24px', background: '#1A4B77', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={14} color="#FFFFFF" strokeWidth={3} />
            </div>
            <span style={{ fontSize: '14px', color: '#1A4B77', fontWeight: 500 }}>
              Carga completada. El lote ha sido enviado a revisión.
            </span>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={simulateUpload}
          disabled={!canUpload}
          style={{
            width: '100%',
            padding: '16px',
            background: canUpload ? '#1A4B77' : '#F4F4F5',
            color: canUpload ? '#FFFFFF' : '#A1A1AA',
            border: 'none',
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
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717A' }}>
          La galería del coordinador estará disponible próximamente.
        </div>
      )}

      {selectedPhoto !== null && (
        <Lightbox 
          src={files.find(f => f.id === selectedPhoto)?.preview || ''} 
          onClose={() => setSelectedPhoto(null)} 
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
          padding: '12px 16px',
          border: '1px solid #E4E4E7',
          background: '#FFFFFF',
          color: value ? '#09090B' : '#71717A',
          fontSize: '14px',
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box',
        }}
        onFocus={e => (e.target.style.borderColor = '#1A4B77')}
        onBlur={e => (e.target.style.borderColor = '#E4E4E7')}
      />
    </div>
  );
}
