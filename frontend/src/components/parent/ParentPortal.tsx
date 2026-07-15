import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Image, Download, ZoomIn, ZoomOut, Image as ImageIcon } from 'lucide-react';
import DashboardLayout from '../layout/DashboardLayout';
import Lightbox from '../ui/Lightbox';

const DIAS = ['Día 1', 'Día 2', 'Día 3', 'Día 4'];
const TURNOS = ['Todos', 'Mañana', 'Tarde', 'Noche'];

const PHOTO_COLORS = [
  '#E4E4E7', '#F4F4F5', '#D4D4D8', '#A1A1AA', // Grayscale placeholders
];

const TABS = [
  { id: 'galeria', label: 'Galería de Fotos', icon: ImageIcon },
] as const;

export default function ParentPortal() {
  const [activeTab, setActiveTab] = useState('galeria');
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
    <DashboardLayout
      role="parent"
      tabs={TABS as any}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'galeria' && (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
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
      </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && (
        <Lightbox
          src={`https://picsum.photos/seed/rec${selectedDay}${lightbox}/1200/800`}
          onClose={() => setLightbox(null)}
          onNext={lightbox < photos.length - 1 ? () => setLightbox(prev => (prev !== null ? prev + 1 : prev)) : undefined}
          onPrev={lightbox > 0 ? () => setLightbox(prev => (prev !== null ? prev - 1 : prev)) : undefined}
        />
      )}
    </DashboardLayout>
  );
}
