import { useState } from 'react';
import { LayoutGrid, Check, Trash2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';

const LOTES_PENDIENTES = [
  { id: 1, turno: 'Mañana', actividad: 'Cabalgata', fotos: 24, fecha: 'Hoy, 10:30' },
  { id: 2, turno: 'Tarde', actividad: 'Pileta', fotos: 42, fecha: 'Hoy, 14:15' },
];

export default function AdminModeration() {
  const [selectedLote, setSelectedLote] = useState(LOTES_PENDIENTES[0]);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [aprobarLoading, setAprobarLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);

  // Generate mock photos
  const photos = Array.from({ length: selectedLote.fotos }, (_, i) => i)
    .filter(id => !deletedIds.has(id));

  const toggleDelete = (id: number) => {
    setDeletedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAprobar = async () => {
    setAprobarLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setAprobarLoading(false);
    setDeletedIds(new Set());
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Sidebar de Lotes */}
      <aside style={{
        width: '320px',
        background: '#FAFAFA',
        borderRight: '1px solid #F4F4F5',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #E4E4E7' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '18px', color: '#1A4B77' }}>
            Moderación
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#71717A' }}>
            {LOTES_PENDIENTES.length} lotes pendientes
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {LOTES_PENDIENTES.map(lote => (
            <button
              key={lote.id}
              onClick={() => { setSelectedLote(lote); setDeletedIds(new Set()); }}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: selectedLote.id === lote.id ? '#FFFFFF' : 'transparent',
                border: 'none',
                borderBottom: '1px solid #F4F4F5',
                borderLeft: `2px solid ${selectedLote.id === lote.id ? '#1A4B77' : 'transparent'}`,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: '4px',
                transition: 'background 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1A4B77' }}>{lote.actividad}</span>
                  {lote.fecha.includes('Ayer') && (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B' }} title="Pendiente hace más de 24hs" />
                  )}
                </div>
                <span style={{ fontSize: '12px', color: '#71717A' }}>{lote.turno}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '11px', color: '#A1A1AA', fontWeight: 500 }}>{lote.fotos} FOTOS</span>
                <span style={{ fontSize: '11px', color: '#A1A1AA', fontWeight: 500 }}>{lote.fecha.toUpperCase()}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Topbar */}
        <header style={{
          padding: '24px 32px',
          borderBottom: '1px solid #F4F4F5',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#FFFFFF',
        }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px', color: '#1A4B77' }}>
              {selectedLote.actividad} - Turno {selectedLote.turno} <span style={{ fontSize: '15px', color: '#A1A1AA', fontWeight: 400 }}>({selectedLote.fecha})</span>
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#A1A1AA', fontWeight: 500 }}>
              {photos.length} FOTOS VÁLIDAS • {deletedIds.size} DESCARTADAS
            </p>
          </div>
          
          <button
            onClick={handleAprobar}
            disabled={aprobarLoading}
            style={{
              padding: '12px 24px',
              background: '#1A4B77',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: aprobarLoading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => !aprobarLoading && (e.currentTarget.style.background = '#133656')}
            onMouseLeave={e => !aprobarLoading && (e.currentTarget.style.background = '#1A4B77')}
          >
            {aprobarLoading ? 'Aprobando...' : (
              <>
                <Check size={16} strokeWidth={2.5} />
                Aprobar Lote
              </>
            )}
          </button>
        </header>

        {/* Gallery Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '8px',
          }}>
            {Array.from({ length: selectedLote.fotos }).map((_, i) => {
              const isDeleted = deletedIds.has(i);
              return (
                <div
                  key={i}
                  onClick={() => setSelectedPhoto(i)}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    background: '#F4F4F5',
                    border: isDeleted ? '2px solid #EF4444' : 'none',
                    opacity: isDeleted ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    const overlay = e.currentTarget.querySelector('.overlay') as HTMLElement;
                    if (overlay) overlay.style.opacity = '1';
                  }}
                  onMouseLeave={e => {
                    const overlay = e.currentTarget.querySelector('.overlay') as HTMLElement;
                    if (overlay) overlay.style.opacity = isDeleted ? '1' : '0';
                  }}
                >
                  {/* Photo mock */}
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isDeleted ? 0.3 : 1 }}>
                     <img src={`https://picsum.photos/seed/mod${selectedLote.id}${i}/400/400`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  
                  {/* Hover Overlay */}
                  <div
                    className="overlay"
                    style={{
                      position: 'absolute', inset: 0,
                      background: isDeleted ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0,0,0,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: (i === 0 && !isDeleted) ? 1 : (isDeleted ? 1 : 0),
                      transition: 'opacity 0.2s',
                    }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleDelete(i); }}
                      style={{
                        width: '40px', height: '40px',
                        background: isDeleted ? '#EF4444' : '#FFFFFF',
                        border: 'none', borderRadius: '50%', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isDeleted ? '#FFFFFF' : '#EF4444',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      {isDeleted ? <RotateCcw size={20} /> : <Trash2 size={20} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Lightbox */}
      {selectedPhoto !== null && (
        <LightboxViewer
          index={selectedPhoto}
          loteId={selectedLote.id}
          isDeleted={deletedIds.has(selectedPhoto)}
          onClose={() => setSelectedPhoto(null)}
          onToggleDelete={() => toggleDelete(selectedPhoto)}
        />
      )}
    </div>
  );
}

function LightboxViewer({ index, loteId, isDeleted, onClose, onToggleDelete }: { index: number, loteId: number, isDeleted: boolean, onClose: () => void, onToggleDelete: () => void }) {
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
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '800px', height: '800px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: `scale(${zoom})`, transition: 'transform 0.2s ease-out',
            opacity: isDeleted ? 0.5 : 1
          }}
        >
          <img src={`https://picsum.photos/seed/mod${loteId}${index}/1200/1200`} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
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
        
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
        <button 
          onClick={onToggleDelete}
          style={{ background: isDeleted ? '#EF4444' : 'transparent', border: 'none', color: isDeleted ? 'white' : '#EF4444', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}
        >
          {isDeleted ? <RotateCcw size={20} /> : <Trash2 size={20} />}
        </button>
      </div>
    </div>
  );
}
