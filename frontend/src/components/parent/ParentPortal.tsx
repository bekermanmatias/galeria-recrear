import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Image, Download } from 'lucide-react';

const DIAS = ['Día 1', 'Día 2', 'Día 3', 'Día 4'];
const TURNOS = ['Todos', 'Mañana', 'Tarde', 'Noche'];

const PHOTO_COLORS = [
  '#C7D2FE', '#A5F3FC', '#BBF7D0', '#FDE68A', '#FECACA',
  '#DDD6FE', '#BAE6FD', '#A7F3D0', '#FEF08A', '#FBCFE8',
  '#E0E7FF', '#CFFAFE', '#D1FAE5', '#FEF3C7', '#FEE2E2',
  '#EDE9FE', '#E0F2FE', '#ECFDF5', '#FFFBEB', '#FFF1F2',
  '#F3E8FF', '#DBEAFE', '#DCFCE7', '#FEF9C3', '#FFE4E6',
];

export default function ParentPortal() {
  const [selectedDay, setSelectedDay] = useState('Día 1');
  const [selectedTurno, setSelectedTurno] = useState('Todos');
  const [lightbox, setLightbox] = useState<number | null>(null);

  // Simulate different photo counts per day
  const photoCount = selectedDay === 'Día 1' ? 18 : selectedDay === 'Día 2' ? 24 : selectedDay === 'Día 3' ? 15 : 21;
  const photos = Array.from({ length: photoCount }, (_, i) => i);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (lightbox === null) return;
    if (e.key === 'ArrowRight') setLightbox(prev => prev !== null ? Math.min(prev + 1, photos.length - 1) : null);
    if (e.key === 'ArrowLeft') setLightbox(prev => prev !== null ? Math.max(prev - 1, 0) : null);
    if (e.key === 'Escape') setLightbox(null);
  };

  return (
    <div
      style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh', background: '#F8FAFC' }}
      onKeyDown={handleKeyDown as any}
      tabIndex={0}
    >
      {/* Header */}
      <header style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '0 20px',
      }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{
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
              <div>
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>Galería Recrear</span>
              </div>
            </div>
            <span style={{
              fontSize: '12px', color: '#64748B',
              background: '#F1F5F9', padding: '4px 10px',
              borderRadius: '99px',
            }}>
              Viaje de Egresados 2024
            </span>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        position: 'sticky', top: 0, zIndex: 10,
        padding: '12px 20px',
      }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          {/* Day pills */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
            {DIAS.map(dia => (
              <button
                key={dia}
                onClick={() => setSelectedDay(dia)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '99px',
                  border: `1px solid ${selectedDay === dia ? '#4F46E5' : '#E2E8F0'}`,
                  background: selectedDay === dia ? '#4F46E5' : '#FFFFFF',
                  color: selectedDay === dia ? '#FFFFFF' : '#64748B',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {dia}
              </button>
            ))}
          </div>
          {/* Turno sub-pills */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {TURNOS.map(turno => (
              <button
                key={turno}
                onClick={() => setSelectedTurno(turno)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '99px',
                  border: `1px solid ${selectedTurno === turno ? '#818CF8' : '#E2E8F0'}`,
                  background: selectedTurno === turno ? '#EEF2FF' : '#FFFFFF',
                  color: selectedTurno === turno ? '#4F46E5' : '#94A3B8',
                  fontSize: '12px',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {turno}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gallery */}
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '20px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '14px',
        }}>
          <h1 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#374151' }}>
            {selectedDay} · {selectedTurno !== 'Todos' ? selectedTurno : 'Todos los turnos'}
          </h1>
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>{photos.length} fotos</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '10px',
        }}>
          {photos.map(i => (
            <div
              key={`${selectedDay}-${i}`}
              onClick={() => setLightbox(i)}
              style={{
                aspectRatio: '1',
                borderRadius: '10px',
                overflow: 'hidden',
                background: PHOTO_COLORS[(i + selectedDay.charCodeAt(4)) % PHOTO_COLORS.length],
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                transition: 'transform 0.15s, box-shadow 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
              }}
            >
              <Image size={24} color="#64748B" style={{ opacity: 0.35 }} />
            </div>
          ))}
        </div>
      </main>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Close */}
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'rgba(255,255,255,0.12)',
              border: 'none', borderRadius: '50%',
              width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          >
            <X size={18} color="white" />
          </button>

          {/* Counter */}
          <div style={{
            position: 'absolute', top: '20px', left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.6)', fontSize: '12px',
          }}>
            {lightbox + 1} / {photos.length}
          </div>

          {/* Prev */}
          <button
            onClick={e => { e.stopPropagation(); setLightbox(Math.max(0, lightbox - 1)); }}
            disabled={lightbox === 0}
            style={{
              position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
              background: lightbox === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.12)',
              border: 'none', borderRadius: '50%',
              width: '44px', height: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: lightbox === 0 ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <ChevronLeft size={22} color={lightbox === 0 ? 'rgba(255,255,255,0.2)' : 'white'} />
          </button>

          {/* Photo */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(90vw, 600px)',
              aspectRatio: '4/3',
              borderRadius: '12px',
              background: PHOTO_COLORS[(lightbox + selectedDay.charCodeAt(4)) % PHOTO_COLORS.length],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <Image size={48} color="#64748B" style={{ opacity: 0.3 }} />
          </div>

          {/* Next */}
          <button
            onClick={e => { e.stopPropagation(); setLightbox(Math.min(photos.length - 1, lightbox + 1)); }}
            disabled={lightbox === photos.length - 1}
            style={{
              position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
              background: lightbox === photos.length - 1 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.12)',
              border: 'none', borderRadius: '50%',
              width: '44px', height: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: lightbox === photos.length - 1 ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <ChevronRight size={22} color={lightbox === photos.length - 1 ? 'rgba(255,255,255,0.2)' : 'white'} />
          </button>

          {/* Download hint */}
          <div style={{
            position: 'absolute', bottom: '20px',
            display: 'flex', alignItems: 'center', gap: '6px',
            color: 'rgba(255,255,255,0.4)', fontSize: '12px',
          }}>
            <Download size={13} />
            Clic derecho para guardar
          </div>
        </div>
      )}
    </div>
  );
}
