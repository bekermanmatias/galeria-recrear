import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Check, ChevronDown, Trash2, ZoomIn, ZoomOut } from 'lucide-react';

const TURNOS = ['Mañana', 'Tarde', 'Noche'];
const ACTIVIDADES = ['Cabalgata', 'Hotel', 'Pileta', 'Excursión', 'Cena'];
const COLEGIOS = ['Colegio San Luis', 'Instituto Belgrano', 'Escuela Normal', 'Colegio Nacional'];

interface UploadFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

export default function AdminCargaManual() {
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
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
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
          <SelectField
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
          <SelectField
            label="Turno"
            value={turno}
            onChange={setTurno}
            options={TURNOS}
            placeholder="Seleccionar turno..."
          />
          <SelectField
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
            borderRadius: '8px',
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
                <div key={f.id} onClick={() => setSelectedPhoto(f.id)} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: '#F4F4F5', borderRadius: '4px', cursor: 'pointer' }}>
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
              Carga completada con éxito.
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
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <LightboxViewer
          src={files.find(f => f.id === selectedPhoto)?.preview || ''}
          onClose={() => setSelectedPhoto(null)}
          onDelete={() => {
            removeFile(selectedPhoto);
            setSelectedPhoto(null);
          }}
        />
      )}
    </div>
  );
}

function LightboxViewer({ src, onClose, onDelete }: { src: string, onClose: () => void, onDelete?: () => void }) {
  const [zoom, setZoom] = useState(1);
  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div 
        style={{ flex: 1, width: '100%', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: zoom > 1 ? 'grab' : 'zoom-out' }}
        onClick={onClose}
      >
        <img 
          src={src} 
          alt="Vista completa" 
          onClick={(e) => e.stopPropagation()}
          style={{ 
            maxWidth: '100%', maxHeight: '100%', 
            objectFit: 'contain', 
            transform: `scale(${zoom})`,
            transition: 'transform 0.2s ease-out'
          }}
        />
      </div>

      <button 
        onClick={onClose}
        style={{
          position: 'absolute', top: '24px', right: '24px',
          background: 'rgba(255, 255, 255, 0.1)', border: 'none',
          borderRadius: '50%', width: '48px', height: '48px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'white', zIndex: 10
        }}
      >
        <X size={24} />
      </button>

      {/* Toolbar */}
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: '32px',
          background: 'rgba(39, 39, 42, 0.8)', backdropFilter: 'blur(8px)',
          padding: '8px', borderRadius: '12px',
          display: 'flex', gap: '8px', zIndex: 10
        }}
      >
        <button 
          onClick={() => setZoom(z => Math.max(0.5, z - 0.5))}
          style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}
        >
          <ZoomOut size={20} />
        </button>
        <span style={{ color: 'white', display: 'flex', alignItems: 'center', fontSize: '13px', minWidth: '48px', justifyContent: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button 
          onClick={() => setZoom(z => Math.min(3, z + 0.5))}
          style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}
        >
          <ZoomIn size={20} />
        </button>
        
        {onDelete && (
          <>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
            <button 
              onClick={onDelete}
              style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}
            >
              <Trash2 size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SelectField({
  label, value, onChange, options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#09090B', marginBottom: '8px' }}>
        {label}
      </label>
      <div 
        onClick={() => { setIsOpen(true); setSearch(''); }}
        style={{
          width: '100%',
          padding: '12px 32px 12px 16px',
          border: `1px solid ${isOpen ? '#1A4B77' : '#E4E4E7'}`,
          background: '#FFFFFF',
          fontSize: '14px',
          fontFamily: 'inherit',
          cursor: 'pointer',
          borderRadius: '6px',
          display: 'flex', alignItems: 'center', boxSizing: 'border-box',
          minHeight: '44px'
        }}
      >
        {isOpen ? (
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={placeholder}
            style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent', fontSize: '14px', color: '#09090B', padding: 0 }}
          />
        ) : (
          <span style={{ color: value ? '#09090B' : '#71717A', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value || placeholder}
          </span>
        )}
        <ChevronDown size={16} strokeWidth={1.5} style={{
          position: 'absolute', right: '12px', top: '50%',
          transform: `translateY(-50%) ${isOpen ? 'rotate(180deg)' : ''}`, 
          transition: 'transform 0.2s',
          pointerEvents: 'none', color: '#71717A',
        }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          maxHeight: '200px', overflowY: 'auto', zIndex: 50
        }}>
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: '13px', color: '#71717A' }}>No se encontraron resultados</div>
          ) : (
            filteredOptions.map(o => (
              <div
                key={o}
                onClick={() => { onChange(o); setIsOpen(false); }}
                style={{
                  padding: '10px 16px', fontSize: '14px', color: '#09090B', cursor: 'pointer',
                  background: value === o ? '#F1F5F9' : 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = value === o ? '#F1F5F9' : 'transparent'}
              >
                {o}
              </div>
            ))
          )}
        </div>
      )}
    </div>
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
          borderRadius: '6px'
        }}
        onFocus={e => (e.target.style.borderColor = '#1A4B77')}
        onBlur={e => (e.target.style.borderColor = '#E4E4E7')}
      />
    </div>
  );
}
