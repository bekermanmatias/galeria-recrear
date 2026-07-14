import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Image, Download, ZoomIn, ZoomOut } from 'lucide-react';
import Navbar from '../layout/Navbar';

const DIAS = ['Día 1', 'Día 2', 'Día 3', 'Día 4'];
const TURNOS = ['Todos', 'Mañana', 'Tarde', 'Noche'];

const PHOTO_COLORS = [
  '#E4E4E7', '#F4F4F5', '#D4D4D8', '#A1A1AA', // Grayscale placeholders
];

export default function ParentPortal() {
  const [selectedDay, setSelectedDay] = useState('Día 1');
  const [selectedTurno, setSelectedTurno] = useState('Todos');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

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
      style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh', background: '#FFFFFF' }}
      onKeyDown={handleKeyDown as any}
      tabIndex={0}
    >
      {/* Header */}
      <Navbar role="parent" />

      {/* Filters */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        padding: '12px 24px',
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #F4F4F5',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Day pills */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', scrollbarWidth: 'none' }}>
            {DIAS.map(dia => (
              <button
                key={dia}
                onClick={() => setSelectedDay(dia)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  background: selectedDay === dia ? '#1A4B77' : '#F4F4F5',
                  color: selectedDay === dia ? '#FFFFFF' : '#3F3F46',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.2s',
                }}
              >
                {dia}
              </button>
            ))}
          </div>
          {/* Turno sub-pills */}
          <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {TURNOS.map(turno => (
              <button
                key={turno}
                onClick={() => setSelectedTurno(turno)}
                style={{
                  padding: '4px 0',
                  background: 'none',
                  color: selectedTurno === turno ? '#1A4B77' : '#A1A1AA',
                  border: 'none',
                  borderBottom: `2px solid ${selectedTurno === turno ? '#1A4B77' : 'transparent'}`,
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                {turno}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gallery */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px 64px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '16px',
        }}>
          {photos.map(i => (
            <div key={i} onClick={() => setLightbox(i)} style={{ aspectRatio: '1', borderRadius: '8px', cursor: 'pointer', overflow: 'hidden' }}>
              <img src={`https://picsum.photos/seed/rec${selectedDay}${i}/400/400`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
            background: '#000000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
          }}
        >
          {/* Close */}
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute', top: '24px', right: '24px',
              background: 'none',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#A1A1AA', transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
            onMouseLeave={e => (e.currentTarget.style.color = '#A1A1AA')}
          >
            <X size={24} strokeWidth={1.5} />
          </button>

          {/* Counter */}
          <div style={{
            position: 'absolute', top: '28px', left: '24px',
            color: '#A1A1AA', fontSize: '13px', letterSpacing: '0.05em',
          }}>
            {String(lightbox + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}
          </div>

          {/* Prev */}
          <button
            onClick={e => { e.stopPropagation(); setLightbox(Math.max(0, lightbox - 1)); }}
            disabled={lightbox === 0}
            style={{
              position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: lightbox === 0 ? 'default' : 'pointer',
              color: lightbox === 0 ? '#3F3F46' : '#FFFFFF',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => lightbox !== 0 && (e.currentTarget.style.transform = 'translateY(-50%) translateX(-4px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(-50%)')}
          >
            <ChevronLeft size={32} strokeWidth={1.5} />
          </button>

          {/* Photo */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(90vw, 1000px)',
              height: '80vh',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: `scale(${zoom})`,
              transition: 'transform 0.2s ease-out',
              cursor: zoom > 1 ? 'grab' : 'default',
            }}
          >
            <img src={`https://picsum.photos/seed/rec${selectedDay}${lightbox}/1200/800`} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>

          {/* Next */}
          <button
            onClick={e => { e.stopPropagation(); setLightbox(Math.min(photos.length - 1, lightbox + 1)); }}
            disabled={lightbox === photos.length - 1}
            style={{
              position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: lightbox === photos.length - 1 ? 'default' : 'pointer',
              color: lightbox === photos.length - 1 ? '#3F3F46' : '#FFFFFF',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => lightbox !== photos.length - 1 && (e.currentTarget.style.transform = 'translateY(-50%) translateX(4px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(-50%)')}
          >
            <ChevronRight size={32} strokeWidth={1.5} />
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
            
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
            
            <button style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              color: '#FFFFFF', fontSize: '13px',
              background: 'transparent', border: 'none', padding: '8px 16px',
              borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Download size={16} />
              Descargar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
