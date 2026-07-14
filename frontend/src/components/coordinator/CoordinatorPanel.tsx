import { useState, useRef, useCallback } from 'react';
import { Upload, CloudUpload, X, CheckCircle2, LogOut, ChevronDown, Image } from 'lucide-react';

const TURNOS = ['Mañana', 'Tarde', 'Noche'];
const ACTIVIDADES = ['Cabalgata', 'Hotel', 'Pileta', 'Excursión', 'Cena'];

interface UploadFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

export default function CoordinatorPanel() {
  const [turno, setTurno] = useState('');
  const [actividad, setActividad] = useState('');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [done, setDone] = useState(false);
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
    if (!turno || !actividad || files.length === 0) return;
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

  const completedCount = Math.round((uploadProgress / 100) * files.length);
  const canUpload = turno && actividad && files.length > 0 && !uploading;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh', background: '#F8FAFC' }}>
      {/* Header */}
      <header style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '0 20px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px', height: '28px', background: '#4F46E5',
            borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Image size={14} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>Galería Recrear</span>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#64748B', fontSize: '13px', fontFamily: 'inherit',
          padding: '6px 8px', borderRadius: '6px', transition: 'background 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </header>

      {/* Content */}
      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0F172A' }}>
            Cargar fotos
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
            Seleccioná el turno y la actividad antes de subir
          </p>
        </div>

        {/* Selects */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <SelectField
            label="Turno"
            value={turno}
            onChange={setTurno}
            options={TURNOS}
            placeholder="Seleccionar..."
          />
          <SelectField
            label="Actividad"
            value={actividad}
            onChange={setActividad}
            options={ACTIVIDADES}
            placeholder="Seleccionar..."
          />
        </div>

        {/* Dropzone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? '#4F46E5' : '#CBD5E1'}`,
            borderRadius: '12px',
            background: isDragging ? '#EEF2FF' : '#F1F5F9',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: files.length > 0 ? '16px' : '20px',
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
          <div style={{
            width: '48px', height: '48px',
            background: '#FFFFFF',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            <CloudUpload size={24} color={isDragging ? '#4F46E5' : '#94A3B8'} />
          </div>
          <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '14px', color: '#0F172A' }}>
            Arrastrá tus fotos o tocá acá
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
            JPG, PNG, HEIC · Hasta 50 fotos
          </p>
        </div>

        {/* File preview list */}
        {files.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 500, color: '#64748B' }}>
              {files.length} {files.length === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}
            </p>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px',
              maxHeight: '140px', overflowY: 'auto',
            }}>
              {files.map(f => (
                <div key={f.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: '6px', overflow: 'hidden' }}>
                  <img src={f.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={e => { e.stopPropagation(); removeFile(f.id); }}
                    style={{
                      position: 'absolute', top: '2px', right: '2px',
                      width: '18px', height: '18px',
                      background: 'rgba(0,0,0,0.6)', border: 'none',
                      borderRadius: '50%', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={10} color="white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {uploading && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Subiendo fotos...</span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#4F46E5' }}>
                {completedCount} de {files.length}
              </span>
            </div>
            <div style={{ height: '6px', background: '#E2E8F0', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${uploadProgress}%`,
                background: 'linear-gradient(90deg, #4F46E5, #818CF8)',
                borderRadius: '99px',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}

        {/* Done state */}
        {done && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
          }}>
            <CheckCircle2 size={16} color="#16A34A" />
            <span style={{ fontSize: '13px', color: '#15803D', fontWeight: 500 }}>
              ¡Fotos subidas correctamente! El lote quedó en revisión.
            </span>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={simulateUpload}
          disabled={!canUpload}
          style={{
            width: '100%',
            padding: '14px',
            background: canUpload ? '#4F46E5' : '#C7D2FE',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: canUpload ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          onMouseEnter={e => canUpload && (e.currentTarget.style.background = '#4338CA')}
          onMouseLeave={e => canUpload && (e.currentTarget.style.background = '#4F46E5')}
        >
          <Upload size={16} />
          {uploading ? 'Subiendo...' : 'Subir fotos'}
        </button>

        {!turno || !actividad ? (
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#94A3B8', marginTop: '10px' }}>
            Seleccioná turno y actividad para continuar
          </p>
        ) : null}
      </main>
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
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%',
            padding: '9px 32px 9px 12px',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            background: '#FFFFFF',
            color: value ? '#0F172A' : '#94A3B8',
            fontSize: '13px',
            fontFamily: 'inherit',
            appearance: 'none',
            cursor: 'pointer',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = '#4F46E5')}
          onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={14} style={{
          position: 'absolute', right: '10px', top: '50%',
          transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94A3B8',
        }} />
      </div>
    </div>
  );
}
