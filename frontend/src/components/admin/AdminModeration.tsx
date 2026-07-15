import { useState, useEffect } from 'react';
import { Check, Trash2, RotateCcw, X, ZoomIn, ZoomOut, Search, Filter, Eye, ChevronDown } from 'lucide-react';
import Lightbox from '../ui/Lightbox';

const LOTES_PENDIENTES = [
  { id: 1, colegio: 'Escuela Normal', turno: 'Mañana', actividad: 'Cabalgata', fotos: 24, fecha: 'Hoy, 10:30' },
  { id: 2, colegio: 'Colegio San José', turno: 'Tarde', actividad: 'Pileta', fotos: 42, fecha: 'Hoy, 14:15' },
];

export default function AdminModeration() {
  const [selectedLote, setSelectedLote] = useState(LOTES_PENDIENTES[0]);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [aprobarLoading, setAprobarLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [mobileLotesOpen, setMobileLotesOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentLote = LOTES_PENDIENTES.find(l => l.id === selectedLote.id) || LOTES_PENDIENTES[0];

  // Generate mock photos
  const photos = Array.from({ length: currentLote.fotos }, (_, i) => i)
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

  const filteredLotes = LOTES_PENDIENTES.filter(lote => 
    lote.actividad.toLowerCase().includes(searchQuery.toLowerCase()) || 
    lote.colegio.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="moderation-container" style={{ display: 'flex', flex: 1, overflow: 'hidden', background: '#FFFFFF' }}>
      {/* Sidebar de Lotes */}
      <aside className="moderation-sidebar" style={{
        width: '220px',
        background: '#F8FAFC',
        borderRight: '1px solid #E5E7EB',
        display: 'flex', flexDirection: 'column',
      }}>
        {isMobile && (
          <button 
            onClick={() => setMobileLotesOpen(!mobileLotesOpen)}
            style={{ padding: '16px', background: '#F8FAFC', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '15px', color: '#1A4B77', fontWeight: 600 }}>Seleccionar lote... ({LOTES_PENDIENTES.length})</span>
            <ChevronDown size={20} color="#64748B" style={{ transform: mobileLotesOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
          </button>
        )}

        {(!isMobile || mobileLotesOpen) && (
          <>
            <div style={{ 
              padding: '16px', 
              borderBottom: '1px solid #E5E7EB', 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center',
              height: isMobile ? 'auto' : '132px',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {!isMobile && (
                  <div>
                    <h2 style={{ margin: '0 0 2px', fontSize: '15px', color: '#1E293B', fontWeight: 600 }}>
                      Moderación
                    </h2>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                      {LOTES_PENDIENTES.length} lotes pendientes
                    </p>
                  </div>
                )}
                
                <div style={{ position: 'relative' }}>
                <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Buscar lote..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                    fontSize: '13px',
                    outline: 'none',
                    color: '#1E293B',
                    boxSizing: 'border-box'
                  }}
                />
                </div>
              </div>
            </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredLotes.map(lote => {
            const isActive = selectedLote.id === lote.id;
            return (
              <button
                key={lote.id}
                onClick={() => { setSelectedLote(lote); setDeletedIds(new Set()); }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: isActive ? '#F1F5F9' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '3px solid #1A4B77' : '3px solid transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: isActive ? '#1A4B77' : '#334155', lineHeight: 1.2 }}>
                    {lote.colegio}
                  </span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E', flexShrink: 0, marginTop: '2px' }} title="Pendiente" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lote.actividad}</span>
                  <span style={{ fontSize: '12px', color: '#64748B', flexShrink: 0 }}>{lote.fotos} fotos</span>
                </div>
              </button>
            )
          })}
        </div>
        </>
      )}
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Topbar */}
        <header style={{
          padding: isMobile ? '12px 16px' : '0 24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#FFFFFF',
          height: isMobile ? 'auto' : '132px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: '0 0 4px', fontSize: isMobile ? '18px' : '24px', color: '#1A4B77', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {currentLote.colegio.toUpperCase()}
              </h2>
              <div style={{ marginBottom: isMobile ? '8px' : '16px', fontSize: isMobile ? '13px' : '15px', color: '#64748B', fontWeight: 500 }}>
                {currentLote.actividad} • {isMobile ? currentLote.fecha : `Turno ${currentLote.turno} • ${currentLote.fecha}`}
              </div>
              
              <div style={{ display: 'flex', gap: '8px', flexWrap: isMobile ? 'nowrap' : 'wrap', width: isMobile ? '100%' : 'auto' }}>
                <span style={{ flex: isMobile ? 1 : 'none', minWidth: isMobile ? 0 : '110px', textAlign: 'center', background: '#F8FAFC', border: '1px solid #E5E7EB', padding: isMobile ? '2px 4px' : '4px 12px', borderRadius: '16px', fontSize: isMobile ? '11px' : '13px', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentLote.fotos} {isMobile ? 'total' : 'en total'}
                </span>
                <span style={{ flex: isMobile ? 1 : 'none', minWidth: isMobile ? 0 : '110px', textAlign: 'center', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: isMobile ? '2px 4px' : '4px 12px', borderRadius: '16px', fontSize: isMobile ? '11px' : '13px', color: '#16A34A', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentLote.fotos - deletedIds.size} {isMobile ? 'aprob.' : 'aprobadas'}
                </span>
                {deletedIds.size > 0 && (
                  <span style={{ flex: isMobile ? 1 : 'none', minWidth: isMobile ? 0 : '110px', textAlign: 'center', background: '#FEF2F2', border: '1px solid #FECACA', padding: isMobile ? '2px 4px' : '4px 12px', borderRadius: '16px', fontSize: isMobile ? '11px' : '13px', color: '#EF4444', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {deletedIds.size} {isMobile ? 'desc.' : 'descartadas'}
                  </span>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexShrink: 0 }}>
              <button
                onClick={handleAprobar}
                disabled={aprobarLoading}
                style={{
                  padding: isMobile ? '8px 12px' : '10px 24px',
                  background: '#22C55E',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: aprobarLoading ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px',
                  boxShadow: '0 1px 2px rgba(34, 197, 94, 0.2)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => !aprobarLoading && (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={e => !aprobarLoading && (e.currentTarget.style.transform = 'none')}
              >
                {aprobarLoading ? (isMobile ? '...' : 'Aprobando...') : (
                  <>
                    <Check size={isMobile ? 16 : 18} strokeWidth={2.5} />
                    {isMobile ? 'Aprobar' : 'Aprobar Lote'}
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Gallery Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '24px',
          }}>
            {Array.from({ length: currentLote.fotos }).map((_, i) => {
              const isDeleted = deletedIds.has(i);
              return (
                <div
                  key={i}
                  onClick={() => { if (isMobile && !isDeleted) setSelectedPhoto(i); }}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    background: '#F8FAFC',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    opacity: isDeleted ? 0.4 : 1,
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    cursor: (isMobile && !isDeleted) ? 'pointer' : 'default',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
                    const overlay = e.currentTarget.querySelector('.overlay') as HTMLElement;
                    if (overlay) overlay.style.opacity = '1';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    const overlay = e.currentTarget.querySelector('.overlay') as HTMLElement;
                    if (overlay) overlay.style.opacity = '0';
                  }}
                >
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <img src={`https://picsum.photos/seed/mod${selectedLote.id}${i}/400/400`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  
                  {isDeleted && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '50%', color: 'white' }}>
                        <Trash2 size={32} />
                      </div>
                    </div>
                  )}
                  
                  {isMobile && !isDeleted && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleDelete(i); }}
                      style={{
                        position: 'absolute', top: '8px', right: '8px',
                        background: '#EF4444', border: 'none', borderRadius: '50%',
                        width: '32px', height: '32px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', zIndex: 10,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}
                    >
                      <Trash2 size={16} color="white" />
                    </button>
                  )}
                  
                  {!isMobile && !isDeleted && (
                    <div
                      className="overlay"
                      style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.3)',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        padding: '12px',
                      }}
                    >
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedPhoto(i); }}
                          title="Ver en grande"
                          style={{
                            width: '40px', height: '40px',
                            background: '#FFFFFF', border: 'none', borderRadius: '50%', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#1E293B', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                          }}
                        >
                          <Eye size={20} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleDelete(i); }}
                          title="Descartar foto"
                          style={{
                            width: '40px', height: '40px',
                            background: '#EF4444', border: 'none', borderRadius: '50%', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#FFFFFF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                          }}
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  )}

                  {isDeleted && (
                    <div
                      className="overlay"
                      style={{
                        position: 'absolute', inset: 0,
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleDelete(i); }}
                          title="Restaurar foto"
                          style={{
                            width: '48px', height: '48px',
                            background: '#22C55E', border: 'none', borderRadius: '50%', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#FFFFFF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                          }}
                        >
                          <RotateCcw size={24} />
                        </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {selectedPhoto !== null && (
        <Lightbox 
          src={`https://picsum.photos/seed/mod${selectedLote.id}${selectedPhoto}/1200/1200`} 
          isDeleted={deletedIds.has(selectedPhoto)}
          onClose={() => setSelectedPhoto(null)} 
          onNext={selectedPhoto < currentLote.fotos - 1 ? () => setSelectedPhoto(selectedPhoto + 1) : undefined}
          onPrev={selectedPhoto > 0 ? () => setSelectedPhoto(selectedPhoto - 1) : undefined}
          actions={
            <>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
              <button 
                onClick={() => toggleDelete(selectedPhoto)}
                style={{ 
                  background: deletedIds.has(selectedPhoto) ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', 
                  border: 'none', 
                  color: deletedIds.has(selectedPhoto) ? '#4ADE80' : '#F87171', 
                  cursor: 'pointer', padding: '8px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                {deletedIds.has(selectedPhoto) ? <RotateCcw size={20} /> : <Trash2 size={20} />}
                <span style={{ fontSize: '13px', fontWeight: 500 }}>
                  {deletedIds.has(selectedPhoto) ? 'Restaurar' : 'Descartar'}
                </span>
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
