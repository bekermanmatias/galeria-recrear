import { useState } from 'react';
import { LayoutGrid, Check, Trash2 } from 'lucide-react';
import Navbar from '../layout/Navbar';

const LOTES_PENDIENTES = [
  { id: 1, turno: 'Mañana', actividad: 'Cabalgata', fotos: 24, fecha: 'Hoy, 10:30' },
  { id: 2, turno: 'Tarde', actividad: 'Pileta', fotos: 42, fecha: 'Hoy, 14:15' },
];

export default function AdminPanel() {
  const [selectedLote, setSelectedLote] = useState(LOTES_PENDIENTES[0]);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [aprobarLoading, setAprobarLoading] = useState(false);

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
    // In a real app, this would advance to the next lot or show empty state
    setDeletedIds(new Set());
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', height: '100vh', background: '#FFFFFF' }}>
      <Navbar role="admin" />
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
      <aside style={{
        width: '320px',
        borderRight: '1px solid #E4E4E7',
        display: 'flex',
        flexDirection: 'column',
        background: '#FAFAFA',
      }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #E4E4E7' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em', color: '#1A4B77' }}>
            Moderación
          </h1>
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
                borderBottom: '1px solid #E4E4E7',
                borderLeft: `2px solid ${selectedLote.id === lote.id ? '#1A4B77' : 'transparent'}`,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: '4px',
                transition: 'background 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#1A4B77' }}>{lote.actividad}</span>
                <span style={{ fontSize: '12px', color: '#71717A' }}>{lote.turno}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '12px', color: '#A1A1AA' }}>{lote.fotos} fotos</span>
                <span style={{ fontSize: '12px', color: '#A1A1AA' }}>{lote.fecha}</span>
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
          borderBottom: '1px solid #E4E4E7',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#FFFFFF',
        }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 600, color: '#1A4B77' }}>
              Revisión: {selectedLote.actividad} ({selectedLote.turno})
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#71717A' }}>
              {photos.length} fotos válidas • {deletedIds.size} descartadas
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
            gap: '8px', // Slightly larger gap for admin view
          }}>
            {Array.from({ length: selectedLote.fotos }).map((_, i) => {
              const isDeleted = deletedIds.has(i);
              return (
                <div
                  key={i}
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
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LayoutGrid size={32} color="#A1A1AA" strokeWidth={1} />
                  </div>
                  
                  {/* Hover Overlay */}
                  <div
                    className="overlay"
                    style={{
                      position: 'absolute', inset: 0,
                      background: isDeleted ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0,0,0,0.4)',
                      opacity: isDeleted ? 1 : 0,
                      transition: 'opacity 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <button
                      onClick={() => toggleDelete(i)}
                      style={{
                        width: '40px', height: '40px',
                        background: isDeleted ? '#EF4444' : '#FFFFFF',
                        border: 'none', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        transform: 'scale(0.9)', transition: 'transform 0.1s',
                      }}
                      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.8)')}
                      onMouseUp={e => (e.currentTarget.style.transform = 'scale(0.9)')}
                    >
                      {isDeleted ? (
                        <Check size={20} color="#FFFFFF" strokeWidth={2.5} />
                      ) : (
                        <Trash2 size={18} color="#EF4444" strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
